const db = require("../../config/db");
const logger = require("../../config/logger");
const { parseCoordinatePair } = require("./attendanceGeo.utils");

let attendanceRangeCapabilitiesPromise = null;

const loadAttendanceRangeCapabilities = async () => {
  if (attendanceRangeCapabilitiesPromise) return attendanceRangeCapabilitiesPromise;

  attendanceRangeCapabilitiesPromise = db
    .query(
      `
        SELECT
          to_regclass('public.client_visit_logs') IS NOT NULL AS has_client_visit_logs,
          to_regclass('public.prospect_visits') IS NOT NULL AS has_prospect_visits
      `
    )
    .then((result) => ({
      hasClientVisitLogs: Boolean(result?.rows?.[0]?.has_client_visit_logs),
      hasProspectVisits: Boolean(result?.rows?.[0]?.has_prospect_visits),
    }))
    .catch((err) => {
      logger.warn(
        { err },
        "No se pudo verificar tablas opcionales de asistencia; se desactivan eventos externos en reporte"
      );
      return {
        hasClientVisitLogs: false,
        hasProspectVisits: false,
      };
    });

  return attendanceRangeCapabilitiesPromise;
};

const ATTENDANCE_STATUS_ALIASES = Object.freeze({
  no_entry: "no_entry",
  sin_entrada: "no_entry",
  pending_entry: "no_entry",
  entry_pending: "no_entry",
  working: "working",
  jornada_abierta: "working",
  abierta: "working",
  lunch_open: "lunch_open",
  almuerzo_abierto: "lunch_open",
  lunch: "lunch_open",
  completed: "completed",
  complete: "completed",
  jornada_cerrada: "completed",
  closed: "completed",
  cerrada: "completed",
});

const ATTENDANCE_STATUS_LABELS = Object.freeze({
  no_entry: "Sin entrada",
  working: "En jornada",
  lunch_open: "Almuerzo abierto",
  completed: "Jornada cerrada",
});

const normalizeAttendanceStateFilter = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return ATTENDANCE_STATUS_ALIASES[normalized] || null;
};

const deriveAttendanceState = (record = {}) => {
  if (record?.exit_time) return "completed";
  if (record?.lunch_start_time && !record?.lunch_end_time) return "lunch_open";
  if (!record?.entry_time && !record?.lunch_start_time && !record?.lunch_end_time) return "no_entry";
  return "working";
};

const normalizeCoordinateString = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, "");

const normalizeDateKey = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value || "").slice(0, 10);
};

