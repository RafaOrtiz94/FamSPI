const service = require("./vacaciones.service");
const logger = require("../../config/logger");
const { shouldRespondJson, renderVerificationHtml } = require("../../utils/legalVerificationView");

const getErrorStatus = (err, fallback = 400) => {
  const status = Number(err?.status || err?.statusCode);
  if (Number.isInteger(status) && status >= 400 && status < 600) {
    return status;
  }
  return fallback;
};

const getRequestMeta = (req) => ({
  ipAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || null,
  userAgent: req.headers["user-agent"] || null,
  sessionId: req.headers["x-session-id"] || req.body?.session_id || null,
});

async function create(req, res) {
  try {
    const request = await service.createVacationRequest(req.body, req.user.id, getRequestMeta(req));
    res.status(201).json({ ok: true, data: request });
  } catch (err) {
    logger.error(err, "Error creando solicitud de vacaciones");
    res.status(getErrorStatus(err, 400)).json({ ok: false, message: err.message || "No se pudo crear la solicitud" });
  }
}

async function list(req, res) {
  try {
    const rows = await service.listVacationRequests(req.query, req.user);
    res.json({ ok: true, data: rows });
  } catch (err) {
    logger.error(err, "Error listando vacaciones");
    res.status(500).json({ ok: false, message: "No se pudieron cargar las solicitudes" });
  }
}

async function updateStatus(req, res) {
  try {
    const updated = await service.updateVacationStatus(req.params.id, req.body.status, req.user, getRequestMeta(req));
    res.json({ ok: true, data: updated });
  } catch (err) {
    logger.error(err, "Error actualizando vacaciones");
    res.status(getErrorStatus(err, 400)).json({ ok: false, message: err.message || "No se pudo actualizar" });
  }
}

async function cancel(req, res) {
  try {
    const updated = await service.cancelVacationRequest(
      req.params.id,
      req.user.id,
      {
        actor: req.user,
        reason: req.body?.reason || null,
      }
    );
    res.json({ ok: true, data: updated });
  } catch (err) {
    logger.error(err, "Error cancelando vacaciones");
    res.status(getErrorStatus(err, 400)).json({ ok: false, message: err.message || "No se pudo cancelar" });
  }
}

async function updateDates(req, res) {
  try {
    const updated = await service.updateVacationDates(
      req.params.id,
      req.user.id,
      req.body || {},
      { actor: req.user }
    );
    res.json({ ok: true, data: updated });
  } catch (err) {
    logger.error(err, "Error reprogramando vacaciones");
    res.status(getErrorStatus(err, 400)).json({ ok: false, message: err.message || "No se pudo reprogramar" });
  }
}

async function reviewCancel(req, res) {
  try {
    const updated = await service.reviewVacationCancellation(
      req.params.id,
      req.body?.decision,
      req.body?.reason,
      req.user
    );
    res.json({ ok: true, data: updated });
  } catch (err) {
    logger.error(err, "Error revisando cancelación de vacaciones");
    res.status(getErrorStatus(err, 400)).json({ ok: false, message: err.message || "No se pudo revisar cancelación" });
  }
}

async function verifyLegalToken(req, res) {
  try {
    const responseAsJson = shouldRespondJson(req);
    const token = String(req.params?.token || "").trim();
    if (!token) {
      if (responseAsJson) return res.status(400).json({ ok: false, message: "Token requerido" });
      return res.status(400).type("html").send(
        renderVerificationHtml({
          title: "Verificación legal inválida",
          subtitle: "FamSign",
          status: "pending",
          sourceType: "Vacaciones",
        })
      );
    }
    const data = await service.getLegalVerificationByToken(token);
    if (!data) {
      if (responseAsJson) return res.status(404).json({ ok: false, message: "Token de verificación no encontrado" });
      return res.status(404).type("html").send(
        renderVerificationHtml({
          title: "Token no encontrado",
          subtitle: "FamSign",
          status: "pending",
          token,
          sourceType: "Vacaciones",
        })
      );
    }
    if (responseAsJson) return res.json({ ok: true, data });
    return res.type("html").send(
      renderVerificationHtml({
        title: "Verificación legal completada",
        subtitle: "FamSign",
        status: data?.status,
        id: data?.id,
        solicitante: data?.requester_name || data?.solicitante || "No disponible",
        aprobador: data?.approver_name || data?.aprobador || "No disponible",
        aprobacionFinalAt: data?.approved_at || data?.aprobacion_final_at || null,
        token: data?.legal_verification_token || token,
        workflow: data?.firma_avanzada_resumen || null,
        cancellation: data?.cancellation || null,
        sourceType: "Vacaciones",
      })
    );
  } catch (err) {
    logger.error(err, "Error verificando token legal de vacaciones");
    if (shouldRespondJson(req)) {
      return res.status(500).json({ ok: false, message: err.message || "No se pudo verificar el token legal" });
    }
    return res.status(500).type("html").send(
      renderVerificationHtml({
        title: "Error de verificación",
        subtitle: "FamSign",
        status: "pending",
        sourceType: "Vacaciones",
      })
    );
  }
}

async function getSummary(req, res) {
  try {
    const data = await service.summary(req.user, req.query.all === "true");
    res.json({ ok: true, data });
  } catch (err) {
    logger.error(err, "Error obteniendo resumen de vacaciones");
    res.status(500).json({ ok: false, message: "No se pudo obtener el resumen" });
  }
}

module.exports = { create, list, updateStatus, cancel, updateDates, reviewCancel, getSummary, verifyLegalToken };
