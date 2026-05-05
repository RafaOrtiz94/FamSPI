/**
 * src/modules/attendance/attendance.controller.js
 * -----------------------------------------------
 * ðŸ“‹ Attendance Tracking Controller
 * - Clock in/out endpoints
 * - Lunch break tracking
 * - Attendance record management
 * - Integration with user signatures
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const { normalizeDateTime, normalizeRow } = require("../../utils/normalizers");
const { getBusinessDate, ensureDailyClockIn } = require("./attendance.utils");
const { generateAttendancePDF } = require("./attendance.service");
const { hasReportingAccess } = require("./attendance.auth");
const { normalizeAttendanceRangeFilters } = require("./attendanceRangeFilters");
const { buildAttendanceRangeQuery } = require("./attendanceReports.service");
const { logAttendanceReportAccess } = require("./attendanceAudit.service");
const { getBusinessHours, isOffHours } = require("../../utils/offHoursPolicy");
const notificationManager = require("../notifications/notificationManager");
const { sendMail } = require("../../utils/mailer");
const { createTimeOffEvent } = require("../../utils/calendar");

const ATTENDANCE_LOCATION_TARGETS = Object.freeze({
  entry: { timeColumn: "entry_time", locationColumn: "entry_location" },
  lunch_start: { timeColumn: "lunch_start_time", locationColumn: "lunch_start_location" },
  lunch_end: { timeColumn: "lunch_end_time", locationColumn: "lunch_end_location" },
  exit: { timeColumn: "exit_time", locationColumn: "exit_location" },
});

const EXCEPTION_LOCATION_TARGETS = Object.freeze({
  start: { timeColumn: "start_time", locationColumn: "start_location" },
  arrival: { timeColumn: "arrival_time", locationColumn: "arrival_location" },
  departure: { timeColumn: "departure_time", locationColumn: "departure_location" },
  return: { timeColumn: "return_time", locationColumn: "return_location" },
});

const OPERATIONAL_EXCEPTION_TYPES = Object.freeze([
  "operacion_campo",
  "operacion_de_campo",
  "salida_oficina",
  "viaje",
  "campo",
]);

const isOperationalFlowException = (exception) => {
  const normalizedType = String(exception?.type || "").trim().toLowerCase();
  return OPERATIONAL_EXCEPTION_TYPES.includes(normalizedType);
};

const getActiveExceptionByFlow = async ({ userId, flow = "any" }) => {
  const baseQuery = `
    SELECT *
      FROM attendance_exceptions
     WHERE user_id = $1
       AND UPPER(COALESCE(status, '')) <> 'COMPLETED'
  `;
  let params = [userId];
  let flowFilter = "";

  if (flow === "operational") {
    params.push(OPERATIONAL_EXCEPTION_TYPES);
    flowFilter = " AND LOWER(COALESCE(type, '')) = ANY($2::text[])";
  } else if (flow === "unexpected") {
    params.push(OPERATIONAL_EXCEPTION_TYPES);
    flowFilter = " AND LOWER(COALESCE(type, '')) <> ALL($2::text[])";
  }

  const result = await db.query(`${baseQuery}${flowFilter} ORDER BY id DESC LIMIT 1`, params);
  return result.rows[0] || null;
};

const OPERATIONAL_SUMMARY_MARKER = "[RESUMEN_OPERACIONAL]";

const computeOperationalTracking = ({ startTime, endTime = null, now = new Date() }) => {
  const startDate = startTime ? new Date(startTime) : null;
  const endDate = endTime ? new Date(endTime) : now;

  if (!startDate || Number.isNaN(startDate.getTime()) || !endDate || Number.isNaN(endDate.getTime())) {
    return {
      operational_span_days: 0,
      operational_elapsed_hours: 0,
      operational_elapsed_minutes: 0,
      operational_start_date: null,
      operational_end_date: null,
    };
  }

  const startKey = getBusinessDate(startDate);
  const endKey = getBusinessDate(endDate);
  const startKeyDate = new Date(`${startKey}T00:00:00`);
  const endKeyDate = new Date(`${endKey}T00:00:00`);
  const rawSpanDays = Math.floor((endKeyDate.getTime() - startKeyDate.getTime()) / 86400000) + 1;
  const spanDays = Number.isFinite(rawSpanDays) && rawSpanDays > 0 ? rawSpanDays : 1;

  const elapsedMs = Math.max(0, endDate.getTime() - startDate.getTime());
  const elapsedHours = Number((elapsedMs / 3600000).toFixed(2));
  const elapsedMinutes = Math.max(0, Math.round(elapsedMs / 60000));

  return {
    operational_span_days: spanDays,
    operational_elapsed_hours: elapsedHours,
    operational_elapsed_minutes: elapsedMinutes,
    operational_start_date: startKey,
    operational_end_date: endKey,
  };
};

const appendOperationalSummary = ({ baseDescription, tracking }) => {
  const rawBase = String(baseDescription || "");
  const markerIndex = rawBase.indexOf(OPERATIONAL_SUMMARY_MARKER);
  const cleanBase = (markerIndex >= 0 ? rawBase.slice(0, markerIndex) : rawBase).trim();
  const summaryText = `${OPERATIONAL_SUMMARY_MARKER} Inicio: ${tracking.operational_start_date || "-"} | Cierre: ${
    tracking.operational_end_date || "-"
  } | Dias: ${tracking.operational_span_days} | Horas: ${tracking.operational_elapsed_hours}`;
  return [cleanBase, summaryText].filter(Boolean).join("\n");
};
const normalizeLocationInput = (rawLocation) => {
  if (rawLocation === null || rawLocation === undefined) return "";

  if (typeof rawLocation === "string") {
    const trimmed = rawLocation.trim();
    if (!trimmed) return "";

    const parts = trimmed.split(",");
    if (parts.length === 2) {
      const latitude = Number(parts[0]?.trim());
      const longitude = Number(parts[1]?.trim());
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return "";
        if (Math.abs(latitude) <= 0.0005 && Math.abs(longitude) <= 0.0005) return "";
      }
    }

    return trimmed;
  }

  if (typeof rawLocation === "object") {
    const latitude = Number(rawLocation.latitude ?? rawLocation.lat);
    const longitude = Number(rawLocation.longitude ?? rawLocation.lng);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return "";
      if (Math.abs(latitude) <= 0.0005 && Math.abs(longitude) <= 0.0005) return "";
      return `${latitude},${longitude}`;
    }
  }

  return String(rawLocation).trim();
};

const parseCoordinatePairInput = (rawLocation) => {
  const normalized = normalizeLocationInput(rawLocation);
  if (!normalized) return null;

  const parts = normalized.split(",");
  if (parts.length !== 2) return null;

  const latitude = Number(parts[0]?.trim());
  const longitude = Number(parts[1]?.trim());
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (Math.abs(latitude) <= 0.0005 && Math.abs(longitude) <= 0.0005) return null;

  return { latitude, longitude };
};

const ATTENDANCE_STATUS_LABELS = Object.freeze({
  no_entry: "Sin entrada",
  working: "Jornada abierta",
  lunch_open: "Almuerzo abierto",
  completed: "Jornada cerrada",
});
const TIME_OFF_LABELS = Object.freeze({
  permiso: "Permiso aprobado",
  vacaciones: "Vacaciones aprobadas",
});

const TALENTO_HUMANO_ALERT_ROLES = Object.freeze([
  "talento_humano",
  "jefe_talento_humano",
  "jefe_de_talento_humano",
  "analista_talento_humano",
  "asistente_talento_humano",
  "auxiliar_talento_humano",
  "rh",
  "rrhh",
]);
const TALENTO_HUMANO_ALERT_EMAIL = String(
  process.env.ATTENDANCE_TALENTO_HUMANO_ALERT_EMAIL || "talento.humano@fam-project.com"
).trim().toLowerCase();
const TEAM_ATTENDANCE_LEAD_ROLES = Object.freeze([
  "jefe_comercial",
  "jefe_de_comercial",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "jefe_ti",
  "jefe_logistica",
  "jefe_operaciones",
  "jefe_talento_humano",
  "jefe_de_talento_humano",
]);
const HR_DASHBOARD_ACCESS_ROLES = new Set([
  ...TALENTO_HUMANO_ALERT_ROLES,
  "admin",
  "administrador",
  "gerencia",
  "gerencia_general",
]);

const ATTENDANCE_EXIT_ALLOWED_START = process.env.ATTENDANCE_EXIT_ALLOWED_START || "16:00";
const ATTENDANCE_EXIT_ALLOWED_END = process.env.ATTENDANCE_EXIT_ALLOWED_END || "22:00";
const ATTENDANCE_STANDARD_WORK_HOURS = Number(process.env.ATTENDANCE_STANDARD_WORK_HOURS || 8);
const ATTENDANCE_WORKING_DAY_START = process.env.ATTENDANCE_WORKING_DAY_START || "09:00";
const ATTENDANCE_WORKING_DAY_END = process.env.ATTENDANCE_WORKING_DAY_END || "18:00";
const ATTENDANCE_LUNCH_START = process.env.ATTENDANCE_LUNCH_START || "13:00";
const ATTENDANCE_LUNCH_END = process.env.ATTENDANCE_LUNCH_END || "14:00";
const ATTENDANCE_OPERATIONAL_LUNCH_START = process.env.ATTENDANCE_OPERATIONAL_LUNCH_START || "14:00";
const ATTENDANCE_OPERATIONAL_LUNCH_END = process.env.ATTENDANCE_OPERATIONAL_LUNCH_END || "15:00";
const LATE_BASE_MINUTES = 9 * 60;
const LATE_TOLERANCE_MINUTES = 5;
const LATE_JUSTIFICATION_MONTHLY_LIMIT = Number(process.env.ATTENDANCE_LATE_JUSTIFICATION_MONTHLY_LIMIT || 5);
const LATE_JUSTIFICATION_CUTOFF_HOUR = Number(process.env.ATTENDANCE_LATE_JUSTIFICATION_CUTOFF_HOUR || 21);
const LATE_TIMEZONE = process.env.APP_TIMEZONE || process.env.TZ || "America/Guayaquil";
const LOCATION_MAX_ACCURACY_METERS = Number(process.env.ATTENDANCE_LOCATION_MAX_ACCURACY_METERS || 250);

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

const normalizeAttendanceStateFilter = (value) => {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ATTENDANCE_STATUS_ALIASES[normalized] || null;
};

const deriveAttendanceState = (record = {}) => {
  if (!record?.entry_time) {
    return "no_entry";
  }

  if (record?.exit_time) {
    return "completed";
  }

  if (record?.lunch_start_time && !record?.lunch_end_time) {
    return "lunch_open";
  }

  return "working";
};

const enrichAttendanceRow = (record = {}) => {
  const attendanceState = deriveAttendanceState(record);
  const timeOffType = normalizeTimeOffType(record?.time_off_type);
  const timeOffLabel = getTimeOffLabel(record);
  const hasTimeOff = Boolean(timeOffType);
  const attendanceLabel =
    hasTimeOff && attendanceState === "no_entry"
      ? timeOffLabel
      : ATTENDANCE_STATUS_LABELS[attendanceState] || "Sin estado";

  return {
    ...record,
    attendance_status: attendanceState,
    attendance_status_label: attendanceLabel,
    has_time_off: hasTimeOff,
    time_off_type: timeOffType,
    time_off_label: timeOffLabel,
  };
};

const enrichAttendanceRows = (rows = []) => rows.map((row) => enrichAttendanceRow(row));

const matchesAttendanceState = (record, statusFilter) => {
  const normalizedFilter = normalizeAttendanceStateFilter(statusFilter);
  if (!normalizedFilter) return true;
  return deriveAttendanceState(record) === normalizedFilter;
};

const parseClockHHMM = (value) => {
  const match = String(value || "").trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return (hours * 60) + minutes;
};

const toHHMM = (hours, minutes) => {
  const hh = String(Number(hours) || 0).padStart(2, "0");
  const mm = String(Number(minutes) || 0).padStart(2, "0");
  return `${hh}:${mm}`;
};

const normalizeHHMM = (value, fallback) => {
  const parsed = parseClockHHMM(value);
  if (!Number.isFinite(parsed)) return fallback;
  const hours = Math.floor(parsed / 60);
  const minutes = parsed % 60;
  return toHHMM(hours, minutes);
};

const getEcuadorClockParts = (dateValue = new Date()) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LATE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = parts.reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    dateKey: `${map.year}-${map.month}-${map.day}`,
  };
};

const computeLateMinutesFromEntry = (entryValue) => {
  const parts = getEcuadorClockParts(entryValue);
  if (!parts) return null;
  return (parts.hour * 60) + parts.minute - LATE_BASE_MINUTES;
};

const getLateCutoffIsoForDateKey = (dateKey) => {
  const [yearRaw, monthRaw, dayRaw] = String(dateKey || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const utcApprox = new Date(Date.UTC(year, month - 1, day, LATE_JUSTIFICATION_CUTOFF_HOUR, 0, 0));
  const offsetMs = 5 * 60 * 60 * 1000; // America/Guayaquil = UTC-5
  return new Date(utcApprox.getTime() + offsetMs).toISOString();
};

let lateJustificationTableReady = false;
const ensureLateJustificationTable = async () => {
  if (lateJustificationTableReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS attendance_late_justifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      attendance_date DATE NOT NULL,
      reason TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'approved',
      regularized_entry_time TIME NOT NULL DEFAULT '09:00:00',
      late_minutes INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, attendance_date)
    );
  `);
  lateJustificationTableReady = true;
};

let pendingLocationTableReady = false;
const ensurePendingLocationTable = async () => {
  if (pendingLocationTableReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS attendance_pending_locations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action_key TEXT NOT NULL,
      target_key TEXT,
      business_date DATE,
      payload JSONB,
      attempts INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      last_error TEXT,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_attendance_pending_locations_user_status
      ON attendance_pending_locations(user_id, status, created_at DESC);
  `);
  pendingLocationTableReady = true;
};

const getLocationAccuracyFromBody = (body = {}) => {
  const candidates = [
    body?.accuracy,
    body?.location_accuracy,
    body?.locationMeta?.accuracy,
    body?.location_meta?.accuracy,
  ];
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
};

const registerPendingLocationAttempt = async ({
  userId,
  actionKey,
  targetKey = null,
  businessDate = null,
  payload = null,
  errorMessage = "Ubicacion requerida",
}) => {
  await ensurePendingLocationTable();
  try {
    await db.query(
      `
        INSERT INTO attendance_pending_locations (
          user_id, action_key, target_key, business_date, payload, last_error, status
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'pending')
        ON CONFLICT (user_id, action_key, COALESCE(target_key, ''), COALESCE(business_date, '1970-01-01'::date))
        WHERE status = 'pending'
        DO UPDATE SET
          attempts   = attendance_pending_locations.attempts + 1,
          last_error = EXCLUDED.last_error,
          updated_at = NOW()
      `,
      [
        userId,
        String(actionKey || "attendance_mark"),
        targetKey ? String(targetKey) : null,
        businessDate || null,
        payload ? JSON.stringify(payload) : null,
        String(errorMessage || "Ubicacion requerida"),
      ],
    );
  } catch (insertErr) {
    logger.warn({ insertErr: insertErr?.message, userId, actionKey }, "registerPendingLocationAttempt failed (non-fatal)");
  }
};

const resolveRequiredLocation = async ({
  req,
  res,
  userId,
  actionKey,
  targetKey = null,
  businessDate = null,
}) => {
  const normalizedLocation = normalizeLocationInput(req?.body?.location) || null;
  const accuracy = getLocationAccuracyFromBody(req?.body || {});
  const payload = req?.body || null;

  if (!normalizedLocation) {
    await registerPendingLocationAttempt({
      userId,
      actionKey,
      targetKey,
      businessDate,
      payload,
      errorMessage: "Marcacion rechazada por falta de ubicacion valida",
    });
    logger.warn({ userId, actionKey, targetKey }, "Attendance mark rejected: missing location");
    res.status(422).json({
      ok: false,
      code: "LOCATION_REQUIRED_RETRY",
      message: "Ubicacion obligatoria. Reintenta cuando el GPS responda.",
    });
    return null;
  }

  if (Number.isFinite(accuracy) && accuracy > LOCATION_MAX_ACCURACY_METERS) {
    await registerPendingLocationAttempt({
      userId,
      actionKey,
      targetKey,
      businessDate,
      payload,
      errorMessage: `Marcacion rechazada por precision baja (${accuracy}m)`,
    });
    logger.warn({ userId, actionKey, targetKey, accuracy }, "Attendance mark rejected: low accuracy");
    res.status(422).json({
      ok: false,
      code: "LOCATION_ACCURACY_LOW",
      message: `Precision GPS insuficiente (${Math.round(accuracy)}m). Reintenta con mejor senal.`,
    });
    return null;
  }

  return normalizedLocation;
};

const getLateJustificationByDate = async ({ userId, attendanceDate }) => {
  await ensureLateJustificationTable();
  const result = await db.query(
    `
      SELECT *
      FROM attendance_late_justifications
      WHERE user_id = $1
        AND attendance_date = $2::date
      LIMIT 1
    `,
    [userId, attendanceDate]
  );
  return result.rows[0] || null;
};

const countLateJustificationsInMonth = async ({ userId, attendanceDate }) => {
  await ensureLateJustificationTable();
  const result = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM attendance_late_justifications
      WHERE user_id = $1
        AND status = 'approved'
        AND date_trunc('month', attendance_date) = date_trunc('month', $2::date)
    `,
    [userId, attendanceDate]
  );
  return Number(result.rows?.[0]?.total || 0);
};

const shouldMirrorAttendanceForFieldOp = (timestamp = new Date()) => {
  try {
    const evaluation = isOffHours(timestamp);
    return Boolean(evaluation?.isOffHours);
  } catch {
    return false;
  }
};

const syncNormalEntryFromFieldOp = async ({ userId, location, timestamp = new Date() }) => {
  const normalizedLocation = normalizeLocationInput(location) || null;

  // If the collaborator departs before the official workday start (e.g. 07:00 vs 09:00),
  // the acta RH-09 must reflect the official start time, not the real departure time.
  // real_entry_time stores what actually happened for operational traceability.
  const workyDayMinutes = parseClockHHMM(ATTENDANCE_WORKING_DAY_START) ?? (9 * 60);
  const clockParts = getEcuadorClockParts(timestamp);
  const realMinutes = clockParts ? (clockParts.hour * 60 + clockParts.minute) : workyDayMinutes;

  let officialEntryTime = timestamp;
  if (realMinutes < workyDayMinutes) {
    // Build a Date at the official start time on the same calendar day
    const officialHour = Math.floor(workyDayMinutes / 60);
    const officialMin = workyDayMinutes % 60;
    const d = new Date(timestamp);
    d.setHours(officialHour, officialMin, 0, 0);
    officialEntryTime = d;
  }

  return ensureDailyClockIn({
    userId,
    location: normalizedLocation,
    timestamp,
    officialEntryTime,
    entrySource: "field_op",
  });
};

const closePendingLunchForOperationalStart = async ({ userId, location, timestamp = new Date() }) => {
  const today = getBusinessDate(timestamp);
  const normalizedLocation = normalizeLocationInput(location) || null;
  const pendingLunchCheck = await db.query(
    `
      SELECT id
      FROM user_attendance_records
      WHERE user_id = $1
        AND date = $2
        AND lunch_start_time IS NOT NULL
        AND lunch_end_time IS NULL
      LIMIT 1
    `,
    [userId, today]
  );
  const hadPendingLunch = pendingLunchCheck.rowCount > 0;
  const result = await db.query(
    `
      UPDATE user_attendance_records
         SET lunch_end_time = COALESCE(lunch_end_time, $3),
             lunch_end_location = COALESCE(lunch_end_location, $4),
             updated_at = NOW()
       WHERE user_id = $1
         AND date = $2
         AND lunch_start_time IS NOT NULL
         AND lunch_end_time IS NULL
       RETURNING id
    `,
    [userId, today, timestamp, normalizedLocation]
  );
  if (result.rowCount > 0) {
    logger.info({ userId, today }, "[ATTENDANCE] Auto-closed open lunch on operational start");
  } else if (hadPendingLunch) {
    logger.warn(
      { userId, today },
      "[ATTENDANCE] Expected to auto-close lunch on operational start, but no row was updated"
    );
  }
};

const shouldMirrorRegularExitBySchedule = (timestamp = new Date()) => {
  const endMinutes = parseClockHHMM(ATTENDANCE_WORKING_DAY_END) ?? (18 * 60);
  const parts = getEcuadorClockParts(timestamp);
  const currentMinutes = parts ? (parts.hour * 60 + parts.minute) : (timestamp.getHours() * 60 + timestamp.getMinutes());
  return currentMinutes >= endMinutes;
};

const autoSeedScheduledLunchWindow = async ({ userId, location, timestamp = new Date() }) => {
  const lunchStartMinutes = parseClockHHMM(ATTENDANCE_LUNCH_START) ?? (13 * 60);
  const parts = getEcuadorClockParts(timestamp);
  const nowMinutes = parts ? (parts.hour * 60 + parts.minute) : (timestamp.getHours() * 60 + timestamp.getMinutes());
  if (nowMinutes >= lunchStartMinutes) return;

  const businessDate = getBusinessDate(timestamp);
  const lunchStartTime = buildDateTimeFromBusinessDate(businessDate, ATTENDANCE_LUNCH_START);
  const lunchEndTime = buildDateTimeFromBusinessDate(businessDate, ATTENDANCE_LUNCH_END);
  const normalizedLocation = normalizeLocationInput(location) || null;

  const result = await db.query(
    `
      UPDATE user_attendance_records
         SET lunch_start_time = COALESCE(lunch_start_time, $3),
             lunch_start_location = COALESCE(lunch_start_location, $4),
             lunch_end_time = COALESCE(lunch_end_time, $5),
             lunch_end_location = COALESCE(lunch_end_location, $4),
             updated_at = NOW()
       WHERE user_id = $1
         AND date = $2
         AND entry_time IS NOT NULL
       RETURNING id
    `,
    [userId, businessDate, lunchStartTime, normalizedLocation, lunchEndTime]
  );

  if (result.rowCount > 0) {
    logger.info(
      { userId, businessDate, lunchStart: ATTENDANCE_LUNCH_START, lunchEnd: ATTENDANCE_LUNCH_END },
      "[ATTENDANCE] Auto-seeded scheduled lunch window for field/unexpected flow"
    );
  }
};

// Seeds acta lunch window to 14:00-15:00 for collaborators with active operational exits.
// Always seeds regardless of current time (no hour check), and never overwrites an existing value.
const autoSeedOperationalLunchWindow = async ({ userId, location, timestamp = new Date() }) => {
  const businessDate = getBusinessDate(timestamp);
  const lunchStartTime = buildDateTimeFromBusinessDate(businessDate, ATTENDANCE_OPERATIONAL_LUNCH_START);
  const lunchEndTime = buildDateTimeFromBusinessDate(businessDate, ATTENDANCE_OPERATIONAL_LUNCH_END);
  const normalizedLocation = normalizeLocationInput(location) || null;

  const result = await db.query(
    `UPDATE user_attendance_records
        SET lunch_start_time = COALESCE(lunch_start_time, $3),
            lunch_start_location = COALESCE(lunch_start_location, $4),
            lunch_end_time = COALESCE(lunch_end_time, $5),
            lunch_end_location = COALESCE(lunch_end_location, $4),
            updated_at = NOW()
      WHERE user_id = $1
        AND date = $2
        AND entry_time IS NOT NULL
      RETURNING id`,
    [userId, businessDate, lunchStartTime, normalizedLocation, lunchEndTime]
  );

  if (result.rowCount > 0) {
    logger.info(
      { userId, businessDate, lunchStart: ATTENDANCE_OPERATIONAL_LUNCH_START, lunchEnd: ATTENDANCE_OPERATIONAL_LUNCH_END },
      "[ATTENDANCE] Auto-seeded operational lunch window (14:00-15:00) in acta"
    );
  }
};

const syncNormalExitFromFieldOp = async ({ userId, location, timestamp = new Date() }) => {
  const today = getBusinessDate(timestamp);
  const attendanceResult = await db.query(
    `
      SELECT id, entry_time, lunch_start_time, lunch_end_time, exit_time
      FROM user_attendance_records
      WHERE user_id = $1 AND date = $2
      LIMIT 1
    `,
    [userId, today]
  );

  const record = attendanceResult.rows[0];
  if (!record?.entry_time || record?.exit_time) {
    return { updated: false, reason: "no_open_attendance" };
  }

  // Auto-close an open lunch so worked time is calculated correctly
  let lunchEndResolved = record.lunch_end_time ? new Date(record.lunch_end_time) : null;
  if (record?.lunch_start_time && !record?.lunch_end_time) {
    lunchEndResolved = timestamp;
    await db.query(
      `UPDATE user_attendance_records
          SET lunch_end_time = $1, lunch_end_location = COALESCE(lunch_end_location, $2), updated_at = NOW()
        WHERE id = $3`,
      [timestamp, normalizedLocation, record.id]
    ).catch((err) => logger.warn({ err: err?.message }, "[ATTENDANCE] Failed to auto-close lunch in syncNormalExitFromFieldOp"));
  }

  const entryTime = new Date(record.entry_time);
  let workedMs = timestamp - entryTime;

  if (record?.lunch_start_time && lunchEndResolved) {
    const lunchStart = new Date(record.lunch_start_time);
    workedMs -= (lunchEndResolved - lunchStart);
  }

  const workedHours = workedMs / (1000 * 60 * 60);
  const standardWorkHours =
    Number.isFinite(ATTENDANCE_STANDARD_WORK_HOURS) && ATTENDANCE_STANDARD_WORK_HOURS > 0
      ? ATTENDANCE_STANDARD_WORK_HOURS
      : 8;
  const overtimeHours = workedHours > standardWorkHours ? workedHours - standardWorkHours : 0;

  const normalizedLocation = normalizeLocationInput(location) || null;
  const updated = await db.query(
    `
      UPDATE user_attendance_records
         SET exit_time = $1,
             exit_location = COALESCE($4, exit_location),
             is_overtime = $5,
             overtime_hours = $6,
             total_hours = $7,
             updated_at = NOW()
       WHERE user_id = $2
         AND date = $3
         AND exit_time IS NULL
       RETURNING id, user_id, date, entry_time, exit_time, total_hours, overtime_hours;
    `,
    [
      timestamp,
      userId,
      today,
      normalizedLocation,
      overtimeHours > 0,
      overtimeHours,
      workedHours,
    ]
  );

  return {
    updated: Boolean(updated.rows[0]),
    data: updated.rows[0] || null,
  };
};

const buildDateTimeFromBusinessDate = (businessDate, hhmm) => {
  const normalized = normalizeHHMM(hhmm, "00:00");
  return new Date(`${businessDate}T${normalized}:00`);
};

const getBusinessDateFromStringDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return getBusinessDate(date);
};

const addBusinessDays = (businessDate, days) => {
  const base = new Date(`${businessDate}T00:00:00`);
  base.setDate(base.getDate() + days);
  return getBusinessDate(base);
};

const upsertOperationalAttendanceSkeleton = async ({ userId, businessDate, entryTime, location }) => {
  try {
    await ensureDailyClockIn({
      userId,
      location,
      timestamp: entryTime,
      officialEntryTime: entryTime,
      entrySource: "field_op",
    });
  } catch (err) {
    if (err?.code !== "42P10") throw err;

    const existing = await db.query(
      `SELECT id, entry_time
         FROM user_attendance_records
        WHERE user_id = $1 AND date = $2
        LIMIT 1`,
      [userId, businessDate]
    );

    if (existing.rows.length) {
      await db.query(
        `UPDATE user_attendance_records
            SET entry_time = COALESCE(entry_time, $3),
                entry_location = COALESCE(entry_location, $4),
                updated_at = NOW()
          WHERE user_id = $1 AND date = $2`,
        [userId, businessDate, entryTime, location || null]
      );
      return;
    }

    await db.query(
      `INSERT INTO user_attendance_records (user_id, date, entry_time, entry_location)
       VALUES ($1, $2, $3, $4)`,
      [userId, businessDate, entryTime, location || null]
    );
  }
};

const autoCompleteOperationalAttendanceSpan = async ({
  userId,
  operationalException,
  location = null,
  now = new Date(),
}) => {
  if (!operationalException?.start_time) {
    return { updatedDays: 0 };
  }

  const MAX_OPERATIONAL_SPAN_DAYS = 30;

  const startDateKey = getBusinessDateFromStringDate(operationalException.start_time);
  const todayKey = getBusinessDate(now);
  const startDate = new Date(`${startDateKey}T00:00:00`);
  const endDate = new Date(`${todayKey}T00:00:00`);
  const rawTotalDays = Math.max(0, Math.floor((endDate - startDate) / 86400000));
  if (rawTotalDays > MAX_OPERATIONAL_SPAN_DAYS) {
    logger.warn(
      { userId, exceptionId: operationalException.id, rawTotalDays },
      `[ATTENDANCE] Operational span exceeds ${MAX_OPERATIONAL_SPAN_DAYS} days — capping auto-complete`,
    );
  }
  const totalDays = Math.min(rawTotalDays, MAX_OPERATIONAL_SPAN_DAYS);

  const normalizedLocation = normalizeLocationInput(location) || null;
  let updatedDays = 0;

  for (let offset = 0; offset <= totalDays; offset += 1) {
    const businessDate = addBusinessDays(startDateKey, offset);
    const entryTime = buildDateTimeFromBusinessDate(businessDate, ATTENDANCE_WORKING_DAY_START);
    const lunchStartTime = buildDateTimeFromBusinessDate(businessDate, ATTENDANCE_LUNCH_START);
    const lunchEndTime = buildDateTimeFromBusinessDate(businessDate, ATTENDANCE_LUNCH_END);
    const exitTime = buildDateTimeFromBusinessDate(businessDate, ATTENDANCE_WORKING_DAY_END);

    const shouldMarkEntry = entryTime.getTime() <= now.getTime();
    if (!shouldMarkEntry) continue;

    await upsertOperationalAttendanceSkeleton({
      userId,
      businessDate,
      entryTime,
      location: normalizedLocation,
    });

    const applyLunchStart = lunchStartTime.getTime() <= now.getTime() ? lunchStartTime : null;
    const applyLunchEnd = lunchEndTime.getTime() <= now.getTime() ? lunchEndTime : null;
    const applyExit = exitTime.getTime() <= now.getTime() ? exitTime : null;

    await db.query(
      `
      UPDATE user_attendance_records
         SET lunch_start_time = COALESCE(lunch_start_time, $3),
             lunch_start_location = COALESCE(lunch_start_location, $6),
             lunch_end_time = COALESCE(lunch_end_time, $4),
             lunch_end_location = COALESCE(lunch_end_location, $6),
             exit_time = COALESCE(exit_time, $5),
             exit_location = COALESCE(exit_location, $6),
             updated_at = NOW()
       WHERE user_id = $1
         AND date = $2
      `,
      [userId, businessDate, applyLunchStart, applyLunchEnd, applyExit, normalizedLocation]
    );

    updatedDays += 1;
  }

  return { updatedDays };
};

const isOutsideAllowedExitSchedule = (dateValue) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const startMinutes = parseClockHHMM(ATTENDANCE_EXIT_ALLOWED_START);
  const endMinutes = parseClockHHMM(ATTENDANCE_EXIT_ALLOWED_END);
  if (startMinutes === null || endMinutes === null) return false;

  const parts = getEcuadorClockParts(date);
  const currentMinutes = parts ? (parts.hour * 60 + parts.minute) : (date.getHours() * 60 + date.getMinutes());
  if (startMinutes <= endMinutes) {
    return currentMinutes < startMinutes || currentMinutes > endMinutes;
  }
  // Rango que cruza medianoche (ej. 22:00-06:00)
  return currentMinutes > endMinutes && currentMinutes < startMinutes;
};

const parseBooleanFlag = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value || "").trim().toLowerCase();
  return ["true", "1", "yes", "si", "on"].includes(normalized);
};

const isExceptionMarkedAsJustified = (payload = {}) => {
  const rawFlag = payload?.isJustified ?? payload?.is_justified ?? payload?.justified;
  if (rawFlag === undefined || rawFlag === null || rawFlag === "") {
    return false;
  }
  return parseBooleanFlag(rawFlag);
};

const resolveActorDisplayName = (user = {}) =>
  String(user.fullname || user.name || user.email || user.username || `Usuario ${user.id || ""}`).trim();

const normalizeRoleToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const hasTeamAttendanceLeadAccess = (user = {}) => {
  const roleTokens = [
    user?.role,
    user?.scope,
    user?.role_name,
    user?.rol,
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.scopes) ? user.scopes : []),
  ]
    .map(normalizeRoleToken)
    .filter(Boolean);

  return roleTokens.some((role) => TEAM_ATTENDANCE_LEAD_ROLES.includes(role));
};

const hasHrDashboardAccess = (user = {}) => {
  const roleTokens = [
    user?.role,
    user?.scope,
    user?.role_name,
    user?.rol,
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.scopes) ? user.scopes : []),
  ]
    .map(normalizeRoleToken)
    .filter(Boolean);

  return roleTokens.some((role) => HR_DASHBOARD_ACCESS_ROLES.has(role));
};

const getRequesterDepartmentId = async (userId) => {
  const result = await db.query("SELECT department_id FROM users WHERE id = $1 LIMIT 1", [userId]);
  const departmentId = Number(result.rows?.[0]?.department_id || 0);
  return Number.isInteger(departmentId) && departmentId > 0 ? departmentId : null;
};

const buildIrregularityNotificationText = ({
  collaboratorName,
  collaboratorEmail,
  exceptionType,
  detail,
  occurredAt,
}) => {
  const whenLabel = normalizeDateTime(occurredAt) || new Date(occurredAt).toISOString();
  return [
    `Colaborador: ${collaboratorName || collaboratorEmail || "No disponible"}`,
    `Email: ${collaboratorEmail || "No disponible"}`,
    `Tipo de excepcion: ${exceptionType}`,
    `Detalle: ${detail}`,
    `Fecha/Hora: ${whenLabel}`,
  ].join("\n");
};

const sendTalentoHumanoMailboxEmail = async ({
  collaboratorName,
  collaboratorEmail,
  exceptionType,
  detail,
  occurredAt = new Date(),
}) => {
  if (!TALENTO_HUMANO_ALERT_EMAIL) return;

  const whenLabel = normalizeDateTime(occurredAt) || new Date(occurredAt).toISOString();
  const subject = `[Asistencia] ${exceptionType} - ${collaboratorName || collaboratorEmail || "Colaborador"}`;
  const text = [
    "Se detectó una irregularidad de asistencia.",
    "",
    `Colaborador: ${collaboratorName || "No disponible"}`,
    `Email: ${collaboratorEmail || "No disponible"}`,
    `Tipo: ${exceptionType}`,
    `Detalle: ${detail}`,
    `Fecha/Hora: ${whenLabel}`,
  ].join("\n");

  try {
    await sendMail({
      to: TALENTO_HUMANO_ALERT_EMAIL,
      subject,
      text,
      source: "attendance.irregularity.mailbox",
    });
  } catch (error) {
    logger.error(
      { error: error?.message, mailbox: TALENTO_HUMANO_ALERT_EMAIL, exceptionType, collaboratorEmail },
      "[ATTENDANCE] Error enviando correo al buzón de Talento Humano"
    );
  }
};

const notifyTalentoHumanoAttendanceIrregularity = async ({
  collaboratorId,
  collaboratorName,
  collaboratorEmail,
  exceptionType,
  detail,
  occurredAt = new Date(),
  meta = {},
}) => {
  await sendTalentoHumanoMailboxEmail({
    collaboratorName,
    collaboratorEmail,
    exceptionType,
    detail,
    occurredAt,
  });

  try {
    const { rows } = await db.query(
      `
      SELECT id, email, fullname
      FROM users
      WHERE LOWER(COALESCE(role, '')) = ANY($1)
      `,
      [TALENTO_HUMANO_ALERT_ROLES]
    );

    const recipients = (rows || [])
      .filter((row) => Number(row.id) > 0)
      .reduce((acc, row) => {
        if (!acc.some((item) => Number(item.id) === Number(row.id))) {
          acc.push(row);
        }
        return acc;
      }, []);

    if (!recipients.length) {
      logger.warn(
        { collaboratorId, exceptionType },
        "[ATTENDANCE] No hay usuarios de Talento Humano para notificar irregularidad"
      );
      return;
    }

    const title = "Irregularidad de asistencia detectada";
    const customMessage = buildIrregularityNotificationText({
      collaboratorName,
      collaboratorEmail,
      exceptionType,
      detail,
      occurredAt,
    });

    for (const recipient of recipients) {
      try {
        await notificationManager.sendNotification({
          userId: recipient.id,
          template: "custom_html",
          customTitle: title,
          customMessage,
          type: "alert",
          priority: 3,
          source: "attendance.irregularity",
          meta: {
            collaborator_id: collaboratorId || null,
            collaborator_email: collaboratorEmail || null,
            collaborator_name: collaboratorName || null,
            exception_type: exceptionType,
            occurred_at: new Date(occurredAt).toISOString(),
            ...meta,
          },
          email: true,
          chat: false,
        });
      } catch (notifyError) {
        logger.error(
          {
            error: notifyError?.message,
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            collaboratorId,
            exceptionType,
          },
          "[ATTENDANCE] Error notificando irregularidad a Talento Humano"
        );
      }
    }
  } catch (error) {
    logger.error(
      { error: error?.message, collaboratorId, exceptionType },
      "[ATTENDANCE] Fallo preparando notificaciones de irregularidad"
    );
  }
};

const normalizeTimeOffType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "vacaciones") return "vacaciones";
  if (normalized === "permiso") return "permiso";
  return null;
};

const getTimeOffLabel = (record = {}) => {
  const normalizedType = normalizeTimeOffType(record?.time_off_type);
  if (!normalizedType) return null;
  return TIME_OFF_LABELS[normalizedType] || "Tiempo no laborable aprobado";
};

const findActiveTimeOffForMarking = async ({ userEmail, now, businessDate }) => {
  const normalizedEmail = String(userEmail || "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { rows } = await db.query(
    `
    SELECT
      id,
      tipo_solicitud,
      tipo_permiso,
      fecha_inicio,
      fecha_fin,
      fecha_inicio_hora,
      fecha_fin_hora,
      status
    FROM permisos_vacaciones
    WHERE LOWER(COALESCE(user_email, '')) = $1
      AND LOWER(COALESCE(status, '')) IN ('approved', 'aprobado')
      AND (
        (
          fecha_inicio_hora IS NOT NULL
          AND fecha_fin_hora IS NOT NULL
          AND $2::timestamptz BETWEEN fecha_inicio_hora AND fecha_fin_hora
        )
        OR
        (
          (fecha_inicio_hora IS NULL OR fecha_fin_hora IS NULL)
          AND $3::date BETWEEN COALESCE(fecha_inicio, $3::date) AND COALESCE(fecha_fin, $3::date)
        )
      )
    ORDER BY COALESCE(fecha_inicio_hora, fecha_inicio::timestamptz) DESC, id DESC
    LIMIT 1
    `,
    [normalizedEmail, now, businessDate]
  );

  return rows?.[0] || null;
};

const enforceNoActiveTimeOffForMarking = async ({ res, userEmail, now }) => {
  const businessDate = getBusinessDate(now);
  const activeTimeOff = await findActiveTimeOffForMarking({ userEmail, now, businessDate });
  if (!activeTimeOff) return true;

  const type = normalizeTimeOffType(activeTimeOff.tipo_solicitud) || "permiso";
  const label = TIME_OFF_LABELS[type] || "Tiempo no laborable aprobado";

  res.status(409).json({
    ok: false,
    code: "TIME_OFF_ACTIVE",
    message: `No puedes marcar asistencia mientras tengas ${label.toLowerCase()} activo.`,
    data: {
      timeOffType: type,
      timeOffLabel: label,
      startDate: activeTimeOff.fecha_inicio || null,
      endDate: activeTimeOff.fecha_fin || null,
      startAt: activeTimeOff.fecha_inicio_hora || null,
      endAt: activeTimeOff.fecha_fin_hora || null,
      tipoPermiso: activeTimeOff.tipo_permiso || null,
    },
  });
  return false;
};

/**
 * ðŸ• Clock In - Record entry time
 * POST /api/attendance/clock-in
 * Body: { location: "lat,lng" }
 */
