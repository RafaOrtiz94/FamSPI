const db = require("../../config/db");
const logger = require("../../config/logger");
const { logAction } = require("../../utils/audit");
const { deepSanitize, sanitizeForExportRow } = require("./security.privacy");

const getOffHoursLogins = async (req, res) => {
  try {
    const { from, to, status, reason, actor_email, ip, page = 0, pageSize = 20 } = req.query;

    let query = `
      SELECT
        al.id,
        al.creado_en,
        al.usuario_email,
        COALESCE(u.fullname, u.name, u.email) AS actor_fullname,
        al.rol,
        d.code AS actor_department,
        al.descripcion,
        al.ip,
        al.user_agent,
        al.datos_nuevos,
        n.id AS notification_id,
        n.read_at,
        n.user_id AS reviewed_by_user_id,
        COALESCE(ru.fullname, ru.name, ru.email) AS reviewed_by_fullname
      FROM auditoria.logs al
      LEFT JOIN users u ON u.email = al.usuario_email
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN notifications n ON (
        n.type = 'security' AND
        n.source = 'auth' AND
        n.meta->>'correlation_id' = al.datos_nuevos->>'correlation_id'
      )
      LEFT JOIN users ru ON ru.id = n.user_id
      WHERE al.modulo = 'auth'
        AND al.accion = 'offhours_login'
    `;

    const params = [];
    let paramIndex = 1;

    if (from) {
      query += ` AND al.creado_en >= $${paramIndex}`;
      params.push(from);
      paramIndex += 1;
    }

    if (to) {
      query += ` AND al.creado_en <= $${paramIndex}`;
      params.push(to);
      paramIndex += 1;
    }

    if (status === "pending") {
      query += " AND n.read_at IS NULL";
    } else if (status === "reviewed") {
      query += " AND n.read_at IS NOT NULL";
    }

    if (reason) {
      query += ` AND al.datos_nuevos->>'reason' = $${paramIndex}`;
      params.push(reason);
      paramIndex += 1;
    }

    if (actor_email) {
      query += ` AND al.usuario_email ILIKE $${paramIndex}`;
      params.push(`%${actor_email}%`);
      paramIndex += 1;
    }

    if (ip) {
      query += ` AND al.ip::text ILIKE $${paramIndex}`;
      params.push(`%${ip}%`);
      paramIndex += 1;
    }

    query += ` ORDER BY al.creado_en DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(pageSize, 10), parseInt(page, 10) * parseInt(pageSize, 10));

    const result = await db.query(query, params);

    const events = result.rows.map((row) =>
      deepSanitize(
        {
          id: row.id,
          timestamp_local: row.creado_en,
          actor: {
            email: row.usuario_email,
            fullname: row.actor_fullname,
            role: row.rol,
            department: row.actor_department,
          },
          reason: row.datos_nuevos?.reason,
          ip: row.ip,
          geo: row.datos_nuevos?.geo_location,
          user_agent: row.user_agent,
          correlation_id: row.datos_nuevos?.correlation_id,
          status: row.read_at ? "reviewed" : "pending",
          reviewed_by: row.reviewed_by_fullname,
          reviewed_at: row.read_at,
          event_data: row.datos_nuevos,
        },
        { isExport: false }
      )
    );

    const countQuery = query.replace(` ORDER BY al.creado_en DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, "");
    const countResult = await db.query(`SELECT COUNT(*) AS total FROM (${countQuery}) AS subquery`, params.slice(0, -2));

    logger.info("[SECURITY] Off-hours logins queried", {
      total: countResult.rows[0].total,
      returned: events.length,
      filters: { from, to, status, reason, actor_email, ip },
    });

    return res.json({
      ok: true,
      data: events,
      pagination: {
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        total: parseInt(countResult.rows[0].total, 10),
      },
    });
  } catch (err) {
    logger.error("[SECURITY] Error getting off-hours logins:", err);
    return res.status(500).json({ ok: false, message: "Error obteniendo eventos de seguridad" });
  }
};

const getOffHoursLoginTimeline = async (req, res) => {
  try {
    const { id: correlationId } = req.params;

    const sessionQuery = await db.query(
      `
      SELECT user_email, login_time, logout_time
      FROM user_sessions
      WHERE user_email = (
        SELECT usuario_email
        FROM auditoria.logs
        WHERE datos_nuevos->>'correlation_id' = $1
        LIMIT 1
      )
      ORDER BY login_time DESC
      LIMIT 1
      `,
      [correlationId]
    );

    let timelineQuery;
    let timelineParams;

    if (sessionQuery.rows.length > 0) {
      const session = sessionQuery.rows[0];
      timelineQuery = `
        SELECT id, creado_en, modulo, accion, descripcion, ip, user_agent, datos_nuevos
        FROM auditoria.logs
        WHERE usuario_email = $1
          AND creado_en >= $2
          AND creado_en <= COALESCE($3, $2 + interval '2 hours')
        ORDER BY creado_en ASC
        LIMIT 100
      `;
      timelineParams = [session.user_email, session.login_time, session.logout_time];
    } else {
      timelineQuery = `
        SELECT id, creado_en, modulo, accion, descripcion, ip, user_agent, datos_nuevos
        FROM auditoria.logs
        WHERE datos_nuevos->>'correlation_id' = $1
        ORDER BY creado_en ASC
        LIMIT 100
      `;
      timelineParams = [correlationId];
    }

    const result = await db.query(timelineQuery, timelineParams);
    const timeline = result.rows.map((row) => ({
      id: row.id,
      timestamp: row.creado_en,
      module: row.modulo,
      action: row.accion,
      description: row.descripcion,
      ip: row.ip,
      user_agent: row.user_agent,
      data: row.datos_nuevos,
    }));

    logger.info("[SECURITY] Timeline queried", {
      correlation_id: correlationId,
      events_found: timeline.length,
    });

    return res.json({ ok: true, correlation_id: correlationId, timeline });
  } catch (err) {
    logger.error("[SECURITY] Error getting timeline:", err);
    return res.status(500).json({ ok: false, message: "Error obteniendo timeline" });
  }
};

