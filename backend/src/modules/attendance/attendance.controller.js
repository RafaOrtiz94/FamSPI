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
const { normalizeDateTime, toNumberOrZero, normalizeRow } = require("../../utils/normalizers");
const { getBusinessDate, ensureDailyClockIn } = require("./attendance.utils");
const { generateAttendancePDF } = require("./attendance.service");
const { hasReportingAccess } = require("./attendance.auth");

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

const ATTENDANCE_STATUS_LABELS = Object.freeze({
  no_entry: "Sin entrada",
  working: "Jornada abierta",
  lunch_open: "Almuerzo abierto",
  completed: "Jornada cerrada",
});

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
  return {
    ...record,
    attendance_status: attendanceState,
    attendance_status_label: ATTENDANCE_STATUS_LABELS[attendanceState] || "Sin estado",
  };
};

const enrichAttendanceRows = (rows = []) => rows.map((row) => enrichAttendanceRow(row));

const matchesAttendanceState = (record, statusFilter) => {
  const normalizedFilter = normalizeAttendanceStateFilter(statusFilter);
  if (!normalizedFilter) return true;
  return deriveAttendanceState(record) === normalizedFilter;
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
    const ensured = await ensureDailyClockIn({ userId, location: location || null, timestamp: now });

    if (!ensured.created) {
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
    const { id: userId, email } = req.user || {};
    const { location, isOvertime } = req.body;

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const now = new Date();
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

    // Update exit time, location, and overtime info
    const result = await db.query(
      `
      UPDATE user_attendance_records
      SET exit_time = $1, exit_location = $4, is_overtime = $5, overtime_hours = $6, total_hours = $7, updated_at = NOW()
      WHERE user_id = $2 AND date = $3
      RETURNING *;
      `,
      [now, userId, today, location || null, isOvertime || overtimeHours > 0, overtimeHours, workedHours]
    );

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
 * Body: { type, description, location }
 */
const registerException = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const { type, description, location } = req.body;

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }
    if (!type || !description) {
      return res.status(400).json({ ok: false, message: "Tipo y descripción requeridos" });
    }

    // Check if there is already an active exception
    const active = await db.query(
      "SELECT id FROM attendance_exceptions WHERE user_id = $1 AND status != 'COMPLETED'",
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
      VALUES ($1, CURRENT_DATE, $2, $3, NOW(), $4, 'ACTIVE')
      RETURNING *;
      `,
      [userId, type, description, location || null]
    );

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
      "SELECT * FROM attendance_exceptions WHERE user_id = $1 AND status != 'COMPLETED' ORDER BY id DESC LIMIT 1",
      [userId]
    );

    if (active.rows.length === 0) {
      return res.status(404).json({ ok: false, message: "No tieens ninguna salida en curso" });
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
      "SELECT * FROM attendance_exceptions WHERE user_id = $1 AND status != 'COMPLETED' ORDER BY id DESC LIMIT 1",
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
    const { start, end, userId, status } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        ok: false,
        message: "Fechas de inicio y fin requeridas",
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

    let query = `
      SELECT 
        a.*,
        u.fullname,
        u.email,
        u.role,
        d.name AS department_name
      FROM user_attendance_records a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE a.date BETWEEN $1 AND $2
    `;

    const params = [start, end];

    if (isAdminScope && hasExplicitTarget) {
      query += " AND a.user_id = $3";
      params.push(targetUserId);
    } else if (!isAdminScope) {
      query += " AND a.user_id = $3";
      params.push(requesterId);
    }

    query += " ORDER BY a.date DESC, u.fullname ASC";

    const result = await db.query(query, params);
    const normalizedRows = enrichAttendanceRows(result.rows);
    const filteredRows = normalizedStatus
      ? normalizedRows.filter((row) => row.attendance_status === normalizedStatus)
      : normalizedRows;

    const summary = normalizedRows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc.byStatus[row.attendance_status] = (acc.byStatus[row.attendance_status] || 0) + 1;
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
      }
    );

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
    });
  } catch (err) {
    logger.error({ err }, "❌ Error obteniendo rango de asistencia");
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo registros de asistencia",
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
    const location = String(req.body?.location || "").trim();

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    if (!target || !location) {
      return res.status(400).json({ ok: false, message: "Target y location son requeridos" });
    }

    if (ATTENDANCE_LOCATION_TARGETS[target]) {
      const { timeColumn, locationColumn } = ATTENDANCE_LOCATION_TARGETS[target];
      const today = getBusinessDate();
      const result = await db.query(
        `
        UPDATE user_attendance_records
           SET ${locationColumn} = COALESCE(NULLIF(${locationColumn}, ''), $3),
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
      const result = await db.query(
        `
        UPDATE attendance_exceptions
           SET ${locationColumn} = COALESCE(NULLIF(${locationColumn}, ''), $2),
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
    return res.status(500).json({
      ok: false,
      message: "Error sincronizando ubicacion",
    });
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
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        ok: false,
        message: "Fechas de inicio y fin requeridas (start, end)",
      });
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

    const pdfBuffer = await generateAttendancePDF(targetUserId, start, end);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=asistencia-${targetUserId}-${start}-${end}.pdf`
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