const clockIn = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const now = new Date();
    const today = getBusinessDate(now);
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "clock-in",
      targetKey: "entry",
      businessDate: today,
    });
    if (!normalizedLocation) return;

    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }

    // Sync the regular attendance record and pre-fill lunch ONLY when the collaborator
    // has an active exception (operational or unexpected flow). Regular collaborators with
    // no active exception must mark entry and lunch manually at the real times.
    const activeAnyException = await getActiveExceptionByFlow({ userId, flow: "any" });
    if (activeAnyException) {
      await syncNormalEntryFromFieldOp({ userId, location: normalizedLocation, timestamp: now });
      // Pre-fill operational lunch window (14:00-15:00) only for operational exits.
      if (isOperationalFlowException(activeAnyException)) {
        await autoSeedOperationalLunchWindow({ userId, location: normalizedLocation, timestamp: now });
      }
    }
    const ensured = await ensureDailyClockIn({ userId, location: normalizedLocation, timestamp: now });

    if (!ensured.created) {
      if (normalizedLocation && !ensured.data?.entry_location) {
        const today = getBusinessDate(now);
        const syncResult = await db.query(
          `
          UPDATE user_attendance_records
          SET entry_location = COALESCE(NULLIF(entry_location, ''), $3),
              updated_at = NOW()
          WHERE user_id = $1
            AND date = $2
            AND entry_time IS NOT NULL
          RETURNING *;
          `,
          [userId, today, normalizedLocation]
        );

        if (syncResult.rows[0]) {
          logger.info(`[ATTENDANCE] Clock in location synced: ${email} at ${now.toISOString()} loc: ${normalizedLocation}`);
          return res.status(200).json({
            ok: true,
            message: "Entrada ya registrada; ubicaciÃ³n sincronizada correctamente",
            data: syncResult.rows[0],
          });
        }
      }

      return res.status(400).json({
        ok: false,
        message: "Ya has marcado entrada hoy",
        data: ensured.data,
      });
    }

    const lateMinutes = computeLateMinutesFromEntry(now);
    if (Number.isFinite(lateMinutes) && lateMinutes > LATE_TOLERANCE_MINUTES) {
      notifyTalentoHumanoAttendanceIrregularity({
        collaboratorId: userId,
        collaboratorName: resolveActorDisplayName({ id: userId, email }),
        collaboratorEmail: email || null,
        exceptionType: "LLEGADA_TARDE_MAYOR_A_5_MIN",
        detail: `Entrada registrada con ${lateMinutes} minutos de atraso (tolerancia: ${LATE_TOLERANCE_MINUTES} min).`,
        occurredAt: now,
        meta: {
          attendance_date: today,
          late_minutes: lateMinutes,
          tolerance_minutes: LATE_TOLERANCE_MINUTES,
          location: normalizedLocation,
        },
      }).catch((err) => logger.error({ err }, "[ATTENDANCE] Error notificando llegada tarde (non-fatal)"));
    }

    logger.info(`[ATTENDANCE] Clock in: ${email} at ${now.toISOString()} loc: ${normalizedLocation || "n/a"}`);

    return res.status(200).json({
      ok: true,
      message: "Entrada registrada correctamente",
      data: ensured.data,
    });
  } catch (err) {
    logger.error({ err }, "âŒ Error en clock-in");
    return res.status(500).json({
      ok: false,
      message: "Error registrando entrada",
    });
  }
};

