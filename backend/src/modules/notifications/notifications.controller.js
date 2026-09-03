const service = require("./notifications.service");
const pushSubscriptionsService = require("./pushSubscriptions.service");

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
    const includeCleared = req.query.include_cleared === "true" || req.query.include_cleared === "1";
    const notifications = await service.listNotifications(req.user.id, {
      status: req.query.status,
      includeCleared,
    });
    const unread = notifications.filter((n) => n.status !== "read" && !n.cleared_at).length;

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

const getPushConfig = async (_req, res) => {
  try {
    const config = pushSubscriptionsService.getPushConfig();
    return res.status(200).json({ ok: true, data: config });
  } catch (err) {
    console.error("Error obteniendo configuracion push", err);
    return res.status(500).json({
      ok: false,
      message: "No se pudo obtener la configuracion push",
    });
  }
};

const getPushStatus = async (req, res) => {
  try {
    const status = await pushSubscriptionsService.getUserPushStatus(req.user.id);
    return res.status(200).json({ ok: true, data: status });
  } catch (err) {
    console.error("Error obteniendo estado push", err);
    return res.status(500).json({
      ok: false,
      message: "No se pudo obtener el estado de notificaciones push",
    });
  }
};

const subscribePush = async (req, res) => {
  try {
    const config = pushSubscriptionsService.getPushConfig();
    if (!config.enabled || !config.publicKey) {
      return res.status(503).json({
        ok: false,
        message: "Push web no configurado en este ambiente",
      });
    }

    const row = await pushSubscriptionsService.upsertSubscription({
      userId: req.user.id,
      subscription: req.body?.subscription,
      userAgent: req.get("user-agent") || null,
      deviceLabel: req.body?.device_label || null,
      appPath: req.get("x-app-path") || null,
    });

    return res.status(201).json({ ok: true, data: row });
  } catch (err) {
    console.error("Error registrando suscripcion push", err);
    return res.status(400).json({
      ok: false,
      message: err.message || "No se pudo registrar la suscripcion push",
    });
  }
};

const unsubscribePush = async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) {
      return res.status(400).json({
        ok: false,
        message: "endpoint es requerido",
      });
    }

    const row = await pushSubscriptionsService.disableSubscription({
      userId: req.user.id,
      endpoint,
    });

    return res.status(200).json({ ok: true, data: row });
  } catch (err) {
    console.error("Error deshabilitando suscripcion push", err);
    return res.status(500).json({
      ok: false,
      message: "No se pudo deshabilitar la suscripcion push",
    });
  }
};

module.exports = {
  list,
  create,
  markRead,
  markAll,
  remove,
  clear,
  getPushConfig,
  getPushStatus,
  subscribePush,
  unsubscribePush,
};
