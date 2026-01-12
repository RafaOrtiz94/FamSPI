const db = require("../../config/db");
const logger = require("../../config/logger");
const { logAction } = require("../../utils/audit");
const { deepSanitize, sanitizeForExportRow } = require('./security.privacy');

/**
 * Security Center Controller
 * Gestiona eventos de login fuera de horario para usuarios TI
 */

// GET /api/v1/security/offhours-logins
const getOffHoursLogins = async (req, res) => {
  try {
    const {
      from,
      to,
      status,
      reason,
      actor_email,
      ip,
      page = 0,
      pageSize = 20
    } = req.query;

    // Base query - usando datos_nuevos JSONB para metadata
    let query = `
      SELECT
        al.id,
        al.creado_en,
        al.usuario_email,
        u.fullname as actor_fullname,
        al.rol,
        d.code as actor_department,
        al.descripcion,
        al.ip,
        al.user_agent,
        al.datos_nuevos,
        n.id as notification_id,
        n.read_at,
        n.user_id as reviewed_by_user_id,
        ru.fullname as reviewed_by_fullname
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

    // Filtros
    if (from) {
      query += ` AND al.creado_en >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }

    if (to) {
      query += ` AND al.creado_en <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }

    if (status === 'pending') {
      query += ` AND n.read_at IS NULL`;
    } else if (status === 'reviewed') {
      query += ` AND n.read_at IS NOT NULL`;
    }

    if (reason) {
      query += ` AND al.datos_nuevos->>'reason' = $${paramIndex}`;
      params.push(reason);
      paramIndex++;
    }

    if (actor_email) {
      query += ` AND al.usuario_email ILIKE $${paramIndex}`;
      params.push(`%${actor_email}%`);
      paramIndex++;
    }

    if (ip) {
      query += ` AND al.ip ILIKE $${paramIndex}`;
      params.push(`%${ip}%`);
      paramIndex++;
    }

    // Orden y paginación
    query += ` ORDER BY al.creado_en DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(pageSize), parseInt(page) * parseInt(pageSize));

    const result = await db.query(query, params);

    // Formatear respuesta con sanitización profunda
    const events = result.rows.map(row => deepSanitize({
      id: row.id,
      timestamp_local: row.creado_en,
      actor: {
        email: row.usuario_email,
        fullname: row.actor_fullname,
        role: row.rol,
        department: row.actor_department
      },
      reason: row.datos_nuevos?.reason,
      ip: row.ip,
      geo: row.datos_nuevos?.geo_location,
      user_agent: row.user_agent,
      correlation_id: row.datos_nuevos?.correlation_id,
      status: row.read_at ? 'reviewed' : 'pending',
      reviewed_by: row.reviewed_by_fullname,
      reviewed_at: row.read_at,
      event_data: row.datos_nuevos // ✅ Ahora también sanitizado
    }, { isExport: false }));

    // Contar total (sin paginación)
    const countQuery = query.replace('ORDER BY al.creado_en DESC LIMIT $' + paramIndex + ' OFFSET $' + (paramIndex + 1), '');
    const countParams = params.slice(0, -2); // Remove limit/offset
    const countResult = await db.query(`SELECT COUNT(*) as total FROM (${countQuery}) as subquery`, countParams);

    logger.info('[SECURITY] Off-hours logins queried', {
      total: countResult.rows[0].total,
      returned: events.length,
      filters: { from, to, status, reason, actor_email, ip }
    });

    res.json({
      ok: true,
      data: events,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: parseInt(countResult.rows[0].total)
      }
    });

  } catch (err) {
    logger.error('[SECURITY] Error getting off-hours logins:', err);
    res.status(500).json({ ok: false, message: 'Error obteniendo eventos de seguridad' });
  }
};

// GET /api/v1/security/offhours-logins/:id/timeline
const getOffHoursLoginTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    const correlationId = id;

    // Buscar sesión relacionada primero
    const sessionQuery = await db.query(`
      SELECT user_email, login_time, logout_time
      FROM user_sessions
      WHERE user_email = (
        SELECT usuario_email FROM auditoria.logs
        WHERE datos_nuevos->>'correlation_id' = $1
        LIMIT 1
      )
      ORDER BY login_time DESC
      LIMIT 1
    `, [correlationId]);

    let timelineQuery;
    let timelineParams;

    if (sessionQuery.rows.length > 0) {
      // Timeline por ventana temporal (preferido)
      const session = sessionQuery.rows[0];
      timelineQuery = `
        SELECT id, creado_en, modulo, accion, descripcion, ip, user_agent, datos_nuevos
        FROM auditoria.logs
        WHERE usuario_email = $1
          AND created_en >= $2
          AND created_en <= COALESCE($3, $2 + interval '2 hours')
        ORDER BY created_en ASC
        LIMIT 100
      `;
      timelineParams = [session.user_email, session.login_time, session.logout_time];
    } else {
      // Fallback: buscar por correlation_id
      timelineQuery = `
        SELECT id, created_en, modulo, accion, descripcion, ip, user_agent, datos_nuevos
        FROM auditoria.logs
        WHERE datos_nuevos->>'correlation_id' = $1
        ORDER BY created_en ASC
        LIMIT 100
      `;
      timelineParams = [correlationId];
    }

    const result = await db.query(timelineQuery, timelineParams);

    const timeline = result.rows.map(row => ({
      id: row.id,
      timestamp: row.created_en,
      module: row.modulo,
      action: row.accion,
      description: row.descripcion,
      ip: row.ip,
      user_agent: row.user_agent,
      data: row.datos_nuevos
    }));

    logger.info('[SECURITY] Timeline queried', {
      correlation_id: correlationId,
      events_found: timeline.length
    });

    res.json({
      ok: true,
      correlation_id: correlationId,
      timeline
    });

  } catch (err) {
    logger.error('[SECURITY] Error getting timeline:', err);
    res.status(500).json({ ok: false, message: 'Error obteniendo timeline' });
  }
};