const reviewOffHoursLogin = async (req, res) => {
  try {
    const { id: correlationId } = req.params;
    const { notes, action } = req.body || {};
    const reviewerId = req.user.id;

    await db.query(
      `
      UPDATE notifications
      SET status = 'read', read_at = NOW()
      WHERE type = 'security'
        AND source = 'auth'
        AND meta->>'correlation_id' = $1
      `,
      [correlationId]
    );

    await logAction({
      usuario_id: reviewerId,
      usuario_email: req.user.email,
      rol: req.user.role,
      modulo: "security",
      accion: "review_offhours_login",
      descripcion: `Reviso evento de login fuera de horario (correlation_id: ${correlationId})`,
      datos_nuevos: {
        correlation_id: correlationId,
        action: action || "reviewed",
        notes: notes || null,
      },
    });

    logger.info("[SECURITY] Off-hours login reviewed", {
      correlation_id: correlationId,
      reviewer_id: reviewerId,
      action: action || "reviewed",
    });

    return res.json({
      ok: true,
      message: "Evento revisado exitosamente",
      reviewed_by: reviewerId,
      action: action || "reviewed",
    });
  } catch (err) {
    logger.error("[SECURITY] Error reviewing event:", err);
    return res.status(500).json({ ok: false, message: "Error revisando evento" });
  }
};

const exportOffHoursLogins = async (req, res) => {
  try {
    const { from, to, status, reason, actor_email, ip, format = "csv" } = req.query;

    let query = `
      SELECT
        al.creado_en,
        al.usuario_email,
        al.datos_nuevos,
        al.ip,
        n.read_at
      FROM auditoria.logs al
      LEFT JOIN notifications n ON (
        n.type = 'security' AND
        n.source = 'auth' AND
        n.meta->>'correlation_id' = al.datos_nuevos->>'correlation_id'
      )
      WHERE al.modulo = 'auth'
        AND al.accion = 'offhours_login'
    `;

    const params = [];
    let paramIndex = 1;

    if (from) {
      query += ` AND al.creado_en >= $${paramIndex}`;
      params.push(from);
      paramIndex += 1;
    }

    if (to) {
      query += ` AND al.creado_en <= $${paramIndex}`;
      params.push(to);
      paramIndex += 1;
    }

    if (status === "pending") {
      query += " AND n.read_at IS NULL";
    } else if (status === "reviewed") {
      query += " AND n.read_at IS NOT NULL";
    }

    if (reason) {
      query += ` AND al.datos_nuevos->>'reason' = $${paramIndex}`;
      params.push(reason);
      paramIndex += 1;
    }

    if (actor_email) {
      query += ` AND al.usuario_email ILIKE $${paramIndex}`;
      params.push(`%${actor_email}%`);
      paramIndex += 1;
    }

    if (ip) {
      query += ` AND al.ip::text ILIKE $${paramIndex}`;
      params.push(`%${ip}%`);
      paramIndex += 1;
    }

    query += " ORDER BY al.creado_en DESC";

    await logAction({
      usuario_id: req.user.id,
      usuario_email: req.user.email,
      rol: req.user.role,
      modulo: "security",
      accion: "export_offhours_logins",
      descripcion: `Exporto eventos de login fuera de horario (formato: ${format})`,
      datos_nuevos: {
        format,
        filters: { from, to, status, reason, actor_email, ip },
      },
    });

    const exportResult = await db.query(query, params);
    const exportData = exportResult.rows.map((row) =>
      sanitizeForExportRow({
        timestamp_local: row.creado_en,
        actor_email: row.usuario_email,
        reason: row.datos_nuevos?.reason,
        ip: row.ip,
        status: row.read_at ? "reviewed" : "pending",
        event_data: row.datos_nuevos,
      })
    );

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="offhours-logins.csv"');

      const csvHeader = "timestamp_local,actor_email,reason,ip,status\n";
      const csvRows = exportData
        .map((row) => `"${row.timestamp_local}","${row.actor_email}","${row.reason}","${row.ip}","${row.status}"`)
        .join("\n");

      return res.send(csvHeader + csvRows);
    }

    return res.json({ ok: true, data: exportData, total: exportData.length, exported_at: new Date().toISOString() });
  } catch (err) {
    logger.error("[SECURITY] Error exporting:", err);
    return res.status(500).json({ ok: false, message: "Error exportando datos" });
  }
};

module.exports = {
  getOffHoursLogins,
  getOffHoursLoginTimeline,
  reviewOffHoursLogin,
  exportOffHoursLogins,
};