/**
 * ðŸ½ï¸ Clock Out for Lunch - Record lunch start time
 * POST /api/attendance/clock-out-lunch
 * Body: { location }
 */
const clockOutLunch = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const now = new Date();
    const today = getBusinessDate(now);
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "clock-out-lunch",
      targetKey: "lunch_start",
      businessDate: today,
    });
    if (!normalizedLocation) return;

    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }

    // Check if record exists
    const existing = await db.query(
      "SELECT id, entry_time, lunch_start_time FROM user_attendance_records WHERE user_id = $1 AND date = $2",
      [userId, today]
    );

    if (existing.rows.length === 0 || !existing.rows[0].entry_time) {
      return res.status(400).json({
        ok: false,
        message: "Debes marcar entrada primero",
      });
    }

    if (existing.rows[0].lunch_start_time) {
      return res.status(400).json({
        ok: false,
        message: "Ya has marcado salida a almuerzo",
        data: existing.rows[0],
      });
    }

    const activeOperational = await getActiveExceptionByFlow({ userId, flow: "operational" });
    let lunchStartTime = now;
    let realLunchStartTime = null;

    if (activeOperational) {
      const parts = String(today).split('-');
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      lunchStartTime = new Date(Date.UTC(year, month, day, 19, 0, 0)); // 19 UTC is 14:00 local
      realLunchStartTime = now;
    }

    let result;
    try {
      result = await db.query(
        `
        UPDATE user_attendance_records
        SET lunch_start_time = $1, 
            lunch_start_location = $4, 
            real_lunch_start_time = COALESCE(real_lunch_start_time, $5),
            updated_at = NOW()
        WHERE user_id = $2 AND date = $3
        RETURNING *;
        `,
        [lunchStartTime, userId, today, normalizedLocation, realLunchStartTime]
      );
    } catch (dbErr) {
      if (dbErr?.code === "42703") {
        result = await db.query(
          `
          UPDATE user_attendance_records
          SET lunch_start_time = $1, 
              lunch_start_location = $4, 
              updated_at = NOW()
          WHERE user_id = $2 AND date = $3
          RETURNING *;
          `,
          [lunchStartTime, userId, today, normalizedLocation]
        );
      } else {
        throw dbErr;
      }
    }

    logger.info(`[ATTENDANCE] Lunch start: ${email} at ${now.toISOString()} loc: ${normalizedLocation || "n/a"}`);

    return res.status(200).json({
      ok: true,
      message: "Salida a almuerzo registrada",
      nextStep: activeOperational ? "almuerzo_entrada" : null,
      data: {
        ...result.rows[0],
        operational_status: activeOperational ? "ON_LUNCH" : null,
      }
    });
  } catch (err) {
    logger.error({ err }, "❌ Error en clock-out-lunch");
    return res.status(500).json({
      ok: false,
      message: "Error registrando salida a almuerzo",
    });
  }
};

/**
 * 🍴 Clock In from Lunch - Record lunch end time
 * POST /api/attendance/clock-in-lunch
 * Body: { location }
 */
const clockInLunch = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const now = new Date();
    const today = getBusinessDate(now);
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "clock-in-lunch",
      targetKey: "lunch_end",
      businessDate: today,
    });
    if (!normalizedLocation) return;

    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }

    // Check if record exists
    const existing = await db.query(
      "SELECT id, lunch_start_time, lunch_end_time FROM user_attendance_records WHERE user_id = $1 AND date = $2",
      [userId, today]
    );

    if (existing.rows.length === 0 || !existing.rows[0].lunch_start_time) {
      return res.status(400).json({
        ok: false,
        message: "Debes marcar salida a almuerzo primero",
      });
    }

    if (existing.rows[0].lunch_end_time) {
      return res.status(400).json({
        ok: false,
        message: "Ya has marcado regreso de almuerzo",
        data: existing.rows[0],
      });
    }

    const activeOperational = await getActiveExceptionByFlow({ userId, flow: "operational" });
    let lunchEndTime = now;
    let realLunchEndTime = null;

    if (activeOperational) {
      const parts = String(today).split('-');
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      lunchEndTime = new Date(Date.UTC(year, month, day, 20, 0, 0)); // 20 UTC is 15:00 local
      realLunchEndTime = now;
    }

    let result;
    try {
      result = await db.query(
        `
        UPDATE user_attendance_records
        SET lunch_end_time = $1, 
            lunch_end_location = $4, 
            real_lunch_end_time = COALESCE(real_lunch_end_time, $5),
            updated_at = NOW()
        WHERE user_id = $2 AND date = $3
        RETURNING *;
        `,
        [lunchEndTime, userId, today, normalizedLocation, realLunchEndTime]
      );
    } catch (dbErr) {
      if (dbErr?.code === "42703") {
        result = await db.query(
          `
          UPDATE user_attendance_records
          SET lunch_end_time = $1, 
              lunch_end_location = $4, 
              updated_at = NOW()
          WHERE user_id = $2 AND date = $3
          RETURNING *;
          `,
          [lunchEndTime, userId, today, normalizedLocation]
        );
      } else {
        throw dbErr;
      }
    }

    const lunchStartAt = existing?.rows?.[0]?.lunch_start_time ? new Date(existing.rows[0].lunch_start_time) : null;
    const lunchEndAt = realLunchEndTime || lunchEndTime;
    if (lunchStartAt instanceof Date && !Number.isNaN(lunchStartAt.getTime()) && lunchEndAt instanceof Date && !Number.isNaN(lunchEndAt.getTime())) {
      const lunchDurationMinutes = Math.round((lunchEndAt.getTime() - lunchStartAt.getTime()) / 60000);
      if (lunchDurationMinutes > 60) {
        notifyTalentoHumanoAttendanceIrregularity({
          collaboratorId: userId,
          collaboratorName: resolveActorDisplayName({ id: userId, email }),
          collaboratorEmail: email || null,
          exceptionType: "ALMUERZO_SUPERIOR_A_60_MIN",
          detail: `Regreso de almuerzo con duración de ${lunchDurationMinutes} minutos.`,
          occurredAt: now,
          meta: {
            attendance_date: today,
            lunch_duration_minutes: lunchDurationMinutes,
            lunch_threshold_minutes: 60,
            location: normalizedLocation,
          },
        }).catch((err) => logger.error({ err }, "[ATTENDANCE] Error notificando almuerzo largo (non-fatal)"));
      }
    }

    logger.info(`[ATTENDANCE] Lunch end: ${email} at ${now.toISOString()} loc: ${normalizedLocation || "n/a"}`);

    return res.status(200).json({
      ok: true,
      message: "Regreso de almuerzo registrado",
      nextStep: activeOperational ? "entrada_cliente" : null,
      data: {
        ...result.rows[0],
        operational_status: activeOperational ? activeOperational.status : null,
      }
    });
  } catch (err) {
    logger.error({ err }, "âŒ Error en clock-in-lunch");
    return res.status(500).json({
      ok: false,
      message: "Error registrando regreso de almuerzo",
    });
  }
};

/**
 * ðŸ Clock Out - Record exit time
 * POST /api/attendance/clock-out
 * Body: { location, isOvertime: boolean }
 */
const clockOut = async (req, res) => {
  try {
    const { id: userId, email, fullname, name } = req.user || {};
    const { isOvertime } = req.body;

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const now = new Date();
    const today = getBusinessDate(now);
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "clock-out",
      targetKey: "exit",
      businessDate: today,
    });
    if (!normalizedLocation) return;

    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }

    // Check if record exists
    const existing = await db.query(
      "SELECT id, entry_time, exit_time, overtime_hours FROM user_attendance_records WHERE user_id = $1 AND date = $2",
      [userId, today]
    );

    if (existing.rows.length === 0 || !existing.rows[0].entry_time) {
      return res.status(400).json({
        ok: false,
        message: "Debes marcar entrada primero",
      });
    }

    if (existing.rows[0].exit_time) {
      return res.status(400).json({
        ok: false,
        message: "Ya has marcado salida",
        data: existing.rows[0],
      });
    }

    // Calculate worked hours and determine if overtime
    const entryTime = new Date(existing.rows[0].entry_time);
    let workedMs = now - entryTime;

    // Subtract lunch break if exists
    const lunchQuery = await db.query(
      "SELECT lunch_start_time, lunch_end_time FROM user_attendance_records WHERE user_id = $1 AND date = $2",
      [userId, today]
    );

    if (lunchQuery.rows[0]?.lunch_start_time && lunchQuery.rows[0]?.lunch_end_time) {
      const lunchStart = new Date(lunchQuery.rows[0].lunch_start_time);
      const lunchEnd = new Date(lunchQuery.rows[0].lunch_end_time);
      workedMs -= (lunchEnd - lunchStart);
    }

    const workedHours = workedMs / (1000 * 60 * 60);
    const standardWorkHours =
      Number.isFinite(ATTENDANCE_STANDARD_WORK_HOURS) && ATTENDANCE_STANDARD_WORK_HOURS > 0
        ? ATTENDANCE_STANDARD_WORK_HOURS
        : 8; // Jornada laboral estandar
    const overtimeHours = workedHours > standardWorkHours ? workedHours - standardWorkHours : 0;
    const overtimeDeclared = parseBooleanFlag(isOvertime);
    const isOvertimeMarked = overtimeDeclared || overtimeHours > 0;

    // Update exit time, location, and overtime info
    const result = await db.query(
      `
      UPDATE user_attendance_records
      SET exit_time = $1, exit_location = $4, is_overtime = $5, overtime_hours = $6, total_hours = $7, updated_at = NOW()
      WHERE user_id = $2 AND date = $3
      RETURNING *;
      `,
      [now, userId, today, normalizedLocation, isOvertimeMarked, overtimeHours, workedHours]
    );

    const collaboratorName = resolveActorDisplayName({
      id: userId,
      email,
      fullname,
      name,
    });

    const irregularities = [];
    if (isOutsideAllowedExitSchedule(now)) {
      irregularities.push({
        type: "SALIDA_FUERA_HORARIO_PERMITIDO",
        detail: `Salida registrada fuera del horario permitido (${ATTENDANCE_EXIT_ALLOWED_START}-${ATTENDANCE_EXIT_ALLOWED_END}).`,
      });
    }

    if (overtimeDeclared && overtimeHours > 3) {
      irregularities.push({
        type: "HORAS_EXTRA_MAYOR_A_3",
        detail: `Se marcaron horas extra con ${overtimeHours.toFixed(2)} horas acumuladas.`,
      });
    }

    if (irregularities.length) {
      Promise.all(
        irregularities.map((irregularity) =>
          notifyTalentoHumanoAttendanceIrregularity({
            collaboratorId: userId,
            collaboratorName,
            collaboratorEmail: email || null,
            exceptionType: irregularity.type,
            detail: irregularity.detail,
            occurredAt: now,
            meta: {
              attendance_date: today,
              location: normalizedLocation,
              overtime_declared: overtimeDeclared,
              overtime_hours: Number(overtimeHours.toFixed(2)),
              worked_hours: Number(workedHours.toFixed(2)),
            },
          })
        )
      ).catch((err) => logger.error({ err }, "[ATTENDANCE] Error notificando irregularidades en clock-out (non-fatal)"));
    }

    const message = overtimeHours > 0
      ? `Salida registrada. Has trabajado ${overtimeHours.toFixed(1)} horas extra.`
      : "Salida registrada correctamente";

    logger.info(`[ATTENDANCE] Clock out: ${email} at ${now.toISOString()} loc: ${normalizedLocation || "n/a"} overtime: ${overtimeHours.toFixed(2)}h`);

    return res.status(200).json({
      ok: true,
      message,
      data: result.rows[0],
      overtime: overtimeHours > 0 ? {
        hours: overtimeHours,
        isSignificant: overtimeHours > 2 // MÃ¡s de 2 horas extra es significativo
      } : null
    });
  } catch (err) {
    logger.error({ err }, "âŒ Error en clock-out");
    return res.status(500).json({
      ok: false,
      message: "Error registrando salida",
    });
  }
};

