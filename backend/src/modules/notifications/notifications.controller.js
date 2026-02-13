const service = require("./notifications.service");

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
    if (!payload.user_id) payload.user_id = req.user.id;
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
