const service = require("./teleworkRequests.service");

const create = async (req, res) => {
  try {
    const result = await service.createRequest({
      userId: req.user?.id,
      city: req.body?.city || req.body?.operational_destination_city,
      location: req.body?.location,
      locationAccuracy: req.body?.location_accuracy,
      reason: req.body?.reason,
      requestDate: req.body?.request_date || req.body?.requestDate,
    });
    return res.status(result.reused ? 200 : 201).json({
      ok: true,
      code: result.reused ? "TELEWORK_REQUEST_ALREADY_EXISTS" : "TELEWORK_REQUEST_CREATED",
      message: result.reused
        ? `Ya existe una solicitud de teletrabajo para el ${result.request.request_date}.`
        : `Solicitud de teletrabajo enviada para el ${result.request.request_date}.`,
      data: result.request,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      code: error.code || "TELEWORK_REQUEST_CREATE_FAILED",
      message: error.message || "No se pudo crear la solicitud de teletrabajo",
    });
  }
};

const list = async (req, res) => {
  try {
    const ownScope = String(req.query?.scope || req.query?.mode || "").trim().toLowerCase() === "mine";
    const canReview = !ownScope && service.hasExactTalentHumanRole(req.user);
    const requests = await service.listRequests({
      userId: req.user?.id,
      canReview,
      requestDate: null,
    });
    return res.json({ ok: true, data: { requests, can_review: canReview } });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      code: "TELEWORK_REQUESTS_LIST_FAILED",
      message: "No se pudieron consultar las solicitudes de teletrabajo",
    });
  }
};

const decide = async (req, res) => {
  try {
    const request = await service.decideRequest({
      requestId: req.params.id,
      reviewer: req.user,
      decision: req.body?.decision,
      reviewReason: req.body?.reason,
    });
    return res.json({
      ok: true,
      code: `TELEWORK_REQUEST_${request.status}`,
      message: request.status === "APPROVED" ? "Solicitud de teletrabajo aprobada." : "Solicitud de teletrabajo rechazada.",
      data: request,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      code: error.code || "TELEWORK_REQUEST_DECISION_FAILED",
      message: error.message || "No se pudo actualizar la solicitud de teletrabajo",
    });
  }
};

module.exports = { create, list, decide };
