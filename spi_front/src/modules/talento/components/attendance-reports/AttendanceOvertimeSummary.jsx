import React, { useMemo } from "react";

const parseHHMM = (value, fallback) => {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
};

const normalizeEventType = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getZonedSnapshot = (date, timeZone = "America/Guayaquil") => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = parts.reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  const weekdayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    weekday: weekdayMap[map.weekday] ?? null,
    minutes: (Number(map.hour) * 60) + Number(map.minute),
  };
};

const getFieldIntervals = (row = {}) => {
  const events = Array.isArray(row?.field_events) ? row.field_events : [];
  if (!events.length) return [];

  const normalized = events
    .map((event) => ({
      type: normalizeEventType(event?.type || event?.event_type),
      time: toDateOrNull(event?.time || event?.timestamp || event?.occurred_at),
    }))
    .filter((event) => event.type && event.time)
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  if (!normalized.length) return [];

  const intervals = [];
  let officeStart = null;
  const clientQueue = [];

  normalized.forEach((event) => {
    if (event.type === "office_exit" || event.type === "field_out") {
      officeStart = event.time;
      return;
    }

    if (event.type === "office_entry") {
      if (officeStart && event.time > officeStart) {
        intervals.push({ start: officeStart, end: event.time, source: "office" });
      }
      officeStart = null;
      return;
    }

    if (event.type === "client_entry" || event.type === "arrival") {
      clientQueue.push(event.time);
      return;
    }

    if (event.type === "client_exit" || event.type === "departure") {
      const start = clientQueue.shift();
      if (start && event.time > start) {
        intervals.push({ start, end: event.time, source: "client" });
      }
    }
  });

  const fallbackEnd = toDateOrNull(row?.exit_time || row?.return_time);
  if (officeStart && fallbackEnd && fallbackEnd > officeStart) {
    intervals.push({ start: officeStart, end: fallbackEnd, source: "office" });
  }

  return intervals;
};

export const computeOutsideMinutes = (interval, policy) => {
  const start = interval?.start;
  const end = interval?.end;
  if (!(start instanceof Date) || !(end instanceof Date) || end <= start) return 0;

  const tz = String(policy?.timezone || "America/Guayaquil");
  const workDays = Array.isArray(policy?.workDays) && policy.workDays.length ? policy.workDays : [1, 2, 3, 4, 5];
  const startMinutes = parseHHMM(policy?.start, 450); // 07:30
  const endMinutes = parseHHMM(policy?.end, 1200); // 20:00

  let cursor = start.getTime();
  const finish = end.getTime();
  let outsideMinutes = 0;

  while (cursor < finish) {
    const nextCursor = Math.min(finish, cursor + (60 * 1000));
    const midpoint = new Date((cursor + nextCursor) / 2);
    const snapshot = getZonedSnapshot(midpoint, tz);

    const isWorkDay = workDays.includes(snapshot.weekday);
    const isInsideWindow =
      isWorkDay &&
      snapshot.minutes >= startMinutes &&
      snapshot.minutes < endMinutes;

    if (!isInsideWindow) {
      outsideMinutes += (nextCursor - cursor) / (60 * 1000);
    }

    cursor = nextCursor;
  }

  return outsideMinutes;
};

const parseExtraActaHours = (row, standardWorkHours) => {
  const totalHours = Number(row?.total_hours || 0);
  const hasCoreMarks = Boolean(row?.entry_time && row?.exit_time);
  const timeOffType = String(row?.time_off_type || "").toLowerCase();
  const timeOffSubtype = String(row?.time_off_subtype || "").toLowerCase();
  const isRecovery = timeOffSubtype.includes("recuper");

  if (!hasCoreMarks) return 0;
  if (timeOffType === "permiso" || timeOffType === "vacaciones" || isRecovery) return 0;
  if (!Number.isFinite(totalHours) || totalHours <= standardWorkHours) return 0;

  return totalHours - standardWorkHours;
};

