/**
 * src/modules/attendance/attendance.controller.js
 * -----------------------------------------------
 * 📋 Attendance Tracking Controller
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
const notificationManager = require("../notifications/notificationManager");

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

const normalizeLocationInput = (rawLocation) => {
  if (rawLocation === null || rawLocation === undefined) return "";

  if (typeof rawLocation === "string") {
    return rawLocation.trim();
  }

  if (typeof rawLocation === "object") {
    const latitude = Number(rawLocation.latitude ?? rawLocation.lat);
    const longitude = Number(rawLocation.longitude ?? rawLocation.lng);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return `${latitude},${longitude}`;
    }
  }

  return String(rawLocation).trim();
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

const ATTENDANCE_EXIT_ALLOWED_START = process.env.ATTENDANCE_EXIT_ALLOWED_START || "16:00";
const ATTENDANCE_EXIT_ALLOWED_END = process.env.ATTENDANCE_EXIT_ALLOWED_END || "22:00";

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

const isOutsideAllowedExitSchedule = (dateValue) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const startMinutes = parseClockHHMM(ATTENDANCE_EXIT_ALLOWED_START);
  const endMinutes = parseClockHHMM(ATTENDANCE_EXIT_ALLOWED_END);
  if (startMinutes === null || endMinutes === null) return false;

  const currentMinutes = (date.getHours() * 60) + date.getMinutes();
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

const notifyTalentoHumanoAttendanceIrregularity = async ({
  collaboratorId,
  collaboratorName,
  collaboratorEmail,
  exceptionType,
  detail,
  occurredAt = new Date(),
  meta = {},
}) => {
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
 * 🕐 Clock In - Record entry time
 * POST /api/attendance/clock-in
 * Body: { location: "lat,lng" }
 */
const clockIn = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const { location } = req.body;

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const now = new Date();
    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }
    const ensured = await ensureDailyClockIn({ userId, location: location || null, timestamp: now });
    const normalizedLocation = String(location || "").trim();

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
            message: "Entrada ya registrada; ubicación sincronizada correctamente",
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

    logger.info(`[ATTENDANCE] Clock in: ${email} at ${now.toISOString()} loc: ${location}`);

    return res.status(200).json({
      ok: true,
      message: "Entrada registrada correctamente",
      data: ensured.data,
    });
  } catch (err) {
    logger.error({ err }, "❌ Error en clock-in");
    return res.status(500).json({
      ok: false,
      message: "Error registrando entrada",
    });
  }
};

/**
 * 🍽️ Clock Out for Lunch - Record lunch start time
 * POST /api/attendance/clock-out-lunch
 * Body: { location }
 */
const clockOutLunch = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const { location } = req.body;

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const now = new Date();
    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }
    const today = getBusinessDate(now);

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

    // Update lunch start time and location
    const result = await db.query(
      `
      UPDATE user_attendance_records
      SET lunch_start_time = $1, lunch_start_location = $4, updated_at = NOW()
      WHERE user_id = $2 AND date = $3
      RETURNING *;
      `,
      [now, userId, today, location || null]
    );

    logger.info(`[ATTENDANCE] Lunch start: ${email} at ${now.toISOString()} loc: ${location}`);

    return res.status(200).json({
      ok: true,
      message: "Salida a almuerzo registrada",
      data: result.rows[0],
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
 * 🍽️ Clock In from Lunch - Record lunch end time
 * POST /api/attendance/clock-in-lunch
 * Body: { location }
 */
const clockInLunch = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const { location } = req.body;

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const now = new Date();
    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }
    const today = getBusinessDate(now);

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

    // Update lunch end time and location
    const result = await db.query(
      `
      UPDATE user_attendance_records
      SET lunch_end_time = $1, lunch_end_location = $4, updated_at = NOW()
      WHERE user_id = $2 AND date = $3
      RETURNING *;
      `,
      [now, userId, today, location || null]
    );

    logger.info(`[ATTENDANCE] Lunch end: ${email} at ${now.toISOString()} loc: ${location}`);

    return res.status(200).json({
      ok: true,
      message: "Regreso de almuerzo registrado",
      data: result.rows[0],
    });
  } catch (err) {
    logger.error({ err }, "❌ Error en clock-in-lunch");
    return res.status(500).json({
      ok: false,
      message: "Error registrando regreso de almuerzo",
    });
  }
};