/**
 * âš ï¸ Register Exception (Salida Inesperada - Step 1/4)
 * POST /api/attendance/exception
 * Body: { type, description, location, isJustified?: boolean }
 */
const registerException = async (req, res) => {
  try {
    const { id: userId, email, fullname, name } = req.user || {};
    const { type, description } = req.body;
    const descriptionText = String(description || "").trim();
    const exceptionIsJustified = isExceptionMarkedAsJustified(req.body);

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }
    if (!type || !descriptionText) {
      return res.status(400).json({ ok: false, message: "Tipo y descripciÃ³n requeridos" });
    }

    const now = new Date();
    const today = getBusinessDate(now);
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "register-exception",
      targetKey: "start",
      businessDate: today,
    });
    if (!normalizedLocation) return;

    // Check if there is already an active exception
    const active = await db.query(
      "SELECT id FROM attendance_exceptions WHERE user_id = $1 AND UPPER(COALESCE(status, '')) <> 'COMPLETED'",
      [userId]
    );

    if (active.rows.length > 0) {
      return res.status(400).json({
        ok: false,
        message: "Ya tienes una salida en curso. ComplÃ©tala antes de iniciar otra."
      });
    }

    // Step 1: Start (Exit Office)
    const result = await db.query(
      `
      INSERT INTO attendance_exceptions (
        user_id, date, type, description, 
        start_time, start_location, 
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
      RETURNING *;
      `,
      [userId, today, type, descriptionText, now, normalizedLocation]
    );

    if (!exceptionIsJustified) {
      notifyTalentoHumanoAttendanceIrregularity({
        collaboratorId: userId,
        collaboratorName: resolveActorDisplayName({ id: userId, email, fullname, name }),
        collaboratorEmail: email || null,
        exceptionType: "EXCEPCION_NO_JUSTIFICADA",
        detail: `${descriptionText} (Tipo: ${String(type || "GENERAL").toUpperCase()})`,
        occurredAt: now,
        meta: {
          exception_id: result.rows[0]?.id || null,
          exception_status: result.rows[0]?.status || "ACTIVE",
          exception_type_input: String(type || "").trim() || null,
          exception_justified: false,
          location: normalizedLocation,
        },
      }).catch((err) => logger.error({ err }, "[ATTENDANCE] Error notificando excepcion no justificada (non-fatal)"));
    }

    logger.info(`[ATTENDANCE] Exception Start: ${email} - ${type}`);

    return res.status(200).json({
      ok: true,
      message: "Salida registrada. Notifica cuando llegues a tu destino.",
      data: result.rows[0],
    });
  } catch (err) {
    logger.error({ err }, "âŒ Error en register-exception");
    return res.status(500).json({
      ok: false,
      message: "Error registrando excepciÃ³n",
    });
  }
};

/**
 * ðŸ”„ Update Exception Status (Steps 2, 3, 4)
 * POST /api/attendance/exception/status
 * Body: { status, location }
 * Status: 'ON_SITE' (Llegada), 'RETURNING' (Salida Destino), 'COMPLETED' (Regreso Oficina)
 */
const updateExceptionStatus = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const { status } = req.body;

    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const now = new Date();
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "update-exception-status",
      targetKey: String(status || "").trim().toLowerCase() || null,
      businessDate: getBusinessDate(now),
    });
    if (!normalizedLocation) return;

    // Get active exception
    const active = await db.query(
      "SELECT * FROM attendance_exceptions WHERE user_id = $1 AND UPPER(COALESCE(status, '')) <> 'COMPLETED' ORDER BY id DESC LIMIT 1",
      [userId]
    );

    if (active.rows.length === 0) {
      return res.status(404).json({ ok: false, message: "No tienes ninguna salida en curso" });
    }

    const exceptionId = active.rows[0].id;
    let updateQuery = "";
    let params = [];
    let message = "";

    if (status === 'ON_SITE') {
      updateQuery = "UPDATE attendance_exceptions SET status = 'ON_SITE', arrival_time = $1, arrival_location = $2, updated_at = NOW() WHERE id = $3 RETURNING *";
      params = [now, normalizedLocation, exceptionId];
      message = "Llegada registrada. Notifica cuando salgas del destino.";
    } else if (status === 'RETURNING') {
      updateQuery = "UPDATE attendance_exceptions SET status = 'RETURNING', departure_time = COALESCE(departure_time, $1), departure_location = COALESCE(departure_location, $2), updated_at = NOW() WHERE id = $3 RETURNING *";
      params = [now, normalizedLocation, exceptionId];
      message = "Salida de destino registrada. Notifica cuando regreses a la oficina.";
    } else if (status === 'COMPLETED') {
      updateQuery = "UPDATE attendance_exceptions SET status = 'COMPLETED', return_time = COALESCE(return_time, $1), return_location = COALESCE(return_location, $2), end_time = COALESCE(end_time, $1), end_location = COALESCE(end_location, $2), updated_at = NOW() WHERE id = $3 RETURNING *";
      params = [now, normalizedLocation, exceptionId];
      message = "Regreso a oficina registrado. Ciclo completado.";
    } else {
      return res.status(400).json({ ok: false, message: "Estado invalido" });
    }

    let updateResult;
    try {
      updateResult = await db.query(updateQuery, params);
    } catch (queryErr) {
      if (queryErr?.code === "42703") {
        // Fallback for DBs missing end_time/end_location/updated_at (pre-migration 158)
        const fallbackQueryMap = {
          ON_SITE: "UPDATE attendance_exceptions SET status = 'ON_SITE', arrival_time = $1, arrival_location = $2 WHERE id = $3 RETURNING *",
          RETURNING: "UPDATE attendance_exceptions SET status = 'RETURNING', departure_time = COALESCE(departure_time, $1), departure_location = COALESCE(departure_location, $2) WHERE id = $3 RETURNING *",
          COMPLETED: "UPDATE attendance_exceptions SET status = 'COMPLETED', return_time = COALESCE(return_time, $1), return_location = COALESCE(return_location, $2) WHERE id = $3 RETURNING *",
        };
        const fallback = fallbackQueryMap[status];
        if (!fallback) throw queryErr;
        updateResult = await db.query(fallback, params);
      } else {
        throw queryErr;
      }
    }
    const updated = { rows: updateResult.rows.length ? updateResult.rows : [] };
    if (!updated.rows.length) {
      const refetch = await db.query("SELECT * FROM attendance_exceptions WHERE id = $1", [exceptionId]);
      updated.rows = refetch.rows;
    }

    logger.info(`[ATTENDANCE] Exception Update: ${email} - ${status}`);

    return res.status(200).json({
      ok: true,
      message,
      data: updated.rows[0]
    });

  } catch (err) {
    logger.error({ err }, "âŒ Error en update-exception");
    return res.status(500).json({ ok: false, message: "Error actualizando estado de excepciÃ³n" });
  }
};

/**
 * ðŸ“‹ Get Active Exception - Get current user's active exception
 * GET /api/attendance/exception/active
 */
  const getActiveException = async (req, res) => {
  try {
    const { id: userId } = req.user || {};
    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    // Get active exception (not completed)
    const result = await db.query(
      "SELECT * FROM attendance_exceptions WHERE user_id = $1 AND UPPER(COALESCE(status, '')) <> 'COMPLETED' ORDER BY id DESC LIMIT 1",
      [userId]
    );

    const normalizedExceptionBase = result.rows[0]
      ? normalizeRow(result.rows[0], [
          "timestamp",
          "start_time",
          "arrival_time",
          "departure_time",
          "return_time",
          "created_at",
          "updated_at",
        ])
      : null;

    const normalizedException = normalizedExceptionBase
      ? {
          ...normalizedExceptionBase,
          ...(isOperationalFlowException(normalizedExceptionBase)
            ? computeOperationalTracking({
                startTime: normalizedExceptionBase.start_time,
                endTime: normalizedExceptionBase.end_time || null,
                now: new Date(),
              })
            : {}),
        }
      : null;

    return res.status(200).json({
      ok: true,
      data: normalizedException,
    });
  } catch (err) {
    logger.error({ err }, "âŒ Error obteniendo excepciÃ³n activa");
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo excepciÃ³n activa",
    });
  }
};

/**
 * ðŸ“… Get Today's Attendance - For current user
 * GET /api/attendance/today
 */
const getToday = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const now = new Date();
    const today = getBusinessDate(now);
    const activeOperational = await getActiveExceptionByFlow({ userId, flow: "operational" });
    if (activeOperational) {
      await autoCompleteOperationalAttendanceSpan({
        userId,
        operationalException: activeOperational,
        location: activeOperational.start_location || null,
        now,
      });
    }

    const result = await db.query(
      "SELECT * FROM user_attendance_records WHERE user_id = $1 AND date = $2",
      [userId, today]
    );

    // Aplicar normalizacion usando helper compartido
    const data = result.rows[0] ? enrichAttendanceRow(normalizeRow(result.rows[0], [
      'date', 'entry_time', 'lunch_start_time', 'lunch_end_time', 'exit_time',
      'created_at', 'updated_at', 'auto_shift_end_at', 'auto_closed_at',
      'overtime_start_at', 'entry_location_timestamp', 'lunch_start_location_timestamp',
      'lunch_end_location_timestamp', 'exit_location_timestamp'
    ], ['overtime_hours', 'total_hours'])) : null;

    const activeFieldVisitResult = await db.query(
      `
        SELECT *
        FROM (
          SELECT
            'client'::text AS visit_scope,
            cvl.id,
            cvl.client_request_id AS client_id,
            NULL::text AS prospect_name,
            cvl.status,
            cvl.visit_date,
            cvl.hora_entrada AS entry_time,
            cvl.hora_salida AS exit_time
          FROM client_visit_logs cvl
          WHERE LOWER(COALESCE(cvl.user_email, '')) = LOWER($1)
            AND cvl.status = 'in_visit'
            AND cvl.visit_date >= ($2::date - INTERVAL '1 day')::date

          UNION ALL

          SELECT
            'prospect'::text AS visit_scope,
            pv.id,
            NULL::integer AS client_id,
            pv.prospect_name,
            pv.status,
            pv.visit_date,
            pv.check_in_time AS entry_time,
            pv.check_out_time AS exit_time
          FROM prospect_visits pv
          WHERE LOWER(COALESCE(pv.user_email, '')) = LOWER($1)
            AND pv.status = 'in_visit'
            AND pv.visit_date >= ($2::date - INTERVAL '1 day')::date
        ) visits
        ORDER BY entry_time DESC NULLS LAST, id DESC
        LIMIT 1
      `,
      [email || "", today]
    );
    const activeFieldVisit = activeFieldVisitResult.rows[0]
      ? normalizeRow(activeFieldVisitResult.rows[0], ["visit_date", "entry_time", "exit_time"])
      : null;

    const activeTimeOff = await findActiveTimeOffForMarking({
      userEmail: req.user?.email || null,
      now,
      businessDate: today,
    });
    const lateJustification = await getLateJustificationByDate({
      userId,
      attendanceDate: today,
    });
    const usedJustifications = await countLateJustificationsInMonth({
      userId,
      attendanceDate: today,
    });
    const remainingJustifications = Math.max(0, LATE_JUSTIFICATION_MONTHLY_LIMIT - usedJustifications);
    const lateMinutes = computeLateMinutesFromEntry(data?.entry_time);
    const isLate = Number.isFinite(lateMinutes) && lateMinutes > LATE_TOLERANCE_MINUTES;
    const cutoffIso = getLateCutoffIsoForDateKey(today);
    const cutoffReached = cutoffIso ? now.getTime() >= new Date(cutoffIso).getTime() : false;

    const latePolicy = {
      timezone: LATE_TIMEZONE,
      baseTime: "09:00",
      toleranceMinutes: LATE_TOLERANCE_MINUTES,
      monthlyLimit: LATE_JUSTIFICATION_MONTHLY_LIMIT,
      cutoffHour: `${String(LATE_JUSTIFICATION_CUTOFF_HOUR).padStart(2, "0")}:00`,
      lateMinutes: Number.isFinite(lateMinutes) ? lateMinutes : null,
      isLate,
      hasTimeOff: Boolean(activeTimeOff),
      cutoffAt: cutoffIso,
      cutoffReached,
      justification: {
        exists: Boolean(lateJustification),
        reason: lateJustification?.reason || null,
        status: lateJustification?.status || null,
        remainingMonthly: remainingJustifications,
        usedMonthly: usedJustifications,
        canJustify: Boolean(
          isLate &&
          !activeTimeOff &&
          !lateJustification &&
          remainingJustifications > 0 &&
          !cutoffReached
        ),
      },
      countsAsLate: Boolean(
        isLate &&
        !activeTimeOff &&
        !lateJustification &&
        (remainingJustifications <= 0 || cutoffReached)
      ),
      regularized: Boolean(lateJustification),
      regularizedEntryTime: lateJustification?.regularized_entry_time || null,
    };

    return res.status(200).json({
      ok: true,
      data: {
        ...(data || {}),
        active_field_visit: activeFieldVisit,
        late_policy: latePolicy,
      },
    });
  } catch (err) {
    logger.error({ err }, "âŒ Error obteniendo asistencia de hoy");
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo asistencia",
    });
  }
};

/**
 * ðŸ‘¤ Get User Attendance - For specific date
 * GET /api/attendance/user/:userId?date=YYYY-MM-DD
 */
const getUserAttendance = async (req, res) => {
  try {
    const requesterId = Number(req.user?.id || 0);
    const { userId } = req.params;
    const { date, status } = req.query;

    if (!date) {
      return res.status(400).json({
        ok: false,
        message: "Fecha requerida (formato: YYYY-MM-DD)",
      });
    }

    const targetUserId = Number(userId);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({
        ok: false,
        message: "Usuario requerido",
      });
    }

    if (targetUserId !== requesterId && !hasReportingAccess(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para ver asistencia de otros usuarios",
      });
    }

    const result = await db.query(
      `
      SELECT 
        a.*,
        u.fullname,
        u.email,
        u.role
      FROM user_attendance_records a
      JOIN users u ON a.user_id = u.id
      WHERE a.user_id = $1 AND a.date = $2
      `,
      [targetUserId, date]
    );

    const normalizedRow = result.rows[0] ? enrichAttendanceRow(result.rows[0]) : null;

    if (normalizedRow && !matchesAttendanceState(normalizedRow, status)) {
      return res.status(200).json({
        ok: true,
        data: null,
      });
    }

    return res.status(200).json({
      ok: true,
      data: normalizedRow,
    });
  } catch (err) {
    logger.error({ err }, "âŒ Error obteniendo asistencia de usuario");
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo asistencia",
    });
  }
};

/**
 * ðŸ“Š Get Attendance Range - For reporting (calidad dashboard)
 * GET /api/attendance/range?start=YYYY-MM-DD&end=YYYY-MM-DD&userId=123
 */
const getRange = async (req, res) => {
  try {
    const requesterId = Number(req.user?.id || 0);
    const {
      start,
      end,
      status,
      userId,
      userIds,
      departmentId,
      onlyDiscrepancies,
      onlyWithGeo,
      quickRange,
      timezone,
      rangeDays,
      exceedsRecommendedRange,
      dateRangeError,
    } = normalizeAttendanceRangeFilters(req.query);

    if (!start || !end) {
      return res.status(400).json({
        ok: false,
        message: "Fechas de inicio y fin requeridas",
      });
    }

    if (dateRangeError) {
      return res.status(400).json({
        ok: false,
        message: "La fecha de fin no puede ser anterior a la fecha de inicio",
      });
    }

    const normalizedStatus = normalizeAttendanceStateFilter(status);
    if (status && !normalizedStatus) {
      return res.status(400).json({
        ok: false,
        message: "Estado de asistencia invalido",
      });
    }

    const hasExplicitTarget = userId && String(userId).toLowerCase() !== "all";
    const wantsGlobalScope = String(userId || "").toLowerCase() === "all";
    const targetUserId = hasExplicitTarget ? Number(userId) : requesterId;
    const isAdminScope = hasReportingAccess(req.user);

    if (hasExplicitTarget && !Number.isFinite(targetUserId)) {
      return res.status(400).json({
        ok: false,
        message: "Usuario requerido",
      });
    }

    if (hasExplicitTarget && targetUserId !== requesterId && !isAdminScope) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para consultar asistencia de otros usuarios",
      });
    }

    if (wantsGlobalScope && !isAdminScope) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para consultar asistencia global",
      });
    }

      const { query, params, filterRows } = await buildAttendanceRangeQuery({
        start,
        end,
        isAdminScope,
        hasExplicitTarget,
        targetUserId,
        userIds,
        departmentId,
        requesterId,
        status: normalizedStatus,
        onlyDiscrepancies,
        onlyWithGeo,
      });

    const result = await db.query(query, params);
    const normalizedRows = enrichAttendanceRows(result.rows);
    const filteredRows = (filterRows(result.rows) || []).map((row) => enrichAttendanceRow(row));

    const summary = filteredRows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc.byStatus[row.attendance_status] = (acc.byStatus[row.attendance_status] || 0) + 1;
        if (row.has_geo) acc.withGeo += 1;
        if (row.has_discrepancy) acc.withDiscrepancy += 1;
        return acc;
      },
      {
        total: 0,
        byStatus: {
          no_entry: 0,
          working: 0,
          lunch_open: 0,
          completed: 0,
        },
        withGeo: 0,
        withDiscrepancy: 0,
      }
    );

        const offHoursConfig = getBusinessHours();

        const responsePayload = {
          ok: true,
          total: normalizedRows.length,
          filteredTotal: filteredRows.length,
          status: normalizedStatus || "all",
          summary: {
          ...summary,
          filteredTotal: filteredRows.length,
            labels: ATTENDANCE_STATUS_LABELS,
          },
          data: filteredRows,
        meta: {
          start,
          end,
          timezone,
          businessHours: {
            timezone: offHoursConfig?.timezone || "America/Guayaquil",
            workDays: Array.isArray(offHoursConfig?.workDays) ? offHoursConfig.workDays : [1, 2, 3, 4, 5],
            start: toHHMM(offHoursConfig?.startHour, offHoursConfig?.startMinute),
            end: toHHMM(offHoursConfig?.endHour, offHoursConfig?.endMinute),
          },
          workingHours: {
            timezone: offHoursConfig?.timezone || "America/Guayaquil",
            workDays: Array.isArray(offHoursConfig?.workDays) ? offHoursConfig.workDays : [1, 2, 3, 4, 5],
            start: normalizeHHMM(ATTENDANCE_WORKING_DAY_START, "09:00"),
            end: normalizeHHMM(ATTENDANCE_WORKING_DAY_END, "18:00"),
          },
          standardWorkHours:
            Number.isFinite(ATTENDANCE_STANDARD_WORK_HOURS) && ATTENDANCE_STANDARD_WORK_HOURS > 0
              ? ATTENDANCE_STANDARD_WORK_HOURS
              : 8,
          userId,
          userIds,
          departmentId,
          status: normalizedStatus || null,
          quickRange,
          onlyDiscrepancies,
          onlyWithGeo,
          rangeDays,
          exceedsRecommendedRange,
            warnings: exceedsRecommendedRange
              ? ["El rango seleccionado supera los 31 dias recomendados"]
              : [],
          },
        };

        logAttendanceReportAccess({
          requester: req.user || {},
          filters: {
            start,
            end,
            status: normalizedStatus,
            userId,
            userIds,
            departmentId,
            onlyDiscrepancies,
            onlyWithGeo,
            quickRange,
            timezone,
          },
          result: {
            total: responsePayload.total,
            filteredTotal: responsePayload.filteredTotal,
            warnings: responsePayload.meta.warnings,
          },
        });

        return res.status(200).json(responsePayload);
  } catch (err) {
    logger.error(
      {
        err,
        requesterId: Number(req.user?.id || 0),
        range: {
          start: req.query?.start || null,
          end: req.query?.end || null,
          userId: req.query?.userId || null,
        },
      },
      'Error obteniendo rango de asistencia'
    );
    return res.status(500).json({
      ok: false,
      message: 'Error obteniendo registros de asistencia',
    });
  }
};

