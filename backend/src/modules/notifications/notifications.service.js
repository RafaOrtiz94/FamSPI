const db = require("../../config/db");
const logger = require("../../config/logger");
const NotificationManager = require('./notificationManager');

const mapNotificationRow = (row) => ({
  id: row.id,
  user_id: row.user_id,
  title: row.title,
  message: row.message,
  type: row.type,
  source: row.source,
  status: row.status,
  priority: row.priority,
  meta: row.meta || {},
  created_at: row.created_at,
  read_at: row.read_at,
});

const listNotifications = async (userId, { status } = {}) => {
  const params = [userId];
  let query = `
    SELECT id, user_id, title, message, type, source, status, priority, meta, created_at, read_at
    FROM notifications
    WHERE user_id = $1
  `;

  if (status) {
    query += " AND status = $2";
    params.push(status);
  }

  query += " ORDER BY created_at DESC";

  const { rows } = await db.query(query, params);
  return rows.map(mapNotificationRow);
};

const createNotification = async (payload) => {
  const {
    user_id,
    title,
    message = null,
    type = "info",
    source = null,
    status = "unread",
    priority = 0,
    meta = {},
  } = payload;

  if (!user_id || !title) throw new Error("user_id y title son requeridos");

  const { rows } = await db.query(
    `
    INSERT INTO notifications (user_id, title, message, type, source, status, priority, meta, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING id, user_id, title, message, type, source, status, priority, meta, created_at, read_at
    `,
    [user_id, title, message, type, source, status, priority, meta]
  );

  return mapNotificationRow(rows[0]);
};

const markAsRead = async (userId, notificationId) => {
  const { rows } = await db.query(
    `
    UPDATE notifications
    SET status = 'read', read_at = COALESCE(read_at, NOW())
    WHERE id = $1 AND user_id = $2
    RETURNING id, user_id, title, message, type, source, status, priority, meta, created_at, read_at
    `,
    [notificationId, userId]
  );

  if (rows.length === 0) return null;
  return mapNotificationRow(rows[0]);
};

const markAllAsRead = async (userId) => {
  const result = await db.query(
    `
    UPDATE notifications
    SET status = 'read', read_at = COALESCE(read_at, NOW())
    WHERE user_id = $1 AND status <> 'read'
    RETURNING id, user_id, title, message, type, source, status, priority, meta, created_at, read_at
    `,
    [userId]
  );

  return result.rows.map(mapNotificationRow);
};

const getUnreadCount = async (userId) => {
  const { rows } = await db.query(
    `SELECT COUNT(*) AS total FROM notifications WHERE user_id = $1 AND status = 'unread'`,
    [userId]
  );

  return Number(rows[0]?.total || 0);
};

/**
 * Notifica a usuarios TI sobre login fuera de horario
 * @param {Object} params - Parámetros de la notificación
 * @param {string} params.correlationId - ID de correlación para tracking
 * @param {Object} params.user - Usuario que hizo login
 * @param {Object} params.offHoursCheck - Información sobre horario
 * @param {string} params.ip - IP del usuario
 * @param {Object} params.geo - Información geográfica
 * @param {string} params.userAgent - User-Agent del navegador
 */
const notifyTIAboutOffHoursLogin = async ({
  correlationId,
  user,
  offHoursCheck,
  ip,
  geo,
  userAgent
}) => {
  try {
    logger.info(`🔐 Notificando a TI sobre login fuera de horario: ${user.email}`, { correlationId });

    // 1. Encontrar usuarios TI (roles 'ti' y 'jefe_ti')
    const tiUsersQuery = await db.query(
      `SELECT id, email, fullname FROM users WHERE role IN ('ti', 'jefe_ti') AND role IS NOT NULL`,
      []
    );

    if (tiUsersQuery.rows.length === 0) {
      logger.warn('⚠️ No se encontraron usuarios TI para notificar sobre login fuera de horario', { correlationId });
      return; // No hay usuarios TI, pero no fallamos
    }

    // 2. Construir mensaje de notificación
    const schedule = offHoursCheck.schedule || { tz: 'America/Guayaquil', start: '07:30', end: '20:00', workDays: [1,2,3,4,5] };
    const workDaysNames = schedule.workDays.map(d => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d]).join(', ');

    const title = '🚨 Login fuera de horario detectado';
    const message = `
Usuario: ${user.fullname} (${user.email})
Motivo: ${offHoursCheck.reason}
Horario laboral: ${schedule.start} - ${schedule.end} (${schedule.tz})
Días hábiles: ${workDaysNames}
IP: ${ip}
Ubicación: ${geo?.city || 'Desconocida'}, ${geo?.country || 'Desconocido'}
Navegador: ${userAgent?.substring(0, 100) || 'Desconocido'}
Correlation ID: ${correlationId}
    `.trim();

    // 3. Enviar notificación a cada usuario TI
    const notificationsSent = [];
    for (const tiUser of tiUsersQuery.rows) {
      try {
        const notification = await NotificationManager.sendNotification({
          userId: tiUser.id,
          template: 'custom_html',
          customTitle: title,
          customMessage: message,
          type: 'error',
          priority: 3, // Alta prioridad
          source: 'security.offhours_login',
          meta: {
            correlationId,
            userId: user.id,
            userEmail: user.email,
            ip,
            geo,
            userAgent,
            offHoursCheck,
            timestamp: new Date().toISOString()
          },
          email: true, // Enviar por email
          chat: true  // Enviar por Google Chat
        });

        notificationsSent.push({
          tiUser: tiUser.email,
          notificationId: notification.id
        });

        logger.info(`✅ Notificación enviada a TI: ${tiUser.email}`, {
          correlationId,
          tiUserId: tiUser.id,
          notificationId: notification.id
        });

      } catch (notifyError) {
        logger.error(`❌ Error notificando a TI ${tiUser.email}: ${notifyError.message}`, {
          correlationId,
          tiUserId: tiUser.id,
          error: notifyError.message
        });
        // Continuamos con otros usuarios TI aunque uno falle
      }
    }

    logger.info(`✅ Notificaciones de login fuera de horario completadas`, {
      correlationId,
      tiUsersNotified: notificationsSent.length,
      totalTIUsers: tiUsersQuery.rows.length
    });

  } catch (error) {
    // Loggear error pero NO lanzar excepción - el login debe continuar
    logger.error(`❌ Error crítico en notifyTIAboutOffHoursLogin: ${error.message}`, {
      correlationId,
      userId: user?.id,
      userEmail: user?.email,
      error: error.stack
    });
  }
};

module.exports = {
  listNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  notifyTIAboutOffHoursLogin,
};