export const formatHours = (hours = 0) => {
  const numericHours = Number(hours || 0);
  if (!Number.isFinite(numericHours) || numericHours <= 0) return "00:00:00";

  const totalSeconds = Math.round(numericHours * 3600);
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

const AttendanceOvertimeSummary = ({ rows = [], meta = null }) => {
  const policy = useMemo(() => {
    const workingHours = meta?.workingHours || {};
    return {
      timezone: workingHours?.timezone || "America/Guayaquil",
      workDays: Array.isArray(workingHours?.workDays) ? workingHours.workDays : [1, 2, 3, 4, 5],
      start: workingHours?.start || "09:00",
      end: workingHours?.end || "18:00",
      standardWorkHours: Number(meta?.standardWorkHours || 8),
    };
  }, [meta]);

  const leaderboard = useMemo(() => {
    const byUser = new Map();

    rows.forEach((row) => {
      const userId = String(row?.user_id || row?.email || row?.fullname || "");
      if (!userId) return;

      const existing = byUser.get(userId) || {
        userId,
        fullname: row?.fullname || row?.email || `Usuario ${userId}`,
        realMinutes: 0,
        actaHours: 0,
        realDays: new Set(),
        actaDays: new Set(),
        observations: new Set(),
      };

      const backendRealOvertimeHours = Number(row?.real_overtime_hours || 0);
      const backendActaOvertimeHours = Number(row?.acta_overtime_hours || 0);
      const intervals = getFieldIntervals(row);
      const fallbackRealMinutes = intervals.reduce((acc, interval) => acc + computeOutsideMinutes(interval, policy), 0);
      const realMinutes = backendRealOvertimeHours > 0 ? backendRealOvertimeHours * 60 : fallbackRealMinutes;
      if (realMinutes > 0) {
        existing.realMinutes += realMinutes;
        existing.realDays.add(String(row?.date || ""));
      }

      const extraActaHours = backendActaOvertimeHours > 0
        ? backendActaOvertimeHours
        : parseExtraActaHours(row, policy.standardWorkHours);
      if (extraActaHours > 0) {
        existing.actaHours += extraActaHours;
        existing.actaDays.add(String(row?.date || ""));
      }

      const observation = String(row?.overtime_observation || "").trim();
      if (observation) existing.observations.add(observation);

      byUser.set(userId, existing);
    });

    return Array.from(byUser.values())
      .map((item) => ({
        ...item,
        realHours: item.realMinutes / 60,
        realDaysCount: item.realDays.size,
        actaDaysCount: item.actaDays.size,
        observations: Array.from(item.observations),
      }))
      .sort((a, b) => (b.realHours + b.actaHours) - (a.realHours + a.actaHours));
  }, [policy, rows]);

  const totals = useMemo(() => {
    return leaderboard.reduce(
      (acc, row) => {
        acc.realHours += row.realHours;
        acc.actaHours += row.actaHours;
        return acc;
      },
      { realHours: 0, actaHours: 0 }
    );
  }, [leaderboard]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Horas extra por colaborador</h3>
          <p className="mt-1 text-xs text-slate-600">
            Reales (campo fuera de jornada laboral {policy.start}-{policy.end}, {policy.timezone}) y Acta (horas {'>'} {policy.standardWorkHours} sin permisos/vacaciones/recuperacion).
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span
              className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700"
              title={`Real: suma de minutos de eventos de campo fuera de ${policy.start}-${policy.end} (${policy.timezone}), mostrado en HH:mm:ss.`}
            >
              Formula real
            </span>
            <span
              className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-amber-700"
              title={`Acta: max(total_hours - ${policy.standardWorkHours}, 0), excluyendo permisos/vacaciones/recuperacion, mostrado en HH:mm:ss.`}
            >
              Formula acta
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-slate-600">
          <div>Total real: <span className="font-semibold text-slate-900">{formatHours(totals.realHours)}</span></div>
          <div>Total acta: <span className="font-semibold text-slate-900">{formatHours(totals.actaHours)}</span></div>
        </div>
      </div>

      {leaderboard.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Colaborador</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Extra real (campo)</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Extra acta</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Dias real</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">Dias acta</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Observacion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaderboard.map((row) => (
                <tr key={row.userId}>
                  <td className="px-3 py-2 text-slate-800">{row.fullname}</td>
                  <td className="px-3 py-2 text-right font-medium text-emerald-700">{formatHours(row.realHours)}</td>
                  <td className="px-3 py-2 text-right font-medium text-amber-700">{formatHours(row.actaHours)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{row.realDaysCount}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{row.actaDaysCount}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{row.observations[0] || "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No hay datos suficientes para calcular horas extra en el rango actual.</p>
      )}
    </div>
  );
};

export default AttendanceOvertimeSummary;