const stripOvertimeFieldsFromRows = (rows = []) =>
  (Array.isArray(rows) ? rows : []).map((row = {}) => {
    const nextRow = { ...row };
    delete nextRow.overtime_hours;
    delete nextRow.is_overtime;
    delete nextRow.overtime_start_at;
    delete nextRow.acta_overtime_hours;
    delete nextRow.real_overtime_hours;
    delete nextRow.overtime_observation;
    return nextRow;
  });

const getTeamRange = async (req, res) => {
  try {
    const requesterId = Number(req.user?.id || 0);
    if (!requesterId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    if (!hasTeamAttendanceLeadAccess(req.user || {})) {
      return res.status(403).json({
        ok: false,
        code: "ATTENDANCE_TEAM_FORBIDDEN",
        message: "Solo jefaturas pueden consultar asistencia por equipo",
      });
    }

    const requesterDepartmentId = await getRequesterDepartmentId(requesterId);
    if (!requesterDepartmentId) {
      return res.status(400).json({
        ok: false,
        message: "No tienes un departamento asignado para consultar asistencia de equipo",
      });
    }

    const {
      start,
      end,
      status,
      userIds,
      onlyDiscrepancies,
      onlyWithGeo,
      quickRange,
      timezone,
      rangeDays,
      exceedsRecommendedRange,
      dateRangeError,
    } = normalizeAttendanceRangeFilters(req.query);

    if (!start || !end) {
      return res.status(400).json({ ok: false, message: "Fechas de inicio y fin requeridas" });
    }
    if (dateRangeError) {
      return res.status(400).json({
        ok: false,
        message: "La fecha de fin no puede ser anterior a la fecha de inicio",
      });
    }

    const normalizedStatus = normalizeAttendanceStateFilter(status);
    if (status && !normalizedStatus) {
      return res.status(400).json({ ok: false, message: "Estado de asistencia invalido" });
    }

    const { query, params, filterRows } = await buildAttendanceRangeQuery({
      start,
      end,
      isAdminScope: true,
      hasExplicitTarget: false,
      targetUserId: null,
      userIds,
      departmentId: requesterDepartmentId,
      requesterId,
      status: normalizedStatus,
      onlyDiscrepancies,
      onlyWithGeo,
    });

    const result = await db.query(query, params);
    const normalizedRows = enrichAttendanceRows(result.rows);
    const filteredRows = stripOvertimeFieldsFromRows(
      (filterRows(result.rows) || []).map((row) => enrichAttendanceRow(row))
    );

    const summary = filteredRows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc.byStatus[row.attendance_status] = (acc.byStatus[row.attendance_status] || 0) + 1;
        if (row.has_geo) acc.withGeo += 1;
        if (row.has_discrepancy) acc.withDiscrepancy += 1;
        return acc;
      },
      {
        total: 0,
        byStatus: {
          no_entry: 0,
          working: 0,
          lunch_open: 0,
          completed: 0,
        },
        withGeo: 0,
        withDiscrepancy: 0,
      }
    );

    const offHoursConfig = getBusinessHours();
    return res.status(200).json({
      ok: true,
      total: normalizedRows.length,
      filteredTotal: filteredRows.length,
      status: normalizedStatus || "all",
      summary: {
        ...summary,
        filteredTotal: filteredRows.length,
        labels: ATTENDANCE_STATUS_LABELS,
      },
      data: filteredRows,
      meta: {
        start,
        end,
        timezone,
        teamScope: true,
        departmentId: requesterDepartmentId,
        businessHours: {
          timezone: offHoursConfig?.timezone || "America/Guayaquil",
          workDays: Array.isArray(offHoursConfig?.workDays) ? offHoursConfig.workDays : [1, 2, 3, 4, 5],
          start: toHHMM(offHoursConfig?.startHour, offHoursConfig?.startMinute),
          end: toHHMM(offHoursConfig?.endHour, offHoursConfig?.endMinute),
        },
        workingHours: {
          timezone: offHoursConfig?.timezone || "America/Guayaquil",
          workDays: Array.isArray(offHoursConfig?.workDays) ? offHoursConfig.workDays : [1, 2, 3, 4, 5],
          start: normalizeHHMM(ATTENDANCE_WORKING_DAY_START, "09:00"),
          end: normalizeHHMM(ATTENDANCE_WORKING_DAY_END, "18:00"),
        },
        standardWorkHours:
          Number.isFinite(ATTENDANCE_STANDARD_WORK_HOURS) && ATTENDANCE_STANDARD_WORK_HOURS > 0
            ? ATTENDANCE_STANDARD_WORK_HOURS
            : 8,
        status: normalizedStatus || null,
        quickRange,
        onlyDiscrepancies,
        onlyWithGeo,
        rangeDays,
        exceedsRecommendedRange,
        warnings: exceedsRecommendedRange ? ["El rango seleccionado supera los 31 dias recomendados"] : [],
      },
    });
  } catch (err) {
    logger.error({ err }, "Error obteniendo reporte de asistencia por equipo");
    return res.status(500).json({ ok: false, message: "Error obteniendo reporte de asistencia por equipo" });
  }
};

const getAttendanceNonCompliance = async (req, res) => {
  try {
    if (!hasHrDashboardAccess(req.user || {})) {
      return res.status(403).json({
        ok: false,
        code: "ATTENDANCE_NON_COMPLIANCE_FORBIDDEN",
        message: "No tienes permisos para consultar incumplimientos de horario",
      });
    }

    await ensureLateJustificationTable();

    const days = Math.max(1, Math.min(30, Number.parseInt(req.query?.days, 10) || 7));
    const result = await db.query(
      `
      WITH base AS (
        SELECT
          a.user_id,
          a.date,
          a.entry_time,
          a.lunch_start_time,
          a.lunch_end_time,
          u.fullname,
          u.email,
          d.name AS department_name,
          (
            SELECT COUNT(*)
            FROM attendance_late_justifications lj
            WHERE lj.user_id = a.user_id
              AND lj.attendance_date = a.date
              AND LOWER(COALESCE(lj.status, 'approved')) IN ('approved', 'aprobado')
          ) AS late_justification_count
        FROM user_attendance_records a
        INNER JOIN users u ON u.id = a.user_id
        LEFT JOIN departments d ON d.id = u.department_id
        WHERE a.date >= (CURRENT_DATE - ($1::int - 1))
      ),
      computed AS (
        SELECT
          b.*,
          CASE
            WHEN b.entry_time IS NULL THEN NULL
            ELSE (
              ((EXTRACT(HOUR FROM (b.entry_time AT TIME ZONE 'America/Guayaquil'))::int * 60)
              + EXTRACT(MINUTE FROM (b.entry_time AT TIME ZONE 'America/Guayaquil'))::int) - $2::int
            )
          END AS late_minutes,
          CASE
            WHEN b.lunch_start_time IS NOT NULL AND b.lunch_end_time IS NOT NULL
              THEN ROUND(EXTRACT(EPOCH FROM (b.lunch_end_time - b.lunch_start_time)) / 60.0)::int
            ELSE NULL
          END AS lunch_minutes
        FROM base b
      )
      SELECT
        user_id,
        date,
        fullname,
        email,
        department_name,
        late_minutes,
        lunch_minutes,
        late_justification_count,
        CASE
          WHEN late_minutes > $3::int AND COALESCE(late_justification_count, 0) = 0 THEN 'late_without_justification'
          WHEN lunch_minutes > 60 THEN 'lunch_over_60'
          ELSE NULL
        END AS breach_type
      FROM computed
      WHERE
        (late_minutes > $3::int AND COALESCE(late_justification_count, 0) = 0)
        OR (lunch_minutes > 60)
      ORDER BY date DESC, fullname ASC
      `,
      [days, LATE_BASE_MINUTES, LATE_TOLERANCE_MINUTES]
    );

    const rows = (result.rows || []).map((row) => ({
      user_id: row.user_id,
      date: row.date,
      fullname: row.fullname || null,
      email: row.email || null,
      department_name: row.department_name || null,
      late_minutes: Number.isFinite(Number(row.late_minutes)) ? Number(row.late_minutes) : null,
      lunch_minutes: Number.isFinite(Number(row.lunch_minutes)) ? Number(row.lunch_minutes) : null,
      late_justification_count: Number(row.late_justification_count || 0),
      breach_type: row.breach_type || null,
      breach_label:
        row.breach_type === "late_without_justification"
          ? "Llegada tarde sin justificación"
          : row.breach_type === "lunch_over_60"
            ? "Almuerzo mayor a 60 minutos"
            : "Incumplimiento",
    }));

    return res.status(200).json({
      ok: true,
      data: rows,
      meta: {
        days,
        toleranceMinutes: LATE_TOLERANCE_MINUTES,
      },
    });
  } catch (err) {
    logger.error({ err }, "Error consultando incumplimientos de horario");
    return res.status(500).json({ ok: false, message: "Error consultando incumplimientos de horario" });
  }
};

const scheduleAttendanceFollowUpMeeting = async (req, res) => {
  try {
    if (!hasHrDashboardAccess(req.user || {})) {
      return res.status(403).json({
        ok: false,
        code: "ATTENDANCE_NON_COMPLIANCE_FORBIDDEN",
        message: "No tienes permisos para agendar reuniones de seguimiento",
      });
    }

    const collaboratorId = Number.parseInt(req.params?.userId, 10);
    if (!Number.isInteger(collaboratorId) || collaboratorId <= 0) {
      return res.status(400).json({ ok: false, message: "Usuario inválido" });
    }

    const date = String(req.body?.date || "").slice(0, 10);
    const startTime = String(req.body?.start_time || "09:30").slice(0, 5);
    const durationMinutes = Math.max(15, Math.min(120, Number.parseInt(req.body?.duration_minutes, 10) || 30));
    const reason = String(req.body?.reason || "Revisión de cumplimiento de horario").trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, message: "Fecha inválida" });
    }
    if (!/^\d{2}:\d{2}$/.test(startTime)) {
      return res.status(400).json({ ok: false, message: "Hora de inicio inválida" });
    }

    const collaboratorRes = await db.query(
      "SELECT id, fullname, email FROM users WHERE id = $1 LIMIT 1",
      [collaboratorId]
    );
    if (!collaboratorRes.rows.length) {
      return res.status(404).json({ ok: false, message: "Colaborador no encontrado" });
    }
    const collaborator = collaboratorRes.rows[0];
    if (!collaborator.email) {
      return res.status(400).json({ ok: false, message: "El colaborador no tiene correo registrado" });
    }

    const [hh, mm] = startTime.split(":").map((v) => Number.parseInt(v, 10));
    const startUtc = new Date(Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)),
      hh + 5,
      mm,
      0
    ));
    const endUtc = new Date(startUtc.getTime() + durationMinutes * 60000);

    const meeting = await createTimeOffEvent({
      userEmail: collaborator.email,
      summary: `Reunión de seguimiento de asistencia - ${collaborator.fullname || collaborator.email}`,
      description: reason,
      startDateTime: startUtc.toISOString(),
      endDateTime: endUtc.toISOString(),
      timezone: "America/Guayaquil",
      reminderMinutesBefore: 30,
    });

    return res.status(200).json({
      ok: true,
      message: "Reunión agendada correctamente",
      data: {
        collaborator_id: collaborator.id,
        collaborator_email: collaborator.email,
        collaborator_name: collaborator.fullname || null,
        event_id: meeting?.id || null,
        event_link: meeting?.htmlLink || null,
        calendar_id: meeting?.calendarId || null,
      },
    });
  } catch (err) {
    logger.error({ err }, "Error agendando reunión de seguimiento de asistencia");
    return res.status(500).json({ ok: false, message: "Error agendando reunión de seguimiento" });
  }
};

/**
 * ðŸ“ Sync Attendance/Exception Location - Attach location after the mark was saved
 * POST /api/attendance/location-sync
 * Body: { target: "entry|lunch_start|lunch_end|exit|start|arrival|departure|return", location: "lat,lng" }
 */
const syncLocation = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const target = String(req.body?.target || "").trim().toLowerCase();

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    if (!target) {
      return res.status(400).json({ ok: false, message: "Target es requerido" });
    }
    const location = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "location-sync",
      targetKey: target,
      businessDate: getBusinessDate(new Date()),
    });
    if (!location) return;

    if (ATTENDANCE_LOCATION_TARGETS[target]) {
      const { timeColumn, locationColumn } = ATTENDANCE_LOCATION_TARGETS[target];
      const today = getBusinessDate();
      const existing = await db.query(
        `
        SELECT id, ${locationColumn} AS current_location
          FROM user_attendance_records
         WHERE user_id = $1
           AND date = $2
           AND ${timeColumn} IS NOT NULL
         LIMIT 1;
        `,
        [userId, today]
      );

      if (!existing.rows[0]) {
        return res.status(404).json({
          ok: false,
          message: "No existe un registro de asistencia compatible para sincronizar ubicacion",
        });
      }

      const currentLocation = String(existing.rows[0].current_location || "").trim();
      if (currentLocation) {
        return res.status(200).json({
          ok: true,
          message: "Ubicacion ya registrada, no se requieren cambios",
          data: existing.rows[0],
        });
      }

      const result = await db.query(
        `
        UPDATE user_attendance_records
           SET ${locationColumn} = $3
         WHERE user_id = $1
           AND date = $2
           AND ${timeColumn} IS NOT NULL
         RETURNING *;
        `,
        [userId, today, location]
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          message: "No existe un registro de asistencia compatible para sincronizar ubicacion",
        });
      }

      logger.info(`[ATTENDANCE] Location synced: ${email} target=${target}`);

      return res.status(200).json({
        ok: true,
        message: "Ubicacion sincronizada correctamente",
        data: result.rows[0],
      });
    }

    if (EXCEPTION_LOCATION_TARGETS[target]) {
      const { timeColumn, locationColumn } = EXCEPTION_LOCATION_TARGETS[target];
      const existing = await db.query(
        `
        SELECT id, ${locationColumn} AS current_location
          FROM attendance_exceptions
         WHERE user_id = $1
           AND ${timeColumn} IS NOT NULL
         ORDER BY COALESCE(${timeColumn}, created_at) DESC, id DESC
         LIMIT 1;
        `,
        [userId]
      );

      if (!existing.rows[0]) {
        return res.status(404).json({
          ok: false,
          message: "No existe una salida inesperada compatible para sincronizar ubicacion",
        });
      }

      const currentLocation = String(existing.rows[0].current_location || "").trim();
      if (currentLocation) {
        return res.status(200).json({
          ok: true,
          message: "Ubicacion ya registrada, no se requieren cambios",
          data: existing.rows[0],
        });
      }

      const result = await db.query(
        `
        UPDATE attendance_exceptions
           SET ${locationColumn} = $2
         WHERE id = (
           SELECT id
             FROM attendance_exceptions
            WHERE user_id = $1
              AND ${timeColumn} IS NOT NULL
            ORDER BY COALESCE(${timeColumn}, created_at) DESC, id DESC
            LIMIT 1
         )
         RETURNING *;
        `,
        [userId, location]
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          message: "No existe una salida inesperada compatible para sincronizar ubicacion",
        });
      }

      logger.info(`[ATTENDANCE] Exception location synced: ${email} target=${target}`);

      return res.status(200).json({
        ok: true,
        message: "Ubicacion sincronizada correctamente",
        data: result.rows[0],
      });
    }

    return res.status(400).json({ ok: false, message: "Target de ubicacion invalido" });
  } catch (err) {
    logger.error({ err }, "âŒ Error en sync-location");
    return res.status(500).json({ ok: false, message: "Error sincronizando ubicacion" });
  }
};

/**
 * ðŸ“ Field Clock In - Entry to client visit (iPhone Shortcut compatible)
 * POST /api/attendance/marcar/visita-entrada
 * Body: { location, client_id, prospect_name }
 */