/**
 * 🏁 Clock Out - Record exit time
 * POST /api/attendance/clock-out
 * Body: { location, isOvertime: boolean }
 */
const clockOut = async (req, res) => {
  try {
    const { id: userId, email, fullname, name } = req.user || {};
    const { location, isOvertime } = req.body;

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const now = new Date();
    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }
    const today = getBusinessDate(now);

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
    const standardWorkHours = 8; // Jornada laboral estándar
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
      [now, userId, today, location || null, isOvertimeMarked, overtimeHours, workedHours]
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
      await Promise.all(
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
              location: location || null,
              overtime_declared: overtimeDeclared,
              overtime_hours: Number(overtimeHours.toFixed(2)),
              worked_hours: Number(workedHours.toFixed(2)),
            },
          })
        )
      );
    }

    const message = overtimeHours > 0
      ? `Salida registrada. Has trabajado ${overtimeHours.toFixed(1)} horas extra.`
      : "Salida registrada correctamente";

    logger.info(`[ATTENDANCE] Clock out: ${email} at ${now.toISOString()} loc: ${location} overtime: ${overtimeHours.toFixed(2)}h`);

    return res.status(200).json({
      ok: true,
      message,
      data: result.rows[0],
      overtime: overtimeHours > 0 ? {
        hours: overtimeHours,
        isSignificant: overtimeHours > 2 // Más de 2 horas extra es significativo
      } : null
    });
  } catch (err) {
    logger.error({ err }, "❌ Error en clock-out");
    return res.status(500).json({
      ok: false,
      message: "Error registrando salida",
    });
  }
};

/**
 * ⚠️ Register Exception (Salida Inesperada - Step 1/4)
 * POST /api/attendance/exception
 * Body: { type, description, location, isJustified?: boolean }
 */
const registerException = async (req, res) => {
  try {
    const { id: userId, email, fullname, name } = req.user || {};
    const { type, description, location } = req.body;
    const descriptionText = String(description || "").trim();
    const exceptionIsJustified = isExceptionMarkedAsJustified(req.body);

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }
    if (!type || !descriptionText) {
      return res.status(400).json({ ok: false, message: "Tipo y descripción requeridos" });
    }

    const now = new Date();
    const today = getBusinessDate(now);

    // Check if there is already an active exception
    const active = await db.query(
      "SELECT id FROM attendance_exceptions WHERE user_id = $1 AND UPPER(COALESCE(status, '')) <> 'COMPLETED'",
      [userId]
    );

    if (active.rows.length > 0) {
      return res.status(400).json({
        ok: false,
        message: "Ya tienes una salida en curso. Complétala antes de iniciar otra."
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
      [userId, today, type, descriptionText, now, location || null]
    );

    if (!exceptionIsJustified) {
      await notifyTalentoHumanoAttendanceIrregularity({
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
          location: location || null,
        },
      });
    }

    logger.info(`[ATTENDANCE] Exception Start: ${email} - ${type}`);

    return res.status(200).json({
      ok: true,
      message: "Salida registrada. Notifica cuando llegues a tu destino.",
      data: result.rows[0],
    });
  } catch (err) {
    logger.error({ err }, "❌ Error en register-exception");
    return res.status(500).json({
      ok: false,
      message: "Error registrando excepción",
    });
  }
};

/**
 * 🔄 Update Exception Status (Steps 2, 3, 4)
 * POST /api/attendance/exception/status
 * Body: { status, location }
 * Status: 'ON_SITE' (Llegada), 'RETURNING' (Salida Destino), 'COMPLETED' (Regreso Oficina)
 */
