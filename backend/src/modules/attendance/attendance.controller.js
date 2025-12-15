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

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    // Check if already clocked in today
    const existing = await db.query(
      "SELECT id, entry_time FROM user_attendance_records WHERE user_id = $1 AND date = $2",
      [userId, today]
    );

    if (existing.rows.length > 0 && existing.rows[0].entry_time) {
      return res.status(400).json({
        ok: false,
        message: "Ya has marcado entrada hoy",
        data: existing.rows[0],
      });
    }

    // Insert or update record
    // We use a safe query that works even if columns don't exist yet (if migration failed), 
    // but ideally migration is run. Assuming migration ran:
    const result = await db.query(
      `
      INSERT INTO user_attendance_records (user_id, date, entry_time, entry_location)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, date) 
      DO UPDATE SET entry_time = $3, entry_location = $4, updated_at = NOW()
      RETURNING *;
      `,
      [userId, today, now, location || null]
    );

    logger.info(`[ATTENDANCE] Clock in: ${email} at ${now.toISOString()} loc: ${location}`);

    return res.status(200).json({
      ok: true,
      message: "Entrada registrada correctamente",
      data: result.rows[0],
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

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

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

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

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
 * Body: { location }
 */
const clockOut = async (req, res) => {
  try {
    const { id: userId, email } = req.user || {};
    const { location } = req.body;

    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    // Check if record exists
    const existing = await db.query(
      "SELECT id, entry_time, exit_time FROM user_attendance_records WHERE user_id = $1 AND date = $2",
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

    // Update exit time and location
    const result = await db.query(
      `
      UPDATE user_attendance_records
      SET exit_time = $1, exit_location = $4, updated_at = NOW()
      WHERE user_id = $2 AND date = $3
      RETURNING *;
      `,
      [now, userId, today, location || null]
    );

    logger.info(`[ATTENDANCE] Clock out: ${email} at ${now.toISOString()} loc: ${location}`);

    return res.status(200).json({
      ok: true,
      message: "Salida registrada correctamente",
      data: result.rows[0],
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
 * ⚠️ Register Exception (Salida Inesperada)
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

    const result = await db.query(
      `
      INSERT INTO attendance_exceptions (user_id, date, type, description, location, timestamp)
      VALUES ($1, CURRENT_DATE, $2, $3, $4, NOW())
      RETURNING *;
      `,
      [userId, type, description, location || null]
    );

    logger.info(`[ATTENDANCE] Exception: ${email} - ${type}`);

    return res.status(200).json({
      ok: true,
      message: "Excepción registrada correctamente",
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
 * 📅 Get Today's Attendance - For current user
 * GET /api/attendance/today
 */
const getToday = async (req, res) => {
  try {
    const { id: userId } = req.user || {};
    if (!userId) {
      return res.status(401).json({ ok: false, message: "No autorizado" });
    }

    const today = new Date().toISOString().split("T")[0];

    const result = await db.query(
      "SELECT * FROM user_attendance_records WHERE user_id = $1 AND date = $2",
      [userId, today]
    );

    return res.status(200).json({
      ok: true,
      data: result.rows[0] || null,
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
    const { userId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        ok: false,
        message: "Fecha requerida (formato: YYYY-MM-DD)",
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
      [userId, date]
    );

    return res.status(200).json({
      ok: true,
      data: result.rows[0] || null,
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
    const { start, end, userId } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        ok: false,
        message: "Fechas de inicio y fin requeridas",
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

    if (userId) {
      query += " AND a.user_id = $3";
      params.push(userId);
    }

    query += " ORDER BY a.date DESC, u.fullname ASC";

    const result = await db.query(query, params);

    return res.status(200).json({
      ok: true,
      total: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    logger.error({ err }, "❌ Error obteniendo rango de asistencia");
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo registros de asistencia",
    });
  }
};

module.exports = {
  clockIn,
  clockOutLunch,
  clockInLunch,
  clockOut,
  registerException,
  getToday,
  getUserAttendance,
  getRange,
};