const clockInField = async (req, res) => {
  try {
    const { id: userId, email, role } = req.user || {};
    const { client_id, prospect_name, observations } = req.body;
    const normalizedProspectName = String(prospect_name || "").trim();

    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const normalizedRole = String(role || "").toLowerCase();
    const isCommercial = [
      "comercial",
      "acp_comercial",
      "jefe_comercial",
      "asesor_comercial",
      "backoffice_comercial",
      "backoffice",
    ].includes(normalizedRole);
    const isTech = [
      "tecnico",
      "jefe_tecnico",
      "ti",
      "jefe_ti",
      "logistica",
      "jefe_logistica",
    ].includes(normalizedRole);

    if (!isCommercial && !isTech) {
      return res.status(403).json({ ok: false, message: "Solo personal de campo puede marcar visitas" });
    }

    const now = new Date();
    const today = getBusinessDate(now);
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "field-visit-entry",
      targetKey: "client_entry",
      businessDate: today,
    });
    if (!normalizedLocation) return;
    const parsedLocation = parseCoordinatePairInput(normalizedLocation);

    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }
    const activeOperationalBeforeVisit = await getActiveExceptionByFlow({ userId, flow: "operational" });
    if (activeOperationalBeforeVisit) {
      await autoCompleteOperationalAttendanceSpan({
        userId,
        operationalException: activeOperationalBeforeVisit,
        location: activeOperationalBeforeVisit.start_location || normalizedLocation,
        now,
      });
    }
    await syncNormalEntryFromFieldOp({ userId, location: normalizedLocation, timestamp: now });
    let result;

    if (client_id) {
      const numericClientId = Number.parseInt(client_id, 10);
      if (!Number.isInteger(numericClientId) || numericClientId <= 0) {
        return res.status(400).json({
          ok: false,
          message: "El cliente seleccionado es invalido",
        });
      }

      const normalizedEmail = String(email || "").trim().toLowerCase();
      const isClientScopeManager = [
        "jefe_comercial",
        "acp_comercial",
        "backoffice",
        "backoffice_comercial",
        "jefe_ti",
        "jefe_logistica",
        "gerencia",
        "gerente",
        "admin",
        "administrador",
        "ti",
        "logistica",
      ].includes(normalizedRole);

      const clientAccessParams = [numericClientId];
      let clientAccessQuery = `
        SELECT cr.id
        FROM client_requests cr
        WHERE cr.id = $1
          AND cr.status = 'approved'
      `;

      if (!isClientScopeManager) {
        clientAccessParams.push(normalizedEmail);
        clientAccessQuery += `
          AND (
            LOWER(COALESCE(cr.created_by, '')) = $2
            OR EXISTS (
              SELECT 1
              FROM client_assignments ca
              WHERE ca.client_request_id = cr.id
                AND LOWER(COALESCE(ca.assigned_to_email, '')) = $2
            )
          )
        `;
      }

      let clientAccess;
      try {
        clientAccess = await db.query(clientAccessQuery, clientAccessParams);
      } catch (clientAccessErr) {
        // Backward-compatible fallback for environments where client_assignments is not present yet.
        if (!isClientScopeManager && clientAccessErr?.code === "42P01") {
          clientAccess = await db.query(
            `SELECT cr.id
               FROM client_requests cr
              WHERE cr.id = $1
                AND cr.status = 'approved'
                AND LOWER(COALESCE(cr.created_by, '')) = $2`,
            [numericClientId, normalizedEmail]
          );
        } else {
          throw clientAccessErr;
        }
      }
      if (!clientAccess.rows.length) {
        return res.status(403).json({
          ok: false,
          message: "No tienes acceso al cliente seleccionado para registrar esta visita.",
        });
      }
      // ðŸ•µï¸ Cotejar con cronograma (Schedules)
      let scheduleCheck;
      try {
        scheduleCheck = await db.query(
          `SELECT id FROM schedules 
           WHERE user_email = $1 AND client_request_id = $2 
           AND visit_date = $3 AND status IN ('pending', 'approved')`,
          [email, numericClientId, today]
        );
      } catch (scheduleErr) {
        // Some environments still do not have the schedules table.
        if (scheduleErr?.code === "42P01") {
          scheduleCheck = { rows: [] };
        } else {
          throw scheduleErr;
        }
      }

      // Si no existe en cronograma, registrar como visita no planificada pero permitir el marcado
      const isPlanned = scheduleCheck.rows.length > 0;
      const normalizedObservations = String(observations || "").trim() || null;
      const upsertParams = [
        numericClientId,
        email,
        today,
        now,
        parsedLocation?.latitude ?? null,
        parsedLocation?.longitude ?? null,
        isPlanned,
        normalizedObservations,
      ];

      const upsertVisitLegacy = async () => {
        const existingVisit = await db.query(
          `SELECT id, hora_entrada
             FROM client_visit_logs
            WHERE client_request_id = $1
              AND user_email = $2
              AND visit_date = $3
            LIMIT 1`,
          [numericClientId, email, today]
        );

        if (existingVisit.rows.length) {
          return db.query(
            `UPDATE client_visit_logs
                SET status = 'in_visit',
                    hora_entrada = COALESCE(hora_entrada, $4),
                    lat_entrada = COALESCE(lat_entrada, $5),
                    lng_entrada = COALESCE(lng_entrada, $6)
              WHERE client_request_id = $1
                AND user_email = $2
                AND visit_date = $3
              RETURNING *`,
            [numericClientId, email, today, now, parsedLocation?.latitude ?? null, parsedLocation?.longitude ?? null]
          );
        }

        return db.query(
          `INSERT INTO client_visit_logs
            (client_request_id, user_email, visit_date, status, hora_entrada, lat_entrada, lng_entrada)
           VALUES
            ($1, $2, $3, 'in_visit', $4, $5, $6)
           RETURNING *`,
          [numericClientId, email, today, now, parsedLocation?.latitude ?? null, parsedLocation?.longitude ?? null]
        );
      };

      try {
        result = await db.query(
          `INSERT INTO client_visit_logs (client_request_id, user_email, visit_date, status, hora_entrada, lat_entrada, lng_entrada, is_planned, observaciones)
           VALUES ($1, $2, $3, 'in_visit', $4, $5, $6, $7, $8)
           ON CONFLICT (client_request_id, user_email, visit_date) 
           DO UPDATE SET
             status = 'in_visit',
             hora_entrada = COALESCE(client_visit_logs.hora_entrada, EXCLUDED.hora_entrada),
             is_planned = EXCLUDED.is_planned,
             observaciones = COALESCE(EXCLUDED.observaciones, client_visit_logs.observaciones)
           RETURNING *`,
          upsertParams
        );
      } catch (upsertErr) {
        // Fallback when production schema lacks the expected unique constraint.
        if (upsertErr?.code === "42P10") {
          const legacyResult = await upsertVisitLegacy();
          const row = legacyResult?.rows?.[0] || {};
          result = {
            rows: [{
              ...row,
              is_planned: typeof row.is_planned === "boolean" ? row.is_planned : isPlanned,
              observaciones: row.observaciones ?? normalizedObservations,
            }],
          };
        } else if (upsertErr?.code === "42703") {
          // Older environments may not yet include optional columns such as is_planned/observaciones.
          const legacyResult = await upsertVisitLegacy();
          const row = legacyResult?.rows?.[0] || {};
          result = {
            rows: [{
              ...row,
              is_planned: typeof row.is_planned === "boolean" ? row.is_planned : isPlanned,
              observaciones: row.observaciones ?? normalizedObservations,
            }],
          };
        } else {
          throw upsertErr;
        }
      }

      // Actualizar estado del cronograma si existe
      if (isPlanned) {
        await db.query(
          `UPDATE schedules SET status = 'in_progress', actual_start_time = $1 
           WHERE id = $2`,
          [now, scheduleCheck.rows[0].id]
        );
      }
    } else if (prospect_name) {
      const normalizedProspectName = String(prospect_name || "").trim();
      if (!normalizedProspectName) {
        return res.status(400).json({ ok: false, message: "El nombre del prospecto es requerido" });
      }

      const prospectInsertParams = [
        email,
        normalizedProspectName,
        today,
        now,
        parsedLocation?.latitude ?? null,
        parsedLocation?.longitude ?? null,
      ];

      const upsertProspectVisitLegacy = async () => {
        const existingProspectVisit = await db.query(
          `SELECT id, check_in_time
             FROM prospect_visits
            WHERE LOWER(COALESCE(user_email, '')) = LOWER($1)
              AND prospect_name = $2
              AND visit_date = $3
            LIMIT 1`,
          [email, normalizedProspectName, today]
        );

        if (existingProspectVisit.rows.length) {
          return db.query(
            `UPDATE prospect_visits
                SET status = 'in_visit',
                    check_in_time = COALESCE(check_in_time, $4),
                    check_in_lat = COALESCE(check_in_lat, $5),
                    check_in_lng = COALESCE(check_in_lng, $6)
              WHERE LOWER(COALESCE(user_email, '')) = LOWER($1)
                AND prospect_name = $2
                AND visit_date = $3
              RETURNING *`,
            prospectInsertParams
          );
        }

        return db.query(
          `INSERT INTO prospect_visits (user_email, prospect_name, visit_date, status, check_in_time, check_in_lat, check_in_lng)
           VALUES ($1, $2, $3, 'in_visit', $4, $5, $6)
           RETURNING *`,
          prospectInsertParams
        );
      };

      try {
        result = await db.query(
          `INSERT INTO prospect_visits (user_email, prospect_name, visit_date, status, check_in_time, check_in_lat, check_in_lng)
           VALUES ($1, $2, $3, 'in_visit', $4, $5, $6)
           ON CONFLICT (user_email, prospect_name, visit_date)
           DO UPDATE SET
             status = 'in_visit',
             check_in_time = COALESCE(prospect_visits.check_in_time, EXCLUDED.check_in_time)
           RETURNING *`,
          prospectInsertParams
        );
      } catch (prospectErr) {
        if (prospectErr?.code === "42P10" || prospectErr?.code === "42703" || prospectErr?.code === "23505") {
          result = await upsertProspectVisitLegacy();
        } else {
          throw prospectErr;
        }
      }
    } else {
      return res.status(400).json({ ok: false, message: "ID de cliente o nombre de prospecto requerido" });
    }

    const activeOperational = await getActiveExceptionByFlow({ userId, flow: "operational" });
    if (activeOperational) {
      await db.query(
        `UPDATE attendance_exceptions
            SET status = 'ON_SITE',
                arrival_time = $1,
                arrival_location = $2
          WHERE id = $3`,
        [now, normalizedLocation, activeOperational.id]
      );

      // Link the visit log to the operational trip for traceability
      if (result?.rows?.[0]?.id) {
        await db.query(
          `UPDATE client_visit_logs SET exception_id = $1 WHERE id = $2`,
          [activeOperational.id, result.rows[0].id]
        ).catch(() => {/* column may not exist on older schema — safe to ignore */});
      }
    }

    return res.status(200).json({
      ok: true,
      message: `Entrada a visita registrada para ${prospect_name || `cliente #${client_id}`}`,
      nextStep: "salida_cliente",
      data: {
        ...result.rows[0],
        operational_status: activeOperational ? "ON_SITE" : null,
        exception_id: activeOperational?.id ?? null,
      }
    });
  } catch (err) {
    logger.error({ err }, "âŒ Error en clock-in-field");
    return res.status(500).json({ ok: false, message: "Error registrando entrada a visita" });
  }
};

/**
 * ðŸ“ Field Clock Out - Exit from client visit (iPhone Shortcut compatible)
 * POST /api/attendance/marcar/visita-salida
 * Body: { location, client_id, prospect_name, observations }
 */
const clockOutField = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const { client_id, prospect_name, observations } = req.body;
    const normalizedProspectName = String(prospect_name || "").trim();
    const returnToOffice = ["1", "true", "si", "yes"].includes(
      String(req.body?.return_to_office ?? "").trim().toLowerCase()
    );

    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const now = new Date();
    const today = getBusinessDate(now);
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "field-visit-exit",
      targetKey: "client_exit",
      businessDate: today,
    });
    if (!normalizedLocation) return;
    const parsedLocation = parseCoordinatePairInput(normalizedLocation);

    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }
    const activeOperationalBeforeVisitExit = await getActiveExceptionByFlow({ userId, flow: "operational" });
    if (activeOperationalBeforeVisitExit) {
      await autoCompleteOperationalAttendanceSpan({
        userId,
        operationalException: activeOperationalBeforeVisitExit,
        location: activeOperationalBeforeVisitExit.start_location || normalizedLocation,
        now,
      });
    }
    let result;

    if (client_id) {
      const numericClientId = Number.parseInt(client_id, 10);
      if (!Number.isInteger(numericClientId) || numericClientId <= 0) {
        return res.status(400).json({
          ok: false,
          message: "El cliente seleccionado es invalido",
        });
      }
      const normalizedEmail = String(email || "").trim().toLowerCase();

      result = await db.query(
        `UPDATE client_visit_logs 
         SET status = 'visited', hora_salida = $1, lat_salida = $2, lng_salida = $3, observaciones = COALESCE($4, observaciones),
             duracion_minutos = EXTRACT(EPOCH FROM ($1 - hora_entrada))/60
         WHERE LOWER(COALESCE(user_email, '')) = $5
           AND client_request_id = $6
           AND visit_date = $7
           AND status = 'in_visit'
         RETURNING *`,
        [now, parsedLocation?.latitude ?? null, parsedLocation?.longitude ?? null, observations, normalizedEmail, numericClientId, today]
      );

      // Fallback: if business date drifted by timezone, close the latest active visit (today/yesterday).
      if (!result?.rows?.length) {
        const openVisit = await db.query(
          `SELECT id
             FROM client_visit_logs
            WHERE LOWER(COALESCE(user_email, '')) = $1
              AND client_request_id = $2
              AND status = 'in_visit'
              AND visit_date >= ($3::date - INTERVAL '1 day')::date
            ORDER BY visit_date DESC, hora_entrada DESC NULLS LAST, id DESC
            LIMIT 1`,
          [normalizedEmail, numericClientId, today]
        );

        if (openVisit.rows.length) {
          result = await db.query(
            `UPDATE client_visit_logs
                SET status = 'visited',
                    hora_salida = $1,
                    lat_salida = $2,
                    lng_salida = $3,
                    observaciones = COALESCE($4, observaciones),
                    duracion_minutos = EXTRACT(EPOCH FROM ($1 - hora_entrada))/60
              WHERE id = $5
              RETURNING *`,
            [now, parsedLocation?.latitude ?? null, parsedLocation?.longitude ?? null, observations, openVisit.rows[0].id]
          );
        }
      }

      // Actualizar cronograma a completado
      if (result.rows.length > 0) {
        try {
          await db.query(
            `UPDATE schedules SET status = 'completed', actual_end_time = $1 
             WHERE LOWER(COALESCE(user_email, '')) = $2 AND client_request_id = $3 AND visit_date = $4`,
            [now, normalizedEmail, numericClientId, today]
          );
        } catch (scheduleErr) {
          if (scheduleErr?.code !== "42P01") throw scheduleErr;
        }
      }
    } else if (normalizedProspectName) {
      result = await db.query(
        `UPDATE prospect_visits 
         SET status = 'visited', check_out_time = $1, check_out_lat = $2, check_out_lng = $3, observations = $4
         WHERE user_email = $5 AND prospect_name = $6 AND visit_date = $7 AND status = 'in_visit'
         RETURNING *`,
        [now, parsedLocation?.latitude ?? null, parsedLocation?.longitude ?? null, observations, email, normalizedProspectName, today]
      );

      // Fallback: close latest active prospect visit if business date drifted or casing differs.
      if (!result?.rows?.length) {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const openProspect = await db.query(
          `SELECT id
             FROM prospect_visits
            WHERE LOWER(COALESCE(user_email, '')) = $1
              AND LOWER(COALESCE(prospect_name, '')) = LOWER($2)
              AND status = 'in_visit'
              AND visit_date >= ($3::date - INTERVAL '7 day')::date
            ORDER BY visit_date DESC, check_in_time DESC NULLS LAST, id DESC
            LIMIT 1`,
          [normalizedEmail, normalizedProspectName, today]
        );

        if (openProspect.rows.length) {
          result = await db.query(
            `UPDATE prospect_visits
                SET status = 'visited',
                    check_out_time = $1,
                    check_out_lat = $2,
                    check_out_lng = $3,
                    observations = $4
              WHERE id = $5
              RETURNING *`,
            [now, parsedLocation?.latitude ?? null, parsedLocation?.longitude ?? null, observations, openProspect.rows[0].id]
          );
        }
      }
    } else {
      // Auto resolution: close latest active visit for this user when client/prospect is not provided.
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const latestClientActive = await db.query(
        `SELECT id, hora_entrada AS entry_time
           FROM client_visit_logs
          WHERE LOWER(COALESCE(user_email, '')) = $1
            AND status = 'in_visit'
            AND visit_date >= ($2::date - INTERVAL '7 day')::date
          ORDER BY visit_date DESC, hora_entrada DESC NULLS LAST, id DESC
          LIMIT 1`,
        [normalizedEmail, today]
      );

      const latestProspectActive = await db.query(
        `SELECT id, check_in_time AS entry_time
           FROM prospect_visits
          WHERE LOWER(COALESCE(user_email, '')) = $1
            AND status = 'in_visit'
            AND visit_date >= ($2::date - INTERVAL '7 day')::date
          ORDER BY visit_date DESC, check_in_time DESC NULLS LAST, id DESC
          LIMIT 1`,
        [normalizedEmail, today]
      );

      const clientRow = latestClientActive.rows[0] || null;
      const prospectRow = latestProspectActive.rows[0] || null;
      const clientTs = clientRow?.entry_time ? new Date(clientRow.entry_time).getTime() : -1;
      const prospectTs = prospectRow?.entry_time ? new Date(prospectRow.entry_time).getTime() : -1;

      if (clientRow && (!prospectRow || clientTs >= prospectTs)) {
        result = await db.query(
          `UPDATE client_visit_logs
              SET status = 'visited',
                  hora_salida = $1,
                  lat_salida = $2,
                  lng_salida = $3,
                  observaciones = COALESCE($4, observaciones),
                  duracion_minutos = EXTRACT(EPOCH FROM ($1 - hora_entrada))/60
            WHERE id = $5
            RETURNING *`,
          [now, parsedLocation?.latitude ?? null, parsedLocation?.longitude ?? null, observations, clientRow.id]
        );
      } else if (prospectRow) {
        result = await db.query(
          `UPDATE prospect_visits
              SET status = 'visited',
                  check_out_time = $1,
                  check_out_lat = $2,
                  check_out_lng = $3,
                  observations = $4
            WHERE id = $5
            RETURNING *`,
          [now, parsedLocation?.latitude ?? null, parsedLocation?.longitude ?? null, observations, prospectRow.id]
        );
      }
    }

    if (!result?.rows?.length) {
      if (client_id) {
        const numericClientId = Number.parseInt(client_id, 10);
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const alreadyClosed = await db.query(
          `SELECT *
             FROM client_visit_logs
            WHERE LOWER(COALESCE(user_email, '')) = $1
              AND client_request_id = $2
              AND status = 'visited'
              AND hora_salida IS NOT NULL
              AND visit_date >= ($3::date - INTERVAL '1 day')::date
            ORDER BY visit_date DESC, hora_salida DESC NULLS LAST, id DESC
            LIMIT 1`,
          [normalizedEmail, numericClientId, today]
        );

        if (alreadyClosed.rows.length) {
          return res.status(200).json({
            ok: true,
            code: "VISIT_ALREADY_CLOSED",
            message: "La visita ya se encontraba cerrada",
            data: alreadyClosed.rows[0],
          });
        }
      } else if (normalizedProspectName) {
        const normalizedEmail = String(email || "").trim().toLowerCase();
        const alreadyClosed = await db.query(
          `SELECT *
             FROM prospect_visits
            WHERE LOWER(COALESCE(user_email, '')) = $1
              AND prospect_name = $2
              AND status = 'visited'
              AND check_out_time IS NOT NULL
              AND visit_date >= ($3::date - INTERVAL '1 day')::date
            ORDER BY visit_date DESC, check_out_time DESC NULLS LAST, id DESC
            LIMIT 1`,
          [normalizedEmail, normalizedProspectName, today]
        );

        if (alreadyClosed.rows.length) {
          return res.status(200).json({
            ok: true,
            code: "VISIT_ALREADY_CLOSED",
            message: "La visita ya se encontraba cerrada",
            data: alreadyClosed.rows[0],
          });
        }
      }

      return res.status(404).json({
        ok: false,
        code: "NO_ACTIVE_VISIT",
        message: "No se encontró una visita activa para cerrar hoy",
      });
    }

    const activeOperational = await getActiveExceptionByFlow({ userId, flow: "operational" });
    if (activeOperational) {
      if (returnToOffice) {
        await db.query(
          `UPDATE attendance_exceptions
              SET status = 'RETURNING',
                  departure_time = $1,
                  departure_location = $2
            WHERE id = $3`,
          [now, normalizedLocation, activeOperational.id]
        );
      } else {
        await db.query(
          `UPDATE attendance_exceptions
              SET status = 'ACTIVE'
            WHERE id = $1`,
          [activeOperational.id]
        );
      }
    }

    if (shouldMirrorAttendanceForFieldOp(now)) {
      await syncNormalExitFromFieldOp({ userId, location: normalizedLocation, timestamp: now });
    }

    return res.status(200).json({
      ok: true,
      message: returnToOffice
        ? "Salida de visita registrada. Ya puedes marcar el retorno a oficina o viaje."
        : "Salida de visita registrada. La salida operacional queda abierta para continuar.",
      nextStep: returnToOffice ? "retorno_oficina_viaje" : "entrada_cliente",
      data: {
        ...result.rows[0],
        operational_status: activeOperational
          ? (returnToOffice ? "RETURNING" : "ACTIVE")
          : null,
      }
    });
  } catch (err) {
    logger.error({ err }, "âŒ Error en clock-out-field");
    return res.status(500).json({ ok: false, message: "Error registrando salida de visita" });
  }
};