const updateExceptionStatus = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const { status, location } = req.body;

    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

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
      // Step 2: Arrival at Destination
      updateQuery = "UPDATE attendance_exceptions SET status = 'ON_SITE', arrival_time = NOW(), arrival_location = $1 WHERE id = $2";
      params = [location, exceptionId];
      message = "Llegada registrada. Notifica cuando salgas del destino.";
    } else if (status === 'RETURNING') {
      // Step 3: Leaving Destination
      updateQuery = "UPDATE attendance_exceptions SET status = 'RETURNING', departure_time = NOW(), departure_location = $1 WHERE id = $2";
      params = [location, exceptionId];
      message = "Salida de destino registrada. Notifica cuando regreses a la oficina.";
    } else if (status === 'COMPLETED') {
      // Step 4: Back at Office
      updateQuery = "UPDATE attendance_exceptions SET status = 'COMPLETED', return_time = NOW(), return_location = $1 WHERE id = $2";
      params = [location, exceptionId];
      message = "Regreso a oficina registrado. Ciclo completado.";
    } else {
      return res.status(400).json({ ok: false, message: "Estado inválido" });
    }

    await db.query(updateQuery, params);

    // Fetch updated record
    const updated = await db.query("SELECT * FROM attendance_exceptions WHERE id = $1", [exceptionId]);

    logger.info(`[ATTENDANCE] Exception Update: ${email} - ${status}`);

    return res.status(200).json({
      ok: true,
      message,
      data: updated.rows[0]
    });

  } catch (err) {
    logger.error({ err }, "❌ Error en update-exception");
    return res.status(500).json({ ok: false, message: "Error actualizando estado de excepción" });
  }
};

/**
 * 📋 Get Active Exception - Get current user's active exception
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

    const normalizedException = result.rows[0]
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

    return res.status(200).json({
      ok: true,
      data: normalizedException,
    });
  } catch (err) {
    logger.error({ err }, "❌ Error obteniendo excepción activa");
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo excepción activa",
    });
  }
};

/**
 * 📅 Get Today's Attendance - For current user
 * GET /api/attendance/today
 */
const getToday = async (req, res) => {
  try {
    const { id: userId } = req.user || {};
    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const today = getBusinessDate();

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

    return res.status(200).json({
      ok: true,
      data: data,
    });
  } catch (err) {
    logger.error({ err }, "❌ Error obteniendo asistencia de hoy");
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo asistencia",
    });
  }
};

/**
 * 👤 Get User Attendance - For specific date
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
    logger.error({ err }, "❌ Error obteniendo asistencia de usuario");
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo asistencia",
    });
  }
};

/**
 * 📊 Get Attendance Range - For reporting (calidad dashboard)
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

      const { query, params, filterRows } = buildAttendanceRangeQuery({
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

/**
 * 📍 Sync Attendance/Exception Location - Attach location after the mark was saved
 * POST /api/attendance/location-sync
 * Body: { target: "entry|lunch_start|lunch_end|exit|start|arrival|departure|return", location: "lat,lng" }
 */
const syncLocation = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const target = String(req.body?.target || "").trim().toLowerCase();
    const location = normalizeLocationInput(req.body?.location);

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    if (!target || !location) {
      return res.status(400).json({ ok: false, message: "Target y location son requeridos" });
    }

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
           SET ${locationColumn} = $3,
               updated_at = NOW()
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
           SET ${locationColumn} = $2,
               updated_at = NOW()
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
    logger.error({ err }, "❌ Error en sync-location");
    return res.status(500).json({ ok: false, message: "Error sincronizando ubicacion" });
  }
};

/**
 * 📍 Field Clock In - Entry to client visit (iPhone Shortcut compatible)
 * POST /api/attendance/marcar/visita-entrada
 * Body: { location, client_id, prospect_name }
 */