// POST /api/v1/security/offhours-logins/:id/review
const reviewOffHoursLogin = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, action } = req.body;
    const reviewerId = req.user.id;
    const correlationId = id;

    // Marcar notificación como leída
    const updateResult = await db.query(`
      UPDATE notifications
      SET status = 'read', read_at = NOW()
      WHERE type = 'security'
        AND source = 'auth'
        AND meta->>'correlation_id' = $1
      RETURNING id
    `, [correlationId]);

    // Registrar auditoría de revisión
    await logAction({
      usuario_id: reviewerId,
      usuario_email: req.user.email,
      rol: req.user.role,
      modulo: 'security',
      accion: 'review_offhours_login',
      descripcion: `Revisó evento de login fuera de horario (correlation_id: ${correlationId})`,
      datos_nuevos: {
        correlation_id: correlationId,
        action: action || 'reviewed',
        notes: notes || null
      }
    });

    logger.info('[SECURITY] Off-hours login reviewed', {
      correlation_id: correlationId,
      reviewer_id: reviewerId,
      action: action || 'reviewed'
    });

    res.json({
      ok: true,
      message: 'Evento revisado exitosamente',
      reviewed_by: reviewerId,
      action: action || 'reviewed'
    });

  } catch (err) {
    logger.error('[SECURITY] Error reviewing event:', err);
    res.status(500).json({ ok: false, message: 'Error revisando evento' });
  }
};

// GET /api/v1/security/offhours-logins/export
const exportOffHoursLogins = async (req, res) => {
  try {
    // Reconstruir lógica de consulta para export (sin paginación)
    const {
      from,
      to,
      status,
      reason,
      actor_email,
      ip,
      format = 'csv'
    } = req.query;

    // Base query para export
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

    // Aplicar mismos filtros que getOffHoursLogins
    if (from) {
      query += ` AND al.creado_en >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }

    if (to) {
      query += ` AND al.creado_en <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }

    if (status === 'pending') {
      query += ` AND n.read_at IS NULL`;
    } else if (status === 'reviewed') {
      query += ` AND n.read_at IS NOT NULL`;
    }

    if (reason) {
      query += ` AND al.datos_nuevos->>'reason' = $${paramIndex}`;
      params.push(reason);
      paramIndex++;
    }

    if (actor_email) {
      query += ` AND al.usuario_email ILIKE $${paramIndex}`;
      params.push(`%${actor_email}%`);
      paramIndex++;
    }

    if (ip) {
      query += ` AND al.ip ILIKE $${paramIndex}`;
      params.push(`%${ip}%`);
      paramIndex++;
    }

    // Orden para export
    query += ` ORDER BY al.creado_en DESC`;

    // Registrar auditoría de export
    await logAction({
      usuario_id: req.user.id,
      usuario_email: req.user.email,
      rol: req.user.role,
      modulo: 'security',
      accion: 'export_offhours_logins',
      descripcion: `Exportó eventos de login fuera de horario (formato: ${format})`,
      datos_nuevos: {
        format,
        filters: { from, to, status, reason, actor_email, ip }
      }
    });

    // Ejecutar consulta de export
    const exportResult = await db.query(query, params);

    // Sanitizar datos para export (SIEMPRE masked)
    const exportData = exportResult.rows.map(row => sanitizeForExportRow({
      timestamp_local: row.creado_en,
      actor_email: row.usuario_email,
      reason: row.datos_nuevos?.reason,
      ip: row.ip,
      status: row.read_at ? 'reviewed' : 'pending',
      event_data: row.datos_nuevos
    }));

    // Generar CSV o JSON
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="offhours-logins.csv"');

      const csvHeader = 'timestamp_local,actor_email,reason,ip,status\n';
      const csvRows = exportData.map(row =>
        `"${row.timestamp_local}","${row.actor_email}","${row.reason}","${row.ip}","${row.status}"`
      ).join('\n');

      res.send(csvHeader + csvRows);
    } else {
      res.json({
        ok: true,
        data: exportData,
        total: exportData.length,
        exported_at: new Date().toISOString()
      });
    }

  } catch (err) {
    logger.error('[SECURITY] Error exporting:', err);
    res.status(500).json({ ok: false, message: 'Error exportando datos' });
  }
};

module.exports = {
  getOffHoursLogins,
  getOffHoursLoginTimeline,
  reviewOffHoursLogin,
  exportOffHoursLogins
};