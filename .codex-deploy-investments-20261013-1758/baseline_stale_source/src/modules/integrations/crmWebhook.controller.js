const logger = require("../../config/logger");
const webhookService = require("./crmWebhook.service");

// Valida el secret enviado por EspoCRM en la cabecera X-Hook-Secret.
// Si CRM_WEBHOOK_SECRET no está configurado, se permite todo (solo para dev).
function _validateSecret(req) {
  const expected = process.env.CRM_WEBHOOK_SECRET;
  if (!expected) {
    logger.warn("[CRM_WEBHOOK] CRM_WEBHOOK_SECRET no configurado — aceptando sin validar (solo dev)");
    return true;
  }
  const received =
    req.headers["x-hook-secret"] ||
    req.headers["x-espocrm-hook-secret"] ||
    req.headers["espo-webhook-secret-key"];
  return received === expected;
}

// EspoCRM puede enviar el payload en dos formatos:
//   Formato A (directo): { id, name, stage, accountName, ... }
//   Formato B (envuelto): { entityType, event, data: { id, name, stage, ... } }
function _parseOpportunity(body) {
  if (body?.data?.id) return { opp: body.data, entityType: body.entityType, event: body.event };
  if (body?.id) return { opp: body, entityType: "Opportunity", event: null };
  return { opp: null };
}

const receiveWebhook = async (req, res) => {
  if (!_validateSecret(req)) {
    logger.warn({ ip: req.ip, path: req.path }, "[CRM_WEBHOOK] Secret invalido — rechazado 401");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body;

  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const { opp, entityType } = _parseOpportunity(body);

  if (!opp || !opp.id) {
    logger.debug(
      { body_preview: JSON.stringify(body).slice(0, 300) },
      "[CRM_WEBHOOK] Payload sin entity id — ignorado"
    );
    return res.status(200).json({ ok: true, action: "ignored", reason: "no_entity_id" });
  }

  // Solo procesamos Opportunity
  if (entityType && entityType !== "Opportunity") {
    return res.status(200).json({ ok: true, action: "ignored", reason: "not_opportunity" });
  }

  const stage = opp.stage;
  if (!stage) {
    return res.status(200).json({ ok: true, action: "ignored", reason: "no_stage" });
  }

  logger.info(
    { opp_id: opp.id, opp_name: opp.name, stage, entity: entityType || "Opportunity" },
    "[CRM_WEBHOOK] Webhook recibido de EspoCRM"
  );

  const result = await webhookService.handleWebhookStageChange(opp, stage);

  return res.status(200).json(result);
};

module.exports = { receiveWebhook };