const clockInField = async (req, res) => {
  try {
    const { id: userId, email, role } = req.user || {};
    const { location, client_id, prospect_name, observations } = req.body;

    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const normalizedRole = String(role || "").toLowerCase();
    const isCommercial = ["comercial", "acp_comercial", "jefe_comercial"].includes(normalizedRole);
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
    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }
    let result;

    if (client_id) {
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

      const clientAccessParams = [Number(client_id)];
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
                AND ca.is_active = TRUE
                AND (ca.starts_at IS NULL OR ca.starts_at <= NOW())
                AND (ca.ends_at IS NULL OR ca.ends_at >= NOW())
                AND LOWER(COALESCE(ca.assigned_to_email, '')) = $2
            )
          )
        `;
      }

      const clientAccess = await db.query(clientAccessQuery, clientAccessParams);
      if (!clientAccess.rows.length) {
        return res.status(403).json({
          ok: false,
          message: "No tienes acceso al cliente seleccionado para registrar esta visita.",
        });
      }
      // 🕵️ Cotejar con cronograma (Schedules)
      const scheduleCheck = await db.query(
        `SELECT id FROM schedules 
         WHERE user_email = $1 AND client_request_id = $2 
         AND visit_date = $3 AND status IN ('pending', 'approved')`,
        [email, client_id, today]
      );

      // Si no existe en cronograma, registrar como visita no planificada pero permitir el marcado
      const isPlanned = scheduleCheck.rows.length > 0;

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
        [
          client_id,
          email,
          today,
          now,
          location?.split(',')[0],
          location?.split(',')[1],
          isPlanned,
          String(observations || "").trim() || null,
        ]
      );

      // Actualizar estado del cronograma si existe
      if (isPlanned) {
        await db.query(
          `UPDATE schedules SET status = 'in_progress', actual_start_time = $1 
           WHERE id = $2`,
          [now, scheduleCheck.rows[0].id]
        );
      }
    } else if (prospect_name) {
      // Logic for prospect visit
      result = await db.query(
        `INSERT INTO prospect_visits (user_email, prospect_name, visit_date, status, check_in_time, check_in_lat, check_in_lng)
         VALUES ($1, $2, $3, 'in_visit', $4, $5, $6)
         RETURNING *`,
        [email, prospect_name, today, now, location?.split(',')[0], location?.split(',')[1]]
      );
    } else {
      return res.status(400).json({ ok: false, message: "ID de cliente o nombre de prospecto requerido" });
    }

    return res.status(200).json({
      ok: true,
      message: `Entrada a visita registrada para ${prospect_name || 'cliente #' + client_id}`,
      data: result.rows[0]
    });
  } catch (err) {
    logger.error({ err }, "❌ Error en clock-in-field");
    return res.status(500).json({ ok: false, message: "Error registrando entrada a visita" });
  }
};

/**
 * 📍 Field Clock Out - Exit from client visit (iPhone Shortcut compatible)
 * POST /api/attendance/marcar/visita-salida
 * Body: { location, client_id, prospect_name, observations }
 */
const clockOutField = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const { location, client_id, prospect_name, observations } = req.body;

    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const now = new Date();
    const today = getBusinessDate(now);
    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }
    let result;

    if (client_id) {
      result = await db.query(
        `UPDATE client_visit_logs 
         SET status = 'visited', hora_salida = $1, lat_salida = $2, lng_salida = $3, observaciones = COALESCE($4, observaciones),
             duracion_minutos = EXTRACT(EPOCH FROM ($1 - hora_entrada))/60
         WHERE user_email = $5 AND client_request_id = $6 AND visit_date = $7 AND status = 'in_visit'
         RETURNING *`,
        [now, location?.split(',')[0], location?.split(',')[1], observations, email, client_id, today]
      );

      // Actualizar cronograma a completado
      if (result.rows.length > 0) {
        await db.query(
          `UPDATE schedules SET status = 'completed', actual_end_time = $1 
           WHERE user_email = $2 AND client_request_id = $3 AND visit_date = $4`,
          [now, email, client_id, today]
        );
      }
    } else if (prospect_name) {
      result = await db.query(
        `UPDATE prospect_visits 
         SET status = 'visited', check_out_time = $1, check_out_lat = $2, check_out_lng = $3, observations = $4
         WHERE user_email = $5 AND prospect_name = $6 AND visit_date = $7 AND status = 'in_visit'
         RETURNING *`,
        [now, location?.split(',')[0], location?.split(',')[1], observations, email, prospect_name, today]
      );
    }

    if (!result?.rows?.length) {
      return res.status(404).json({ ok: false, message: "No se encontró una visita activa para cerrar hoy" });
    }

    return res.status(200).json({
      ok: true,
      message: "Salida de visita registrada correctamente",
      data: result.rows[0]
    });
  } catch (err) {
    logger.error({ err }, "❌ Error en clock-out-field");
    return res.status(500).json({ ok: false, message: "Error registrando salida de visita" });
  }
};

/**
 * 🚨 Unexpected Exit - Start (iPhone Shortcut compatible)
 * POST /api/attendance/marcar/salida-imprevista
 * Body: { location, description }
 */
const clockOutUnexpected = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const { location, description } = req.body;

    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const now = new Date();
    const today = getBusinessDate(now);
    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }

    // Check if there is already an active exception
    const active = await db.query(
      "SELECT id FROM attendance_exceptions WHERE user_id = $1 AND UPPER(COALESCE(status, '')) <> 'COMPLETED'",
      [userId]
    );

    if (active.rows.length > 0) {
      return res.status(400).json({
        ok: false,
        message: "Ya tienes una salida en curso. Complétala antes de iniciar otra."
      });
    }

    const result = await db.query(
      `INSERT INTO attendance_exceptions (user_id, date, type, description, start_time, start_location, status)
       VALUES ($1, $2, 'IMPREVISTO', $3, $4, $5, 'ACTIVE')
       RETURNING *`,
      [userId, today, description || "Salida imprevista vía atajo", now, location]
    );

    return res.status(200).json({
      ok: true,
      message: "Salida imprevista registrada correctamente",
      data: result.rows[0]
    });
  } catch (err) {
    logger.error({ err }, "❌ Error en clock-out-unexpected");
    return res.status(500).json({ ok: false, message: "Error registrando salida imprevista" });
  }
};

/**
 * 🏠 Unexpected Return - End (iPhone Shortcut compatible)
 * POST /api/attendance/marcar/regreso-imprevisto
 * Body: { location }
 */
const clockInUnexpected = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const { location } = req.body;

    if (!userId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const now = new Date();
    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }
    const result = await db.query(
      `UPDATE attendance_exceptions 
       SET status = 'COMPLETED', end_time = $1, end_location = $2
       WHERE user_id = $3 AND UPPER(COALESCE(status, '')) <> 'COMPLETED'
       RETURNING *`,
      [now, location, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ ok: false, message: "No se encontró una salida imprevista activa" });
    }

    return res.status(200).json({
      ok: true,
      message: "Regreso de salida imprevista registrado correctamente",
      data: result.rows[0]
    });
  } catch (err) {
    logger.error({ err }, "❌ Error en clock-in-unexpected");
    return res.status(500).json({ ok: false, message: "Error registrando regreso imprevisto" });
  }
};

/**
 * ⏰ Mark Overtime - Register additional work time
 * POST /api/attendance/overtime
 * Body: { hours: number, reason: string, location: string }
 */
const markOvertime = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const { hours, reason, location } = req.body;

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    if (!hours || hours <= 0) {
      return res.status(400).json({ ok: false, message: "Horas de overtime deben ser mayores a 0" });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ ok: false, message: "Razón requerida para overtime" });
    }

    const now = new Date();
    if (!(await enforceNoActiveTimeOffForMarking({ res, userEmail: email, now }))) {
      return;
    }
    const today = getBusinessDate(now);

    // Insert overtime record
    const result = await db.query(
      `
      INSERT INTO attendance_overtime (
        user_id, date, hours, reason, location, recorded_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
      `,
      [userId, today, hours, reason.trim(), location || null, now]
    );

    logger.info(`[ATTENDANCE] Overtime marked: ${email} - ${hours}h - ${reason}`);

    return res.status(200).json({
      ok: true,
      message: `Overtime de ${hours} horas registrado correctamente`,
      data: result.rows[0],
    });
  } catch (err) {
    logger.error({ err }, "❌ Error en mark-overtime");
    return res.status(500).json({
      ok: false,
      message: "Error registrando overtime",
    });
  }
};

/**
 * 📊 Get Overtime Records - Get overtime history
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
    logger.error({ err }, "❌ Error obteniendo registros de overtime");
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
        message: "Debes seleccionar un usuario específico para generar el PDF",
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

module.exports = {
  clockIn,
  clockOutLunch,
  clockInLunch,
  clockOut,
  clockInField,
  clockOutField,
  clockOutUnexpected,
  clockInUnexpected,
  registerException,
  updateExceptionStatus,
  getActiveException,
  getToday,
  getUserAttendance,
  getRange,
  generatePDF,
  syncLocation,
  markOvertime,
  getOvertimeRecords,
};
