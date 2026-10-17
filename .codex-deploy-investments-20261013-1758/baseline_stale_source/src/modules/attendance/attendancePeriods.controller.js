const { getRequestContext } = require("./attendanceRequestContext.service");
const { logAttendanceAuditEvent } = require("./attendanceAuditTrail.service");
const { canManageAttendancePeriods, getCurrentPeriod, transitionPeriod } = require("./attendancePeriods.service");

const VALID_STATUS = new Set(["open", "in_review", "pending_signatures", "closed", "reopened", "locked"]);

const getCurrent = async (req, res) => {
  try {
    const period = await getCurrentPeriod();
    return res.status(200).json({ ok: true, data: period });
  } catch (err) {
    return res.status(500).json({ ok: false, message: "Error consultando periodo" });
  }
};

const transition = async (req, res) => {
  try {
    const actorUserId = Number(req.user?.id || 0);
    if (!actorUserId) return res.status(401).json({ ok: false, message: "No autorizado" });
    if (!canManageAttendancePeriods(req.user)) {
      return res.status(403).json({ ok: false, message: "Sin permisos para gestionar periodos" });
    }

    const periodKey = String(req.params?.periodKey || "").trim();
    const status = String(req.body?.status || "").trim();
    const reason = String(req.body?.reason || "").trim();
    if (!VALID_STATUS.has(status)) {
      return res.status(400).json({ ok: false, message: "status invalido" });
    }
    if ((status === "reopened" || status === "locked") && reason.length < 8) {
      return res.status(400).json({ ok: false, message: "Motivo obligatorio para reopened/locked" });
    }

    const requestContext = getRequestContext(req, "attendance-period-transition");
    const updated = await transitionPeriod({ periodKey, newStatus: status, actorUserId, reason, requestContext });
    if (!updated) return res.status(404).json({ ok: false, message: "Periodo no encontrado" });

    await logAttendanceAuditEvent({
      actorUserId,
      action: `attendance.period.${status}`,
      endpoint: req.originalUrl,
      method: req.method,
      newValue: updated,
      reason,
      result: "ok",
      requestContext,
    });

    return res.status(200).json({ ok: true, data: updated });
  } catch (err) {
    return res.status(500).json({ ok: false, message: "Error actualizando periodo" });
  }
};

module.exports = {
  getCurrent,
  transition,
};
