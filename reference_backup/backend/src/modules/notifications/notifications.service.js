const db = require("../../config/db");

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

module.exports = {
  listNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};
