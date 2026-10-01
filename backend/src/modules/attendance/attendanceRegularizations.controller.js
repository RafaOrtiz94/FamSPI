const { getRequestContext } = require("./attendanceRequestContext.service");
const { logAttendanceAuditEvent } = require("./attendanceAuditTrail.service");
const {
  canApproveRegularization,
  createRegularization,
  listRegularizations,
  transitionRegularization,
} = require("./attendanceRegularizations.service");

const VALID_TYPES = new Set([
  "late_arrival",
  "early_departure",
  "missing_clock_in",
  "missing_lunch_out",
  "missing_lunch_in",
  "missing_clock_out",
  "wrong_location",
  "field_operation_adjustment",
  "client_visit_adjustment",
  "offline_sync_adjustment",
]);

const create = async (req, res) => {
  try {
    const requesterUserId = Number(req.user?.id || 0);
    if (!requesterUserId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const affectedUserId = Number(req.body?.affected_user_id || requesterUserId);
    const attendanceDate = String(req.body?.attendance_date || "").trim();
    const regularizationType = String(req.body?.regularization_type || "").trim();
    const reason = String(req.body?.reason || "").trim();

    if (!attendanceDate || !/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate)) {
      return res.status(400).json({ ok: false, message: "attendance_date invalida" });
    }
    if (!VALID_TYPES.has(regularizationType)) {
      return res.status(400).json({ ok: false, message: "regularization_type invalido" });
    }
    if (reason.length < 8) {
      return res.status(400).json({ ok: false, message: "Motivo insuficiente" });
    }

    const requestContext = getRequestContext(req, "regularization-create");
    const created = await createRegularization({
      requesterUserId,
      affectedUserId,
      attendanceDate,
      regularizationType,
      reason,
      originalTimestamp: req.body?.original_timestamp || null,
      requestedTimestamp: req.body?.requested_timestamp || null,
      evidence: req.body?.evidence || null,
      requestContext,
    });

    await logAttendanceAuditEvent({
      actorUserId: requesterUserId,
      affectedUserId,
      action: "attendance.regularization.create",
      endpoint: req.originalUrl,
      method: req.method,
      newValue: created,
      result: "ok",
      requestContext,
    });

    return res.status(201).json({ ok: true, data: created });
  } catch (err) {
    return res.status(500).json({ ok: false, message: "Error creando regularizacion" });
  }
};

const list = async (req, res) => {
  try {
    const requesterUserId = Number(req.user?.id || 0);
    if (!requesterUserId) return res.status(401).json({ ok: false, message: "No autorizado" });

    const includeTeam = String(req.query?.scope || "").toLowerCase() === "team" && canApproveRegularization(req.user);
    const rows = await listRegularizations({ requesterUserId, includeTeam });
    return res.status(200).json({ ok: true, data: rows });
  } catch (err) {
    return res.status(500).json({ ok: false, message: "Error listando regularizaciones" });
  }
};

const transition = async (req, res) => {
  try {
    const actorUserId = Number(req.user?.id || 0);
    if (!actorUserId) return res.status(401).json({ ok: false, message: "No autorizado" });
    if (!canApproveRegularization(req.user)) {
      return res.status(403).json({ ok: false, message: "Sin permisos para aprobar regularizaciones" });
    }

    const regularizationId = Number(req.params?.id);
    const nextStatus = String(req.body?.status || "").trim().toLowerCase();
    const comment = String(req.body?.comment || "").trim() || null;
    const requestContext = getRequestContext(req, "regularization-transition");

    const updated = await transitionRegularization({
      regularizationId,
      actorUserId,
      actorRole: req.user?.role || null,
      nextStatus,
      comment,
      requestContext,
    });

    if (!updated) return res.status(404).json({ ok: false, message: "Regularizacion no encontrada" });

    await logAttendanceAuditEvent({
      actorUserId,
      affectedUserId: updated.affected_user_id,
      action: `attendance.regularization.${nextStatus}`,
      endpoint: req.originalUrl,
      method: req.method,
      newValue: updated,
      result: "ok",
      requestContext,
    });

    return res.status(200).json({ ok: true, data: updated });
  } catch (err) {
    return res.status(500).json({ ok: false, message: "Error actualizando regularizacion" });
  }
};

module.exports = {
  create,
  list,
  transition,
};