/**
 * ðŸš¨ Unexpected Exit - Start (iPhone Shortcut compatible)
 * POST /api/attendance/marcar/salida-imprevista
 * Body: { location, description }
 */
const clockOutUnexpected = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const { description } = req.body;

    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const now = new Date();
    const today = getBusinessDate(now);
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "clock-out-unexpected",
      targetKey: "start",
      businessDate: today,
    });
    if (!normalizedLocation) return;

    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }

    const activeUnexpected = await getActiveExceptionByFlow({ userId, flow: "unexpected" });
    if (activeUnexpected) {
      return res.status(400).json({
        ok: false,
        message: "Ya tienes una salida inesperada en curso. Completala antes de iniciar otra.",
      });
    }

    const activeOperational = await getActiveExceptionByFlow({ userId, flow: "operational" });
    if (activeOperational) {
      return res.status(400).json({
        ok: false,
        message: "Tienes una salida operacional activa. Cierrala antes de registrar una salida inesperada.",
      });
    }

    const result = await db.query(
      `INSERT INTO attendance_exceptions (user_id, date, type, description, start_time, start_location, status)
       VALUES ($1, $2, 'imprevisto', $3, $4, $5, 'ACTIVE')
       RETURNING *`,
      [userId, today, description || "Salida imprevista via atajo", now, normalizedLocation]
    );

    return res.status(200).json({
      ok: true,
      message: "Salida imprevista registrada correctamente",
      data: result.rows[0],
    });
  } catch (err) {
    logger.error({ err }, "Error en clock-out-unexpected");
    return res.status(500).json({ ok: false, message: "Error registrando salida imprevista" });
  }
};

const clockInUnexpected = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const now = new Date();
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "clock-in-unexpected",
      targetKey: "return",
      businessDate: getBusinessDate(now),
    });
    if (!normalizedLocation) return;

    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }
    let result;
    try {
      result = await db.query(
        `UPDATE attendance_exceptions
            SET status = 'COMPLETED', end_time = $1, end_location = $2
          WHERE id = (
            SELECT id
              FROM attendance_exceptions
             WHERE user_id = $3
               AND UPPER(COALESCE(status, '')) <> 'COMPLETED'
               AND LOWER(COALESCE(type, '')) <> ALL($4::text[])
             ORDER BY id DESC
             LIMIT 1
          )
         RETURNING *`,
        [now, normalizedLocation, userId, OPERATIONAL_EXCEPTION_TYPES]
      );
    } catch (updateErr) {
      if (updateErr?.code === "42703") {
        // Legacy schemas may not include end_time/end_location.
        result = await db.query(
          `UPDATE attendance_exceptions
              SET status = 'COMPLETED',
                  return_time = COALESCE(return_time, $1),
                  return_location = COALESCE(return_location, $2)
            WHERE id = (
              SELECT id
                FROM attendance_exceptions
               WHERE user_id = $3
                 AND UPPER(COALESCE(status, '')) <> 'COMPLETED'
                 AND LOWER(COALESCE(type, '')) <> ALL($4::text[])
               ORDER BY id DESC
               LIMIT 1
            )
           RETURNING *`,
          [now, normalizedLocation, userId, OPERATIONAL_EXCEPTION_TYPES]
        );
      } else {
        throw updateErr;
      }
    }

    if (!result.rows.length) {
      return res.status(404).json({ ok: false, message: "No se encontro una salida imprevista activa" });
    }

    if (shouldMirrorAttendanceForFieldOp(now) || shouldMirrorRegularExitBySchedule(now)) {
      await syncNormalExitFromFieldOp({ userId, location: normalizedLocation, timestamp: now });
    }

    return res.status(200).json({
      ok: true,
      message: "Regreso de salida imprevista registrado correctamente",
      data: result.rows[0],
    });
  } catch (err) {
    logger.error({ err }, "Error en clock-in-unexpected");
    return res.status(500).json({ ok: false, message: "Error registrando regreso imprevisto" });
  }
};

const clockUnexpectedArrival = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const now = new Date();
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "clock-unexpected-arrival",
      targetKey: "onsite",
      businessDate: getBusinessDate(now),
    });
    if (!normalizedLocation) return;

    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }

    const activeUnexpected = await getActiveExceptionByFlow({ userId, flow: "unexpected" });
    if (!activeUnexpected) {
      return res.status(404).json({ ok: false, message: "No se encontro una salida imprevista activa" });
    }

    let result;
    try {
      result = await db.query(
        `UPDATE attendance_exceptions
            SET status = 'ON_SITE',
                arrival_time = $1,
                arrival_location = $2,
                updated_at = NOW()
          WHERE id = $3
         RETURNING *`,
        [now, normalizedLocation, activeUnexpected.id]
      );
    } catch (updateErr) {
      if (updateErr?.code === "42703") {
        result = await db.query(
          `UPDATE attendance_exceptions
              SET status = 'ON_SITE',
                  arrival_time = $1,
                  arrival_location = $2
            WHERE id = $3
           RETURNING *`,
          [now, normalizedLocation, activeUnexpected.id]
        );
      } else {
        throw updateErr;
      }
    }

    return res.status(200).json({
      ok: true,
      message: "Llegada a destino inesperado registrada correctamente",
      data: result.rows[0],
    });
  } catch (err) {
    logger.error({ err }, "Error en clock-unexpected-arrival");
    return res.status(500).json({ ok: false, message: "Error registrando llegada inesperada" });
  }
};

const clockUnexpectedReturn = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const now = new Date();
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "clock-unexpected-return",
      targetKey: "returning",
      businessDate: getBusinessDate(now),
    });
    if (!normalizedLocation) return;

    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }

    const activeUnexpected = await getActiveExceptionByFlow({ userId, flow: "unexpected" });
    if (!activeUnexpected) {
      return res.status(404).json({ ok: false, message: "No se encontro una salida imprevista activa" });
    }

    let result;
    try {
      result = await db.query(
        `UPDATE attendance_exceptions
            SET status = 'RETURNING',
                departure_time = COALESCE(departure_time, $1),
                departure_location = COALESCE(departure_location, $2),
                updated_at = NOW()
          WHERE id = $3
         RETURNING *`,
        [now, normalizedLocation, activeUnexpected.id]
      );
    } catch (updateErr) {
      if (updateErr?.code === "42703") {
        result = await db.query(
          `UPDATE attendance_exceptions
              SET status = 'RETURNING',
                  departure_time = COALESCE(departure_time, $1),
                  departure_location = COALESCE(departure_location, $2)
            WHERE id = $3
           RETURNING *`,
          [now, normalizedLocation, activeUnexpected.id]
        );
      } else {
        throw updateErr;
      }
    }

    return res.status(200).json({
      ok: true,
      message: "Retorno de salida imprevista registrado correctamente",
      data: result.rows[0],
    });
  } catch (err) {
    logger.error({ err }, "Error en clock-unexpected-return");
    return res.status(500).json({ ok: false, message: "Error registrando retorno imprevisto" });
  }
};

const clockOutOperational = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const { description } = req.body;

    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const now = new Date();
    const today = getBusinessDate(now);
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "clock-out-operational",
      targetKey: "start",
      businessDate: today,
    });
    if (!normalizedLocation) return;

    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }

    // Aseguramos que la entrada normal del día quede marcada al iniciar la salida operacional,
    // sin importar si es o no fuera de horario, para evitar "falta de registros".
    await syncNormalEntryFromFieldOp({ userId, location: normalizedLocation, timestamp: now });
    // Regularizar almuerzo en el acta a 14:00-15:00 para salidas operacionales (sin chequeo de hora).
    await autoSeedOperationalLunchWindow({ userId, location: normalizedLocation, timestamp: now });
    // Si el colaborador dejó almuerzo abierto y sigue laborando en salida operacional,
    // cerramos el almuerzo al iniciar la operación para mantener consistencia del acta normal.
    await closePendingLunchForOperationalStart({ userId, location: normalizedLocation, timestamp: now });

    const activeOperational = await getActiveExceptionByFlow({ userId, flow: "operational" });
    if (activeOperational) {
      await autoCompleteOperationalAttendanceSpan({
        userId,
        operationalException: activeOperational,
        location: activeOperational.start_location || normalizedLocation,
        now,
      });
      const tracking = computeOperationalTracking({ startTime: activeOperational.start_time, now });
      return res.status(200).json({
        ok: true,
        code: "OPERATIONAL_ALREADY_ACTIVE",
        message: "Ya tienes una salida operacional en curso. Se mantiene el mismo ciclo operativo.",
        data: {
          ...activeOperational,
          ...tracking,
        },
      });
    }

    const activeUnexpected = await getActiveExceptionByFlow({ userId, flow: "unexpected" });
    if (activeUnexpected) {
      return res.status(400).json({
        ok: false,
        message: "Tienes una salida inesperada activa. Cierrala antes de registrar una salida operacional.",
      });
    }

    const result = await db.query(
      `INSERT INTO attendance_exceptions (user_id, date, type, description, start_time, start_location, status)
       VALUES ($1, $2, 'operacion_campo', $3, $4, $5, 'ACTIVE')
       RETURNING *`,
      [userId, today, description || "Salida operacional de campo via atajo", now, normalizedLocation]
    );

    const tracking = computeOperationalTracking({ startTime: result.rows[0]?.start_time, now });
    await autoCompleteOperationalAttendanceSpan({
      userId,
      operationalException: result.rows[0],
      location: normalizedLocation,
      now,
    });

    return res.status(200).json({
      ok: true,
      message: "Salida operacional registrada correctamente",
      data: {
        ...result.rows[0],
        ...tracking,
      },
    });
  } catch (err) {
    logger.error({ err }, "Error en clock-out-operational");
    return res.status(500).json({ ok: false, message: "Error registrando salida operacional" });
  }
};

const clockInOperational = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const now = new Date();
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "clock-in-operational",
      targetKey: "return",
      businessDate: getBusinessDate(now),
    });
    if (!normalizedLocation) return;

    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }

    const activeOperational = await getActiveExceptionByFlow({ userId, flow: "operational" });
    if (!activeOperational) {
      return res.status(404).json({ ok: false, code: "NO_ACTIVE_OPERATIONAL", message: "No se encontro una salida operacional activa" });
    }
    await autoCompleteOperationalAttendanceSpan({
      userId,
      operationalException: activeOperational,
      location: activeOperational.start_location || normalizedLocation,
      now,
    });

    const tracking = computeOperationalTracking({ startTime: activeOperational.start_time, endTime: now, now });
    const descriptionWithSummary = appendOperationalSummary({
      baseDescription: activeOperational.description || "Salida operacional de campo",
      tracking,
    });

    let result;
    try {
      result = await db.query(
        `UPDATE attendance_exceptions
            SET status = 'COMPLETED',
                end_time = $1,
                end_location = $2,
                return_time = COALESCE(return_time, $1),
                return_location = COALESCE(return_location, $2),
                description = $3
          WHERE id = $4
         RETURNING *`,
        [now, normalizedLocation, descriptionWithSummary, activeOperational.id]
      );
    } catch (updateErr) {
      if (updateErr?.code === "42703") {
        result = await db.query(
          `UPDATE attendance_exceptions
              SET status = 'COMPLETED',
                  return_time = COALESCE(return_time, $1),
                  return_location = COALESCE(return_location, $2),
                  description = $3
            WHERE id = $4
           RETURNING *`,
          [now, normalizedLocation, descriptionWithSummary, activeOperational.id]
        );
      } else {
        throw updateErr;
      }
    }

    if (!result.rows.length) {
      return res.status(404).json({ ok: false, code: "NO_ACTIVE_OPERATIONAL", message: "No se encontro una salida operacional activa" });
    }

    if (shouldMirrorAttendanceForFieldOp(now) || shouldMirrorRegularExitBySchedule(now)) {
      await syncNormalExitFromFieldOp({ userId, location: normalizedLocation, timestamp: now });
    }

    return res.status(200).json({
      ok: true,
      message: "Regreso operacional registrado correctamente",
      data: {
        ...result.rows[0],
        ...tracking,
      },
    });
  } catch (err) {
    logger.error({ err }, "Error en clock-in-operational");
    return res.status(500).json({ ok: false, message: "Error registrando regreso operacional" });
  }
};

const clockInDestino = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const now = new Date();
    const today = getBusinessDate(now);
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "clock-in-destino",
      targetKey: "arrival",
      businessDate: today,
    });
    if (!normalizedLocation) return;

    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }

    const activeOperational = await getActiveExceptionByFlow({ userId, flow: "operational" });
    if (!activeOperational) {
      return res.status(404).json({ ok: false, code: "NO_ACTIVE_OPERATIONAL", message: "No se encontro una salida operacional activa" });
    }

    let result = await db.query(
      `UPDATE attendance_exceptions
          SET status = 'ON_SITE',
              arrival_time = $1,
              arrival_location = $2
        WHERE id = $3
       RETURNING *`,
      [now, normalizedLocation, activeOperational.id]
    );

    const ecuadorClockParts = getEcuadorClockParts(now);
    const currentHour = ecuadorClockParts ? ecuadorClockParts.hour : now.getHours();
    const workDayEndMinutes = parseClockHHMM(ATTENDANCE_WORKING_DAY_END) ?? (18 * 60);
    const workDayEndHour = Math.floor(workDayEndMinutes / 60);
    const workDayEndMin = workDayEndMinutes % 60;
    let regularized = false;
    if (currentHour >= workDayEndHour || currentHour < 6) {
      const parts = String(today).split('-');
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      // Convert Ecuador local time to UTC (Ecuador = UTC-5)
      const exitTime1800 = new Date(Date.UTC(year, month, day, workDayEndHour + 5, workDayEndMin, 0));
      
      const attendanceResult = await db.query(
        `SELECT id, entry_time FROM user_attendance_records WHERE user_id = $1 AND date = $2 LIMIT 1`,
        [userId, today]
      );
      
      if (attendanceResult.rows.length > 0 && attendanceResult.rows[0].entry_time) {
        const entryTime = new Date(attendanceResult.rows[0].entry_time);
        let workedMs = exitTime1800 - entryTime;
        
        const lunchQuery = await db.query(
          "SELECT lunch_start_time, lunch_end_time FROM user_attendance_records WHERE user_id = $1 AND date = $2",
          [userId, today]
        );
        if (lunchQuery.rows[0]?.lunch_start_time && lunchQuery.rows[0]?.lunch_end_time) {
          const lunchStart = new Date(lunchQuery.rows[0].lunch_start_time);
          const lunchEnd = new Date(lunchQuery.rows[0].lunch_end_time);
          workedMs -= (lunchEnd - lunchStart);
        }
        
        const workedHours = Math.max(0, workedMs / (1000 * 60 * 60));
        const standardWorkHours = Number.isFinite(ATTENDANCE_STANDARD_WORK_HOURS) && ATTENDANCE_STANDARD_WORK_HOURS > 0 ? ATTENDANCE_STANDARD_WORK_HOURS : 8;
        const overtimeHours = workedHours > standardWorkHours ? workedHours - standardWorkHours : 0;
        
        await db.query(
          `UPDATE user_attendance_records
           SET exit_time = $1,
               exit_location = COALESCE(exit_location, $4),
               is_overtime = $5,
               overtime_hours = $6,
               total_hours = $7,
               updated_at = NOW()
           WHERE user_id = $2 AND date = $3 AND exit_time IS NULL`,
          [exitTime1800, userId, today, normalizedLocation, overtimeHours > 0, overtimeHours, workedHours]
        );
        regularized = true;
      }
    }

    return res.status(200).json({
      ok: true,
      message: regularized ? "Llegada a destino registrada (Acta cerrada a las 18:00)" : "Llegada a destino registrada",
      nextStep: "entrada_cliente",
      data: {
        ...result.rows[0],
        regularized_acta: regularized
      },
    });
  } catch (err) {
    logger.error({ err }, "Error en clock-in-destino");
    return res.status(500).json({ ok: false, message: "Error registrando llegada a destino" });
  }
};

