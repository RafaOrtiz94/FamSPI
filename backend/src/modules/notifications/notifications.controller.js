const service = require("./notifications.service");

const PRIVILEGED_NOTIFICATION_TARGET_ROLES = new Set([
  "ti",
  "jefe_ti",
  "jefe_de_ti",
  "soporte",
  "desarrollador",
  "admin_ti",
  "admin",
  "administrador",
]);

const normalizeRoleName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const collectUserRoles = (user = {}) => {
  const roles = new Set();
  const pushRole = (value) => {
    const normalized = normalizeRoleName(value);
    if (normalized) roles.add(normalized);
  };

  pushRole(user.role);
  pushRole(user.scope);
  pushRole(user.role_name);

  if (Array.isArray(user.roles)) user.roles.forEach(pushRole);
  if (Array.isArray(user.scopes)) user.scopes.forEach(pushRole);

  return roles;
};

const canTargetOtherUsers = (user = {}) => {
  const roles = collectUserRoles(user);
  for (const role of roles) {
    if (PRIVILEGED_NOTIFICATION_TARGET_ROLES.has(role)) return true;
  }
  return false;
};

const list = async (req, res) => {
  try {
    const notifications = await service.listNotifications(req.user.id, {
      status: req.query.status,
    });
    const unread = await service.getUnreadCount(req.user.id);

    return res.status(200).json({ ok: true, data: notifications, unread });
  } catch (err) {
    console.error("Error listando notificaciones", err);
    return res
      .status(500)
      .json({ ok: false, message: "No se pudieron obtener las notificaciones" });
  }
};

const create = async (req, res) => {
  try {
    const payload = { ...req.body };
    const requestedUserId = payload.user_id ?? req.user.id;
    const isCrossUserTarget = String(requestedUserId) !== String(req.user.id);

    if (isCrossUserTarget && !canTargetOtherUsers(req.user)) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para crear notificaciones para otros usuarios",
      });
    }

    payload.user_id = requestedUserId;
    const notification = await service.createNotification(payload);
    return res.status(201).json({ ok: true, data: notification });
  } catch (err) {
    console.error("Error creando notificación", err);
    return res
      .status(400)
      .json({ ok: false, message: err.message || "No se pudo crear la notificación" });
  }
};

const markRead = async (req, res) => {
  try {
    const updated = await service.markAsRead(req.user.id, req.params.id);
    if (!updated) return res.status(404).json({ ok: false, message: "No encontrada" });
    return res.status(200).json({ ok: true, data: updated });
  } catch (err) {
    console.error("Error marcando notificación", err);
    return res
      .status(500)
      .json({ ok: false, message: "No se pudo actualizar la notificación" });
  }
};

const markAll = async (req, res) => {
  try {
    const updated = await service.markAllAsRead(req.user.id);
    return res.status(200).json({ ok: true, data: updated });
  } catch (err) {
    console.error("Error marcando notificaciones", err);
    return res
      .status(500)
      .json({ ok: false, message: "No se pudieron actualizar las notificaciones" });
  }
};

const remove = async (req, res) => {
  try {
    const removed = await service.deleteNotification(req.user.id, req.params.id);
    if (!removed) return res.status(404).json({ ok: false, message: "No encontrada" });
    return res.status(200).json({ ok: true, data: removed });
  } catch (err) {
    console.error("Error eliminando notificación", err);
    return res
      .status(500)
      .json({ ok: false, message: "No se pudo eliminar la notificación" });
  }
};

const clear = async (req, res) => {
  try {
    const removed = await service.clearNotifications(req.user.id);
    return res.status(200).json({ ok: true, data: removed });
  } catch (err) {
    console.error("Error limpiando notificaciones", err);
    return res
      .status(500)
      .json({ ok: false, message: "No se pudieron eliminar las notificaciones" });
  }
};

module.exports = {
  list,
  create,
  markRead,
  markAll,
  remove,
  clear,
};