const sanitizeHtmlText = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const isValidCoordinatePair = (value) => {
  const normalized = normalizeCoordinateString(value);
  if (!normalized || !normalized.includes(",")) return false;

  const [latRaw, lngRaw] = normalized.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const deriveHasGeo = (record = {}) => {
  const geoCandidates = [
    record.entry_location,
    record.lunch_start_location,
    record.lunch_end_location,
    record.exit_location,
    record.op_lunch_start_location,
    record.op_lunch_end_location,
    record.start_location,
    record.arrival_location,
    record.departure_location,
    record.return_location,
  ];

  return geoCandidates.some(isValidCoordinatePair);
};

const deriveHasDiscrepancy = (record = {}) => {
  const missingCorePunch =
    !record.entry_time ||
    !record.exit_time ||
    (record.lunch_start_time && !record.lunch_end_time);

  const hasException =
    Boolean(record.exception_id) ||
    String(record.exception_status || "").trim().toUpperCase() === "ACTIVE";

  return missingCorePunch || hasException;
};

const ATTENDANCE_GEO_FIELDS = Object.freeze([
  { key: "entry_location", type: "entry", label: "Entrada", timeKey: "entry_time" },
  { key: "lunch_start_location", type: "lunch_start", label: "Almuerzo salida", timeKey: "lunch_start_time" },
  { key: "lunch_end_location", type: "lunch_end", label: "Almuerzo regreso", timeKey: "lunch_end_time" },
  { key: "exit_location", type: "exit", label: "Salida", timeKey: "exit_time" },
  { key: "op_lunch_start_location", type: "op_lunch_start", label: "Almuerzo operacional salida", timeKey: "op_lunch_start_time" },
  { key: "op_lunch_end_location", type: "op_lunch_end", label: "Almuerzo operacional regreso", timeKey: "op_lunch_end_time" },
  { key: "start_location", type: "start", label: "Inicio", timeKey: "start_time" },
  { key: "arrival_location", type: "arrival", label: "Llegada", timeKey: "arrival_time" },
  { key: "departure_location", type: "departure", label: "Salida", timeKey: "departure_time" },
  { key: "return_location", type: "return", label: "Regreso", timeKey: "return_time" },
]);

const ATTENDANCE_POLYLINE_ORDER = Object.freeze([
  "entry",
  "lunch_start",
  "lunch_end",
  "exit",
]);
const TIME_OFF_TYPE_LABELS = Object.freeze({
  personal: "Permiso personal",
  salud: "Permiso de salud",
  estudios: "Permiso de estudios",
  calamidad: "Calamidad domestica",
  emergencia_medica_propia: "Emergencia medica propia",
});
const ACTA_TIMEZONE_OFFSET = "-05:00";
const ACTA_ENTRY_START = process.env.ATTENDANCE_ACTA_ENTRY_START || "09:00";
const ACTA_LUNCH_START = process.env.ATTENDANCE_ACTA_LUNCH_START || "14:00";
const ACTA_LUNCH_END = process.env.ATTENDANCE_ACTA_LUNCH_END || "15:00";
const ACTA_EXIT_END = process.env.ATTENDANCE_ACTA_EXIT_END || "18:00";
const ATTENDANCE_STANDARD_WORK_HOURS = Number(process.env.ATTENDANCE_STANDARD_WORK_HOURS || 8);

const normalizeToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

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

const buildActaDateTime = (dateKey, hhmm) => {
  const safeDateKey = String(dateKey || "").slice(0, 10);
  const safeClock = String(hhmm || "").trim() || "00:00";
  const parsed = new Date(`${safeDateKey}T${safeClock}:00${ACTA_TIMEZONE_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const computeWorkedHours = ({ entry, lunchStart, lunchEnd, exit }) => {
  if (!(entry instanceof Date) || !(exit instanceof Date) || exit <= entry) return 0;
  let workedMs = exit.getTime() - entry.getTime();
  if (
    lunchStart instanceof Date &&
    lunchEnd instanceof Date &&
    lunchEnd > lunchStart &&
    lunchEnd > entry &&
    lunchStart < exit
  ) {
    const boundedStart = Math.max(lunchStart.getTime(), entry.getTime());
    const boundedEnd = Math.min(lunchEnd.getTime(), exit.getTime());
    if (boundedEnd > boundedStart) workedMs -= (boundedEnd - boundedStart);
  }
  return workedMs / (1000 * 60 * 60);
};

const computeWorkedMs = ({ entry, lunchStart, lunchEnd, exit }) => {
  if (!(entry instanceof Date) || !(exit instanceof Date) || exit <= entry) return 0;
  let workedMs = exit.getTime() - entry.getTime();
  if (
    lunchStart instanceof Date &&
    lunchEnd instanceof Date &&
    lunchEnd > lunchStart &&
    lunchEnd > entry &&
    lunchStart < exit
  ) {
    const boundedStart = Math.max(lunchStart.getTime(), entry.getTime());
    const boundedEnd = Math.min(lunchEnd.getTime(), exit.getTime());
    if (boundedEnd > boundedStart) workedMs -= (boundedEnd - boundedStart);
  }
  return Math.max(0, workedMs);
};

const computeRealWorkedMs = ({ entry, lunchStart, lunchEnd, exit }) => {
  if (!(entry instanceof Date) || !(exit instanceof Date) || exit <= entry) return 0;
  let workedMs = exit.getTime() - entry.getTime();
  if (
    lunchStart instanceof Date &&
    lunchEnd instanceof Date &&
    lunchEnd > lunchStart &&
    lunchEnd > entry &&
    lunchStart < exit
  ) {
    const boundedStart = Math.max(lunchStart.getTime(), entry.getTime());
    const boundedEnd = Math.min(lunchEnd.getTime(), exit.getTime());
    if (boundedEnd > boundedStart) {
      const realLunchMs = boundedEnd - boundedStart;
      const minimumLunchMs = 60 * 60 * 1000;
      workedMs -= Math.max(realLunchMs, minimumLunchMs);
    }
  }
  return Math.max(0, workedMs);
};

const getFieldIntervals = (record = {}) => {
  const events = Array.isArray(record?.field_events) ? record.field_events : [];
  if (!events.length) return [];

  const normalized = events
    .map((event) => ({
      type: normalizeEventType(event?.type || event?.event_type),
      time: toDateOrNull(event?.time || event?.timestamp || event?.occurred_at),
    }))
    .filter((event) => event.type && event.time)
    .sort((a, b) => a.time.getTime() - b.time.getTime());

  const intervals = [];
  let officeStart = null;
  const clientQueue = [];

  normalized.forEach((event) => {
    if (event.type === "office_exit" || event.type === "field_out") {
      officeStart = event.time;
      return;
    }
    if (event.type === "office_entry") {
      if (officeStart && event.time > officeStart) intervals.push({ start: officeStart, end: event.time, source: "office" });
      officeStart = null;
      return;
    }
    if (event.type === "client_entry" || event.type === "arrival") {
      clientQueue.push(event.time);
      return;
    }
    if (event.type === "client_exit" || event.type === "departure") {
      const start = clientQueue.shift();
      if (start && event.time > start) intervals.push({ start, end: event.time, source: "client" });
    }
  });

  const fallbackEnd = toDateOrNull(record?.exit_time || record?.return_time);
  if (officeStart && fallbackEnd && fallbackEnd > officeStart) {
    intervals.push({ start: officeStart, end: fallbackEnd, source: "office" });
  }

  return intervals;
};

const buildAttendanceRegularization = (record = {}) => {
  const dateKey = normalizeDateKey(record?.date);
  if (!dateKey) {
    return {
      acta_entry_time: null,
      acta_lunch_start_time: null,
      acta_lunch_end_time: null,
      acta_exit_time: null,
      acta_total_hours: 0,
      acta_overtime_hours: 0,
      real_overtime_hours: 0,
      real_overtime_seconds: 0,
      overtime_observation: null,
    };
  }

  const entry = toDateOrNull(record?.entry_time);
  const lunchStart = toDateOrNull(record?.lunch_start_time);
  const lunchEnd = toDateOrNull(record?.lunch_end_time);
  const exit = toDateOrNull(record?.exit_time);
  const entryFloor = buildActaDateTime(dateKey, ACTA_ENTRY_START);
  const lunchFloor = buildActaDateTime(dateKey, ACTA_LUNCH_START);
  const lunchCeil = buildActaDateTime(dateKey, ACTA_LUNCH_END);
  const exitCeil = buildActaDateTime(dateKey, ACTA_EXIT_END);
  const fieldIntervals = getFieldIntervals(record);
  const hasOperationalFlow =
    Boolean(fieldIntervals.length) ||
    ["operacion_campo", "operacion_de_campo", "salida_oficina", "viaje", "campo"].includes(
      String(record?.exception_type || "").trim().toLowerCase()
    );

  // F.RH always shows standard times regardless of early/late marks.
  // Real times are preserved in entry_time/exit_time for operational traceability.
  const actaEntry = entry && entryFloor ? entryFloor : entry;
  const shouldAutoLunch = Boolean(
    hasOperationalFlow &&
    actaEntry &&
    lunchFloor &&
    lunchCeil &&
    (
      fieldIntervals.some((interval) => interval.start < lunchCeil && interval.end > lunchFloor) ||
      (exit && exit > lunchFloor) ||
      String(record?.exception_status || "").trim().toUpperCase() !== ""
    )
  );
  const actaLunchStart = (lunchStart || shouldAutoLunch) ? lunchFloor : null;
  const actaLunchEnd = (lunchEnd || shouldAutoLunch) ? lunchCeil : null;

  let actaExit = null;
  if (exit && exitCeil) {
    actaExit = exitCeil;
  } else if (!exit && hasOperationalFlow && exitCeil) {
    actaExit = exitCeil;
  }

  const standardWorkHours =
    Number.isFinite(ATTENDANCE_STANDARD_WORK_HOURS) && ATTENDANCE_STANDARD_WORK_HOURS > 0
      ? ATTENDANCE_STANDARD_WORK_HOURS
      : 8;
  let actaTotalHours = computeWorkedHours({
    entry: actaEntry,
    lunchStart: actaLunchStart,
    lunchEnd: actaLunchEnd,
    exit: actaExit,
  });
  if (actaExit && actaTotalHours > standardWorkHours) {
    const excessMs = (actaTotalHours - standardWorkHours) * 60 * 60 * 1000;
    actaExit = new Date(actaExit.getTime() - excessMs);
    actaTotalHours = computeWorkedHours({
      entry: actaEntry,
      lunchStart: actaLunchStart,
      lunchEnd: actaLunchEnd,
      exit: actaExit,
    });
  }

  const actaOvertimeHours = actaTotalHours > standardWorkHours ? actaTotalHours - standardWorkHours : 0;
  const realWorkedMs = computeRealWorkedMs({
    entry,
    lunchStart,
    lunchEnd,
    exit,
  });
  const realOvertimeSeconds = Math.max(
    0,
    Math.round((realWorkedMs - standardWorkHours * 60 * 60 * 1000) / 1000)
  );
  const realOvertimeHours = realOvertimeSeconds / 3600;

  let overtimeObservation = null;
  if (realOvertimeHours > actaOvertimeHours) {
    overtimeObservation = hasOperationalFlow
      ? `Gestion operativa regularizada en acta. Extra real calculada solo con marcaciones reales.`
      : `Jornada regularizada para acta. Extra real calculada solo con marcaciones reales.`;
  }

  return {
    acta_entry_time: actaEntry ? actaEntry.toISOString() : null,
    acta_lunch_start_time: actaLunchStart ? actaLunchStart.toISOString() : null,
    acta_lunch_end_time: actaLunchEnd ? actaLunchEnd.toISOString() : null,
    acta_exit_time: actaExit ? actaExit.toISOString() : null,
    acta_total_hours: Number(actaTotalHours.toFixed(2)),
    acta_overtime_hours: Number(actaOvertimeHours.toFixed(2)),
    real_overtime_hours: Number(realOvertimeHours.toFixed(6)),
    real_overtime_seconds: realOvertimeSeconds,
    overtime_observation: overtimeObservation,
  };
};

const buildGeoPoints = (record = {}) =>
  ATTENDANCE_GEO_FIELDS.reduce((points, field) => {
    const parsed = parseCoordinatePair(record[field.key]);
    if (!parsed) return points;

    points.push({
      type: field.type,
      label: sanitizeHtmlText(field.label),
      time: record[field.timeKey] || null,
      lat: parsed.lat,
      lng: parsed.lng,
    });
    return points;
  }, []);

const buildTimeOffDisplayLabel = (record = {}) => {
  if (normalizeToken(record?.time_off_type) !== "permiso") return null;
  if (Boolean(record?.time_off_is_emergency)) return "Permiso de emergencia";

  const subtype = normalizeToken(record?.time_off_subtype);
  if (!subtype) return "Permiso";
  return TIME_OFF_TYPE_LABELS[subtype] || `Permiso ${subtype.replace(/_/g, " ")}`;
};

const buildPermissionDetails = (record = {}) => {
  if (normalizeToken(record?.time_off_type) !== "permiso") {
    return {
      permission_exit_time: null,
      permission_return_time: null,
      permission_events: [],
      permission_label: null,
      permission_status: null,
      permission_request_id: null,
    };
  }

  const start = toDateOrNull(record?.time_off_start_at);
  const end = toDateOrNull(record?.time_off_end_at);
  const label = buildTimeOffDisplayLabel(record);
  const requestId = Number.parseInt(record?.time_off_id, 10);
  const hasWindow =
    start instanceof Date &&
    end instanceof Date &&
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    end > start;

  const permissionEvents = hasWindow
    ? [
        {
          key: "permission_exit",
          label: "Salida a permiso",
          time: start.toISOString(),
        },
        {
          key: "permission_return",
          label: "Entrada de permiso",
          time: end.toISOString(),
        },
      ]
    : [];

  return {
    permission_exit_time: hasWindow ? start.toISOString() : null,
    permission_return_time: hasWindow ? end.toISOString() : null,
    permission_events: permissionEvents,
    permission_label: label,
    permission_status: record?.time_off_status || null,
    permission_request_id: Number.isInteger(requestId) ? requestId : null,
  };
};

const buildPolylinePoints = (record = {}) => {
  const geoPointsByType = new Map(buildGeoPoints(record).map((point) => [point.type, point]));
  return ATTENDANCE_POLYLINE_ORDER
    .map((type) => geoPointsByType.get(type))
    .filter(Boolean)
    .map(({ lat, lng, type, label, time }) => ({ lat, lng, type, label, time }));
};

const filterAttendanceRowsByStatus = (rows = [], status) => {
  const normalizedStatus = normalizeAttendanceStateFilter(status);
  if (!normalizedStatus) return rows;
  return rows.filter((row) => deriveAttendanceState(row) === normalizedStatus);
};

const enrichAttendanceRowGeo = (record = {}) => ({
  ...record,
  attendance_status: deriveAttendanceState(record),
  attendance_status_label: ATTENDANCE_STATUS_LABELS[deriveAttendanceState(record)] || "Sin estado",
  fullname: sanitizeHtmlText(record.fullname),
  email: sanitizeHtmlText(record.email),
  department_name: sanitizeHtmlText(record.department_name),
  has_geo: deriveHasGeo(record),
  geo_points: buildGeoPoints(record),
  polyline_points: buildPolylinePoints(record),
  has_discrepancy: deriveHasDiscrepancy(record),
  ...buildPermissionDetails(record),
  ...buildAttendanceRegularization(record),
});

const enrichAttendanceRowsGeo = (rows = []) => rows.map((row) => enrichAttendanceRowGeo(row));

const buildAttendanceSummary = (rows = []) => {
  const initialSummary = {
    total: 0,
    filteredTotal: rows.length,
    withGeo: 0,
    withDiscrepancy: 0,
    byStatus: {
      no_entry: 0,
      working: 0,
      lunch_open: 0,
      completed: 0,
    },
  };

  return rows.reduce((acc, row) => {
    acc.total += 1;
    acc.byStatus[row.attendance_status] = (acc.byStatus[row.attendance_status] || 0) + 1;
    if (row.has_geo) acc.withGeo += 1;
    if (row.has_discrepancy) acc.withDiscrepancy += 1;
    return acc;
  }, initialSummary);
};

const buildAttendanceRangeQuery = async ({
  start,
  end,
  isAdminScope,
  hasExplicitTarget,
  targetUserId,
  userIds,
  departmentId,
  requesterId,
  status,
  onlyDiscrepancies,
  onlyWithGeo,
}) => {
  const capabilities = await loadAttendanceRangeCapabilities();
  const fieldEventsSelects = [];

  if (capabilities.hasClientVisitLogs) {
    fieldEventsSelects.push(`
          SELECT
            'client_entry'::text AS event_type,
            cvl.hora_entrada AS event_time,
            cvl.lat_entrada AS lat,
            cvl.lng_entrada AS lng,
            CASE
              WHEN cvl.is_planned IS TRUE THEN 'cronograma_cliente'
              ELSE 'cliente_emergencia'
            END AS source,
            cvl.client_request_id,
            NULL::text AS prospect_name
          FROM client_visit_logs cvl
          WHERE LOWER(COALESCE(cvl.user_email, '')) = LOWER(COALESCE(u.email, ''))
            AND cvl.visit_date = a.date
            AND cvl.hora_entrada IS NOT NULL
    `);

    fieldEventsSelects.push(`
          SELECT
            'client_exit'::text AS event_type,
            cvl.hora_salida AS event_time,
            cvl.lat_salida AS lat,
            cvl.lng_salida AS lng,
            CASE
              WHEN cvl.is_planned IS TRUE THEN 'cronograma_cliente'
              ELSE 'cliente_emergencia'
            END AS source,
            cvl.client_request_id,
            NULL::text AS prospect_name
          FROM client_visit_logs cvl
          WHERE LOWER(COALESCE(cvl.user_email, '')) = LOWER(COALESCE(u.email, ''))
            AND cvl.visit_date = a.date
            AND cvl.hora_salida IS NOT NULL
    `);
  }

  if (capabilities.hasProspectVisits) {
    fieldEventsSelects.push(`
          SELECT
            'client_entry'::text AS event_type,
            pv.check_in_time AS event_time,
            pv.check_in_lat AS lat,
            pv.check_in_lng AS lng,
            'prospecto'::text AS source,
            NULL::integer AS client_request_id,
            pv.prospect_name
          FROM prospect_visits pv
          WHERE LOWER(COALESCE(pv.user_email, '')) = LOWER(COALESCE(u.email, ''))
            AND pv.visit_date = a.date
            AND pv.check_in_time IS NOT NULL
    `);

    fieldEventsSelects.push(`
          SELECT
            'client_exit'::text AS event_type,
            pv.check_out_time AS event_time,
            pv.check_out_lat AS lat,
            pv.check_out_lng AS lng,
            'prospecto'::text AS source,
            NULL::integer AS client_request_id,
            pv.prospect_name
          FROM prospect_visits pv
          WHERE LOWER(COALESCE(pv.user_email, '')) = LOWER(COALESCE(u.email, ''))
            AND pv.visit_date = a.date
            AND pv.check_out_time IS NOT NULL
    `);
  }

  fieldEventsSelects.push(`
          SELECT
            'office_exit'::text AS event_type,
            e.start_time AS event_time,
            CASE
              WHEN strpos(COALESCE(e.start_location, ''), ',') > 0
              THEN NULLIF(trim(split_part(e.start_location, ',', 1)), '')::double precision
              ELSE NULL
            END AS lat,
            CASE
              WHEN strpos(COALESCE(e.start_location, ''), ',') > 0
              THEN NULLIF(trim(split_part(e.start_location, ',', 2)), '')::double precision
              ELSE NULL
            END AS lng,
            'salida_campo'::text AS source,
            NULL::integer AS client_request_id,
            NULL::text AS prospect_name
          FROM attendance_exceptions e
          WHERE e.user_id = a.user_id
            AND e.date = a.date
            AND e.start_time IS NOT NULL
  `);

  fieldEventsSelects.push(`
          SELECT
            'client_entry'::text AS event_type,
            e.arrival_time AS event_time,
            CASE
              WHEN strpos(COALESCE(e.arrival_location, ''), ',') > 0
              THEN NULLIF(trim(split_part(e.arrival_location, ',', 1)), '')::double precision
              ELSE NULL
            END AS lat,
            CASE
              WHEN strpos(COALESCE(e.arrival_location, ''), ',') > 0
              THEN NULLIF(trim(split_part(e.arrival_location, ',', 2)), '')::double precision
              ELSE NULL
            END AS lng,
            'llegada_cliente'::text AS source,
            NULL::integer AS client_request_id,
            NULL::text AS prospect_name
          FROM attendance_exceptions e
          WHERE e.user_id = a.user_id
            AND e.date = a.date
            AND e.arrival_time IS NOT NULL
  `);

  fieldEventsSelects.push(`
          SELECT
            'client_exit'::text AS event_type,
            e.departure_time AS event_time,
            CASE
              WHEN strpos(COALESCE(e.departure_location, ''), ',') > 0
              THEN NULLIF(trim(split_part(e.departure_location, ',', 1)), '')::double precision
              ELSE NULL
            END AS lat,
            CASE
              WHEN strpos(COALESCE(e.departure_location, ''), ',') > 0
              THEN NULLIF(trim(split_part(e.departure_location, ',', 2)), '')::double precision
              ELSE NULL
            END AS lng,
            'salida_cliente'::text AS source,
            NULL::integer AS client_request_id,
            NULL::text AS prospect_name
          FROM attendance_exceptions e
          WHERE e.user_id = a.user_id
            AND e.date = a.date
            AND e.departure_time IS NOT NULL
  `);

  fieldEventsSelects.push(`
          SELECT
            'office_entry'::text AS event_type,
            e.return_time AS event_time,
            CASE
              WHEN strpos(COALESCE(e.return_location, ''), ',') > 0
              THEN NULLIF(trim(split_part(e.return_location, ',', 1)), '')::double precision
              ELSE NULL
            END AS lat,
            CASE
              WHEN strpos(COALESCE(e.return_location, ''), ',') > 0
              THEN NULLIF(trim(split_part(e.return_location, ',', 2)), '')::double precision
              ELSE NULL
            END AS lng,
            'retorno_oficina'::text AS source,
            NULL::integer AS client_request_id,
            NULL::text AS prospect_name
          FROM attendance_exceptions e
          WHERE e.user_id = a.user_id
            AND e.date = a.date
            AND e.return_time IS NOT NULL
  `);

  const fieldEventsQuery = fieldEventsSelects.join("\n\n          UNION ALL\n");
  let query = `
      SELECT 
        a.*,
        u.fullname,
        u.email,
        u.role,
        d.name AS department_name,
        ex.exception_id,
        ex.exception_type,
         ex.exception_status,
         ex.exception_description,
         ex.operational_category,
         ex.operational_destination_label,
         ex.operational_destination_city,
         ex.start_time,
        ex.start_location,
        ex.arrival_time,
        ex.arrival_location,
        ex.departure_time,
        ex.departure_location,
        ex.return_time,
        ex.return_location,
        ex.op_lunch_start_time,
        ex.op_lunch_start_location,
        ex.op_lunch_end_time,
        ex.op_lunch_end_location,
        ex.odometer_start_km,
        ex.odometer_start_photo_drive_file_id,
        ex.odometer_start_photo_drive_url,
        ex.odometer_end_km,
        ex.odometer_distance_km,
        ex.odometer_end_photo_drive_file_id,
        ex.odometer_end_photo_drive_url,
        ex.operational_span_days,
        ex.operational_start_date,
        ex.operational_end_date,
        ex.operational_elapsed_hours,
        COALESCE(field_ops.field_events, '[]'::json) AS field_events,
        timeoff.id AS time_off_id,
        timeoff.tipo_solicitud AS time_off_type,
        timeoff.tipo_permiso AS time_off_subtype,
        timeoff.es_emergencia AS time_off_is_emergency,
        timeoff.status AS time_off_status,
        timeoff.fecha_inicio AS time_off_start_date,
        timeoff.fecha_fin AS time_off_end_date,
        timeoff.fecha_inicio_hora AS time_off_start_at,
        timeoff.fecha_fin_hora AS time_off_end_at
      FROM user_attendance_records a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN LATERAL (
        SELECT
          e.id AS exception_id,
          e.type AS exception_type,
           e.status AS exception_status,
           e.description AS exception_description,
           e.operational_category,
           e.operational_destination_label,
           e.operational_destination_city,
           e.start_time,
          e.start_location,
          e.arrival_time,
          e.arrival_location,
          e.departure_time,
          e.departure_location,
          e.return_time,
          e.return_location,
          e.op_lunch_start_time,
          e.op_lunch_start_location,
          e.op_lunch_end_time,
          e.op_lunch_end_location,
          e.odometer_start_km,
          e.odometer_start_photo_drive_file_id,
          e.odometer_start_photo_drive_url,
          e.odometer_end_km,
          e.odometer_distance_km,
          e.odometer_end_photo_drive_file_id,
          e.odometer_end_photo_drive_url,
          CASE
            WHEN LOWER(COALESCE(e.type, '')) = ANY(ARRAY['operacion_campo', 'operacion_de_campo', 'salida_oficina', 'viaje', 'campo']::text[])
              THEN GREATEST(
                1,
                (COALESCE((e.return_time AT TIME ZONE 'America/Guayaquil')::date, a.date) - e.date) + 1
              )::int
            ELSE NULL
          END AS operational_span_days,
          CASE
            WHEN LOWER(COALESCE(e.type, '')) = ANY(ARRAY['operacion_campo', 'operacion_de_campo', 'salida_oficina', 'viaje', 'campo']::text[])
              THEN e.date
            ELSE NULL
          END AS operational_start_date,
          CASE
            WHEN LOWER(COALESCE(e.type, '')) = ANY(ARRAY['operacion_campo', 'operacion_de_campo', 'salida_oficina', 'viaje', 'campo']::text[])
              THEN COALESCE((e.return_time AT TIME ZONE 'America/Guayaquil')::date, a.date)
            ELSE NULL
          END AS operational_end_date,
          CASE
            WHEN LOWER(COALESCE(e.type, '')) = ANY(ARRAY['operacion_campo', 'operacion_de_campo', 'salida_oficina', 'viaje', 'campo']::text[])
              THEN ROUND(
                EXTRACT(EPOCH FROM (
                  COALESCE(e.return_time, NOW()) - COALESCE(e.start_time, e.created_at)
                ))::numeric / 3600,
                2
              )
            ELSE NULL
          END AS operational_elapsed_hours
        FROM attendance_exceptions e
        WHERE e.user_id = a.user_id
          AND (
            e.date = a.date
            OR (
              LOWER(COALESCE(e.type, '')) = ANY(ARRAY['operacion_campo', 'operacion_de_campo', 'salida_oficina', 'viaje', 'campo']::text[])
              -- Fecha de negocio Ecuador (no UTC crudo): una operacion que termina
              -- entre 00:00-05:00 UTC sigue siendo el mismo dia de negocio en
              -- America/Guayaquil (offset -5). Sin esto, cualquier operacion que
              -- retorna de noche (19:00-23:59 hora Ecuador) se "filtraba" como
              -- multi-dia hacia el dia siguiente, pegando su op_lunch_location
              -- (de un almuerzo operacional viejo) al reporte del dia real.
              AND a.date BETWEEN e.date AND COALESCE((e.return_time AT TIME ZONE 'America/Guayaquil')::date, e.date)
            )
          )
        ORDER BY
          CASE WHEN e.date = a.date THEN 0 ELSE 1 END,
          COALESCE(e.start_time, e.created_at) DESC,
          e.id DESC
        LIMIT 1
      ) ex ON true
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(
            json_agg(
              json_build_object(
                'type', event_rows.event_type,
                'time', event_rows.event_time,
                'lat', event_rows.lat,
                'lng', event_rows.lng,
                'source', event_rows.source,
                'client_request_id', event_rows.client_request_id,
                'prospect_name', event_rows.prospect_name
              )
              ORDER BY event_rows.event_time ASC
            ),
            '[]'::json
          ) AS field_events
        FROM (
${fieldEventsQuery}
        ) event_rows
      ) field_ops ON true
      LEFT JOIN LATERAL (
        SELECT
          p.id,
          LOWER(COALESCE(p.tipo_solicitud, '')) AS tipo_solicitud,
          p.tipo_permiso,
          p.es_emergencia,
          p.status,
          p.fecha_inicio,
          p.fecha_fin,
          p.fecha_inicio_hora,
          p.fecha_fin_hora
        FROM permisos_vacaciones p
        WHERE LOWER(COALESCE(p.user_email, '')) = LOWER(COALESCE(u.email, ''))
          AND (
            LOWER(COALESCE(p.status, '')) IN ('approved', 'aprobado')
            OR (
              LOWER(COALESCE(p.status, '')) = 'partially_approved'
              AND p.aprobacion_final_at IS NOT NULL
            )
          )
          AND a.date BETWEEN COALESCE(p.fecha_inicio, a.date) AND COALESCE(p.fecha_fin, a.date)
        ORDER BY COALESCE(p.fecha_inicio_hora, p.fecha_inicio::timestamptz) DESC, p.id DESC
        LIMIT 1
      ) timeoff ON true
      WHERE a.date BETWEEN $1 AND $2
    `;

  const params = [start, end];
  const normalizedStatus = normalizeAttendanceStateFilter(status);
  const normalizedOnlyWithGeo = Boolean(onlyWithGeo);
  const normalizedOnlyDiscrepancies = Boolean(onlyDiscrepancies);
  const normalizedUserIds = Array.isArray(userIds)
    ? [...new Set(userIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))]
    : [];
  const normalizedDepartmentId = Number.isInteger(Number(departmentId)) && Number(departmentId) > 0
    ? Number(departmentId)
    : null;

  if (isAdminScope && hasExplicitTarget) {
    query += ` AND a.user_id = $${params.length + 1}`;
    params.push(targetUserId);
  } else if (isAdminScope && normalizedUserIds.length) {
    const placeholders = normalizedUserIds
      .map((_, index) => `$${params.length + index + 1}`)
      .join(", ");
    query += ` AND a.user_id IN (${placeholders})`;
    params.push(...normalizedUserIds);
  } else if (!isAdminScope) {
    query += ` AND a.user_id = $${params.length + 1}`;
    params.push(requesterId);
  }

  if (normalizedDepartmentId) {
    query += ` AND u.department_id = $${params.length + 1}`;
    params.push(normalizedDepartmentId);
  }

  query += " ORDER BY a.date DESC, u.fullname ASC";

  const isGlobalQuery = Boolean(isAdminScope && !hasExplicitTarget);
  const summarizeRows = (rows = []) => buildAttendanceSummary(rows);

  return {
    query,
    params,
    normalizedStatus,
    isGlobalQuery,
    summarizeRows,
    filterRows: (rows = []) => {
      const rowsByStatus = filterAttendanceRowsByStatus(rows, normalizedStatus);
      const enrichedRows = enrichAttendanceRowsGeo(rowsByStatus);
      const rowsByDiscrepancy = normalizedOnlyDiscrepancies
        ? enrichedRows.filter((row) => row.has_discrepancy)
        : enrichedRows;
      const finalRows = normalizedOnlyWithGeo
        ? rowsByDiscrepancy.filter((row) => row.has_geo)
        : rowsByDiscrepancy;
      return finalRows;
    },
  };
};

module.exports = {
  ATTENDANCE_STATUS_ALIASES,
  buildAttendanceRangeQuery,
  deriveAttendanceState,
  deriveHasGeo,
  deriveHasDiscrepancy,
  buildAttendanceSummary,
  buildGeoPoints,
  buildPolylinePoints,
  buildAttendanceRegularization,
  enrichAttendanceRowGeo,
  enrichAttendanceRowsGeo,
  filterAttendanceRowsByStatus,
  normalizeAttendanceStateFilter,
  isValidCoordinatePair,
  normalizeCoordinateString,
  sanitizeHtmlText,
};