const justifyLateArrival = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const reason = String(req.body?.reason || "").trim();
    const attendanceDate = String(req.body?.date || getBusinessDate(new Date())).slice(0, 10);

    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });
    if (!reason || reason.length < 8) {
      return res.status(400).json({ ok: false, message: "La justificaciÃ³n debe tener al menos 8 caracteres" });
    }

    const now = new Date();
    const attendanceQuery = await db.query(
      `
        SELECT entry_time
        FROM user_attendance_records
        WHERE user_id = $1
          AND date = $2::date
        LIMIT 1
      `,
      [userId, attendanceDate]
    );
    const record = attendanceQuery.rows[0];
    if (!record?.entry_time) {
      return res.status(400).json({ ok: false, message: "No existe una entrada marcada para justificar" });
    }

    const lateMinutes = computeLateMinutesFromEntry(record.entry_time);
    if (!Number.isFinite(lateMinutes) || lateMinutes <= LATE_TOLERANCE_MINUTES) {
      return res.status(400).json({ ok: false, message: "La entrada no excede el rango de tolerancia" });
    }

    const activeTimeOff = await findActiveTimeOffForMarking({
      userEmail: email || null,
      now,
      businessDate: attendanceDate,
    });
    if (activeTimeOff) {
      return res.status(409).json({ ok: false, message: "Este dÃ­a ya tiene permiso/vacaciones aprobadas" });
    }

    const existing = await getLateJustificationByDate({ userId, attendanceDate });
    if (existing) {
      return res.status(409).json({ ok: false, message: "Ya existe una justificaciÃ³n registrada para esta fecha" });
    }

    const usedMonthly = await countLateJustificationsInMonth({ userId, attendanceDate });
    if (usedMonthly >= LATE_JUSTIFICATION_MONTHLY_LIMIT) {
      return res.status(409).json({ ok: false, message: "Ya agotaste tus 5 justificaciones mensuales" });
    }

    const cutoffIso = getLateCutoffIsoForDateKey(attendanceDate);
    if (cutoffIso && now.getTime() >= new Date(cutoffIso).getTime()) {
      return res.status(409).json({ ok: false, message: "El horario para regularizar atraso de este dÃ­a ya venciÃ³ (21:00)" });
    }

    await ensureLateJustificationTable();
    const created = await db.query(
      `
        INSERT INTO attendance_late_justifications (
          user_id,
          attendance_date,
          reason,
          status,
          regularized_entry_time,
          late_minutes
        )
        VALUES ($1, $2::date, $3, 'approved', '09:00:00', $4)
        RETURNING *
      `,
      [userId, attendanceDate, reason, lateMinutes]
    );

    const remaining = Math.max(0, LATE_JUSTIFICATION_MONTHLY_LIMIT - (usedMonthly + 1));
    return res.status(200).json({
      ok: true,
      message: "JustificaciÃ³n registrada. La entrada se regulariza para acta a las 09:00.",
      data: {
        justification: created.rows[0],
        remainingMonthly: remaining,
      },
    });
  } catch (err) {
    logger.error({ err }, "Error registrando justificaciÃ³n de atraso");
    return res.status(500).json({ ok: false, message: "Error registrando justificaciÃ³n de atraso" });
  }
};

const markOvertime = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const { hours, reason } = req.body;

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    if (!hours || hours <= 0) {
      return res.status(400).json({ ok: false, message: "Horas de overtime deben ser mayores a 0" });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ ok: false, message: "RazÃ³n requerida para overtime" });
    }

    const now = new Date();
    const today = getBusinessDate(now);
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "mark-overtime",
      targetKey: "overtime",
      businessDate: today,
    });
    if (!normalizedLocation) return;

    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }

    // Insert overtime record
    const result = await db.query(
      `
      INSERT INTO attendance_overtime (
        user_id, date, hours, reason, location, recorded_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
      `,
      [userId, today, hours, reason.trim(), normalizedLocation, now]
    );

    logger.info(`[ATTENDANCE] Overtime marked: ${email} - ${hours}h - ${reason}`);

    return res.status(200).json({
      ok: true,
      message: `Overtime de ${hours} horas registrado correctamente`,
      data: result.rows[0],
    });
  } catch (err) {
    logger.error({ err }, "âŒ Error en mark-overtime");
    return res.status(500).json({
      ok: false,
      message: "Error registrando overtime",
    });
  }
};

/**
 * ðŸ“Š Get Overtime Records - Get overtime history
 * GET /api/attendance/overtime?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
const getOvertimeRecords = async (req, res) => {
  try {
    const { id: userId } = req.user || {};
    const { start, end } = req.query;

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    if (!start || !end) {
      return res.status(400).json({
        ok: false,
        message: "Fechas de inicio y fin requeridas",
      });
    }

    const result = await db.query(
      `
      SELECT * FROM attendance_overtime
      WHERE user_id = $1 AND date BETWEEN $2 AND $3
      ORDER BY date DESC, recorded_at DESC
      `,
      [userId, start, end]
    );

    // Calculate totals
    const totalHours = result.rows.reduce((sum, record) => sum + parseFloat(record.hours), 0);
    const totalRecords = result.rows.length;

    return res.status(200).json({
      ok: true,
      data: result.rows,
      summary: {
        totalHours: totalHours.toFixed(2),
        totalRecords,
        period: { start, end }
      }
    });
  } catch (err) {
    logger.error({ err }, "âŒ Error obteniendo registros de overtime");
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo registros de overtime",
    });
  }
};

const generatePDF = async (req, res) => {
  try {
    const { userId } = req.params;
    const { start, end, periodType, period, year } = req.query;
    const normalizedPeriodType =
      String(periodType || period || "monthly").trim().toLowerCase() === "annual"
        ? "annual"
        : "monthly";

    if (normalizedPeriodType === "monthly" && (!start || !end)) {
      return res.status(400).json({
        ok: false,
        message: "Fechas de inicio y fin requeridas (start, end) para reporte mensual",
      });
    }

    if (normalizedPeriodType === "annual" && year !== undefined) {
      const parsedYear = Number.parseInt(year, 10);
      if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
        return res.status(400).json({
          ok: false,
          message: "El anio del reporte anual es invalido",
        });
      }
    }

    if (String(userId || "").trim().toLowerCase() === "all") {
      return res.status(400).json({
        ok: false,
        message: "Debes seleccionar un usuario especÃ­fico para generar el PDF",
      });
    }

    const targetUserId = Number(userId);
    if (!Number.isFinite(targetUserId)) {
      return res.status(400).json({
        ok: false,
        message: "Usuario requerido",
      });
    }

    const pdfResult = await generateAttendancePDF(targetUserId, start, end, {
      periodType: normalizedPeriodType,
      year,
    });
    const pdfBuffer = pdfResult?.buffer;
    const hashSha256 = pdfResult?.hashSha256;
    const hashAlgorithm = pdfResult?.hashAlgorithm || "SHA-256";
    const fileLabel =
      pdfResult?.fileLabel ||
      (normalizedPeriodType === "annual"
        ? `${year || new Date().getFullYear()}-anual`
        : `${start}-${end}`);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=asistencia-${targetUserId}-${fileLabel}.pdf`
    );
    res.setHeader("Cache-Control", "no-store");
    if (hashSha256) {
      res.setHeader("X-Document-Hash-SHA256", hashSha256);
      res.setHeader("X-Document-Hash-Algorithm", hashAlgorithm);
    }
    res.setHeader(
      "X-Document-Integrity-Notice",
      "Documento bloqueado al generarse. Cualquier alteracion invalida su integridad."
    );

    return res.send(pdfBuffer);
  } catch (err) {
    logger.error({ err }, "Error en endpoint de PDF");
    return res.status(500).json({
      ok: false,
      message: err.message || "Error generando PDF",
    });
  }
};

const getOperationalHealth = async (req, res) => {
  try {
    const { rows: dateRows } = await db.query(
      `SELECT
         (NOW() AT TIME ZONE $1)::date AS today_ec,
         ((NOW() AT TIME ZONE $1)::date - INTERVAL '2 day')::date AS cutoff_ec,
         ((NOW() AT TIME ZONE $1) - INTERVAL '48 hour')::timestamptz AS since_48h`,
      [LATE_TIMEZONE],
    );
    const todayEc = dateRows[0]?.today_ec;
    const cutoffEc = dateRows[0]?.cutoff_ec;
    const since48h = dateRows[0]?.since_48h;

    const [
      activeOperational,
      activeUnexpected,
      invalidVisits48h,
      missingAttendanceGeoToday,
      pendingLateAfterCutoff,
      pendingLocationQueue,
    ] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS total
           FROM attendance_exceptions
          WHERE UPPER(COALESCE(status, '')) <> 'COMPLETED'
            AND LOWER(COALESCE(type, '')) = ANY($1::text[])`,
        [OPERATIONAL_EXCEPTION_TYPES],
      ),
      db.query(
        `SELECT COUNT(*)::int AS total
           FROM attendance_exceptions
          WHERE UPPER(COALESCE(status, '')) <> 'COMPLETED'
            AND LOWER(COALESCE(type, '')) <> ALL($1::text[])`,
        [OPERATIONAL_EXCEPTION_TYPES],
      ),
      db.query(
        `SELECT COUNT(*)::int AS total
           FROM (
             SELECT hora_entrada AS ts, lat_entrada AS lat, lng_entrada AS lng FROM client_visit_logs
             UNION ALL
             SELECT hora_salida AS ts, lat_salida AS lat, lng_salida AS lng FROM client_visit_logs
             UNION ALL
             SELECT check_in_time AS ts, check_in_lat AS lat, check_in_lng AS lng FROM prospect_visits
             UNION ALL
             SELECT check_out_time AS ts, check_out_lat AS lat, check_out_lng AS lng FROM prospect_visits
           ) x
          WHERE ts IS NOT NULL
            AND ts >= $1::timestamptz
            AND lat IS NOT NULL
            AND lng IS NOT NULL
            AND (
              abs(lat) > 90
              OR abs(lng) > 180
              OR (abs(lat) <= 0.0005 AND abs(lng) <= 0.0005)
            )`,
        [since48h],
      ),
      db.query(
        `SELECT COUNT(*)::int AS total
           FROM user_attendance_records
          WHERE date = $1::date
            AND (
              (entry_time IS NOT NULL AND COALESCE(NULLIF(btrim(entry_location), ''), '') = '')
              OR (lunch_start_time IS NOT NULL AND COALESCE(NULLIF(btrim(lunch_start_location), ''), '') = '')
              OR (lunch_end_time IS NOT NULL AND COALESCE(NULLIF(btrim(lunch_end_location), ''), '') = '')
              OR (exit_time IS NOT NULL AND COALESCE(NULLIF(btrim(exit_location), ''), '') = '')
            )`,
        [todayEc],
      ),
      db.query(
        `SELECT COUNT(*)::int AS total
           FROM attendance_late_justifications
          WHERE attendance_date <= $1::date
            AND status <> 'approved'`,
        [cutoffEc],
      ).catch(() => ({ rows: [{ total: 0 }] })),
      db.query(
        `SELECT COUNT(*)::int AS total
           FROM attendance_pending_locations
          WHERE status = 'pending'`,
      ).catch(() => ({ rows: [{ total: 0 }] })),
    ]);

    return res.status(200).json({
      ok: true,
      data: {
        timezone: LATE_TIMEZONE,
        todayEc,
        cutoffEc,
        since48h,
        activeFlows: {
          operational: Number(activeOperational.rows?.[0]?.total || 0),
          unexpected: Number(activeUnexpected.rows?.[0]?.total || 0),
        },
        geoQuality: {
          invalidCoordinatesLast48h: Number(invalidVisits48h.rows?.[0]?.total || 0),
          missingAttendanceGeoToday: Number(missingAttendanceGeoToday.rows?.[0]?.total || 0),
        },
        policyWatch: {
          pendingLateBeforeOrAtCutoff: Number(pendingLateAfterCutoff.rows?.[0]?.total || 0),
        },
        pendingLocationQueue: Number(pendingLocationQueue.rows?.[0]?.total || 0),
      },
    });
  } catch (err) {
    logger.error({ err }, "Error obteniendo operational-health de asistencia");
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo health operacional de asistencia",
    });
  }
};

/**
 * POST /api/attendance/marcar/cierre-viaje
 * Closes an active operational trip from outside the office (closure_type = 'outside_office').
 * Mirrors the formal exit on the acta if the day is still open.
 */
const clockCloseTrip = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const closureReason = String(req.body?.reason || req.body?.closure_reason || "").trim() || null;

    const now = new Date();
    const today = getBusinessDate(now);
    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "close-trip",
      targetKey: "return",
      businessDate: today,
    });
    if (!normalizedLocation) return;

    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) return;

    const activeOperational = await getActiveExceptionByFlow({ userId, flow: "operational" });
    if (!activeOperational) {
      return res.status(404).json({
        ok: false,
        code: "NO_ACTIVE_OPERATIONAL",
        message: "No hay un viaje operacional activo para cerrar",
      });
    }

    // Close the operational exception
    try {
      await db.query(
        `UPDATE attendance_exceptions
            SET status = 'COMPLETED',
                return_time = $1,
                return_location = $2,
                closure_type = 'outside_office',
                closure_reason = $3,
                updated_at = NOW()
          WHERE id = $4`,
        [now, normalizedLocation, closureReason, activeOperational.id]
      );
    } catch (closeErr) {
      if (closeErr?.code === "42703") {
        await db.query(
          `UPDATE attendance_exceptions
              SET status = 'COMPLETED',
                  return_time = $1,
                  return_location = $2
            WHERE id = $3`,
          [now, normalizedLocation, activeOperational.id]
        );
      } else {
        throw closeErr;
      }
    }

    // Mirror formal exit on attendance record
    const exitResult = await syncNormalExitFromFieldOp({ userId, location: normalizedLocation, timestamp: now });

    return res.status(200).json({
      ok: true,
      message: "Viaje operacional cerrado desde fuera de oficina",
      nextStep: "fin_jornada",
      data: {
        exception_id: activeOperational.id,
        closure_type: "outside_office",
        exit_mirrored: exitResult?.updated ?? false,
      },
    });
  } catch (err) {
    logger.error({ err }, "Error en clock-close-trip");
    return res.status(500).json({ ok: false, message: "Error cerrando el viaje operacional" });
  }
};

/**
 * POST /marcar/almuerzo-salida-operacional
 * Marks the start of lunch break during an active operational exit.
 * Optional — the acta is already regularized to 14:00-15:00 automatically.
 */
const clockOutOperationalLunch = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const now = new Date();
    const today = getBusinessDate(now);

    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "clock-out-operational-lunch",
      targetKey: "start",
      businessDate: today,
    });
    if (!normalizedLocation) return;

    const activeOperational = await getActiveExceptionByFlow({ userId, flow: "operational" });
    if (!activeOperational) {
      return res.status(404).json({
        ok: false,
        code: "NO_ACTIVE_OPERATIONAL",
        message: "No tienes una salida operacional activa para registrar almuerzo.",
      });
    }

    if (activeOperational.op_lunch_start_time) {
      return res.status(400).json({
        ok: false,
        code: "OPERATIONAL_LUNCH_ALREADY_STARTED",
        message: "Ya marcaste salida a almuerzo en la operacion activa.",
        data: activeOperational,
      });
    }

    const { rows } = await db.query(
      `UPDATE attendance_exceptions
          SET op_lunch_start_time = $1,
              op_lunch_start_location = $2,
              updated_at = NOW()
        WHERE id = $3
        RETURNING *`,
      [now, normalizedLocation, activeOperational.id]
    );

    logger.info({ userId, email, exceptionId: activeOperational.id }, "[ATTENDANCE] Operational lunch-out marked");

    return res.status(200).json({
      ok: true,
      message: "Salida a almuerzo operacional registrada. El acta reflejará 14:00-15:00.",
      data: rows[0],
    });
  } catch (err) {
    logger.error({ err }, "Error en clock-out-operational-lunch");
    return res.status(500).json({ ok: false, message: "Error registrando salida a almuerzo operacional" });
  }
};

/**
 * POST /marcar/almuerzo-entrada-operacional
 * Marks the end of lunch break during an active operational exit.
 * Optional — the acta is already regularized to 14:00-15:00 automatically.
 */
const clockInOperationalLunch = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const now = new Date();
    const today = getBusinessDate(now);

    const normalizedLocation = await resolveRequiredLocation({
      req,
      res,
      userId,
      actionKey: "clock-in-operational-lunch",
      targetKey: "return",
      businessDate: today,
    });
    if (!normalizedLocation) return;

    const activeOperational = await getActiveExceptionByFlow({ userId, flow: "operational" });
    if (!activeOperational) {
      return res.status(404).json({
        ok: false,
        code: "NO_ACTIVE_OPERATIONAL",
        message: "No tienes una salida operacional activa para registrar regreso de almuerzo.",
      });
    }

    if (!activeOperational.op_lunch_start_time) {
      return res.status(400).json({
        ok: false,
        code: "OPERATIONAL_LUNCH_NOT_STARTED",
        message: "Debes marcar salida a almuerzo operacional primero.",
      });
    }

    if (activeOperational.op_lunch_end_time) {
      return res.status(400).json({
        ok: false,
        code: "OPERATIONAL_LUNCH_ALREADY_ENDED",
        message: "Ya marcaste regreso de almuerzo en la operacion activa.",
        data: activeOperational,
      });
    }

    const { rows } = await db.query(
      `UPDATE attendance_exceptions
          SET op_lunch_end_time = $1,
              op_lunch_end_location = $2,
              updated_at = NOW()
        WHERE id = $3
        RETURNING *`,
      [now, normalizedLocation, activeOperational.id]
    );

    logger.info({ userId, email, exceptionId: activeOperational.id }, "[ATTENDANCE] Operational lunch-in marked");

    return res.status(200).json({
      ok: true,
      message: "Regreso de almuerzo operacional registrado.",
      data: rows[0],
    });
  } catch (err) {
    logger.error({ err }, "Error en clock-in-operational-lunch");
    return res.status(500).json({ ok: false, message: "Error registrando regreso de almuerzo operacional" });
  }
};

module.exports = {
  clockIn,
  clockOutLunch,
  clockInLunch,
  clockOut,
  clockInField,
  clockOutField,
  clockOutUnexpected,
  clockInUnexpected,
  clockUnexpectedArrival,
  clockUnexpectedReturn,
  clockOutOperational,
  clockInOperational,
  clockOutOperationalLunch,
  clockInOperationalLunch,
  clockInDestino,
  clockCloseTrip,
  justifyLateArrival,
  registerException,
  updateExceptionStatus,
  getActiveException,
  getToday,
  getUserAttendance,
  getRange,
  getTeamRange,
  getAttendanceNonCompliance,
  scheduleAttendanceFollowUpMeeting,
  getOperationalHealth,
  generatePDF,
  syncLocation,
  markOvertime,
  getOvertimeRecords,
};
