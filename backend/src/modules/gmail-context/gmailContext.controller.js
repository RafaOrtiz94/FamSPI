const Joi = require("joi");
const { logAction } = require("../../utils/audit");
const service = require("./gmailContext.service");

const recipientSchema = Joi.array().items(Joi.string().trim().email().max(320)).max(100).default([]);
const registerSchema = Joi.object({
  gmail_message_id: Joi.string().trim().max(500).required(),
  gmail_thread_id: Joi.string().trim().max(500).allow(null, "").default(null),
  sender_email: Joi.string().trim().email().max(320).allow(null, "").default(null),
  recipient_emails: recipientSchema,
  subject: Joi.string().trim().max(998).allow(null, "").default(null),
  received_at: Joi.date().iso().allow(null).default(null),
  body_preview: Joi.string().trim().max(4000).allow(null, "").default(null),
  attachments: Joi.forbidden(),
}).required();

const linkSchema = Joi.object({
  entity_type: Joi.string().valid("business_case", "public_purchase", "private_purchase").required(),
  entity_id: Joi.string().trim().max(100).required(),
  client_request_id: Joi.number().integer().positive().allow(null).default(null),
}).required();

function validationError(res, error) {
  return res.status(400).json({
    ok: false,
    code: "GMAIL_CONTEXT_PAYLOAD_INVALID",
    message: error.details.map((detail) => detail.message).join(", "),
  });
}

function serviceError(res, error) {
  const status = error?.status || 500;
  return res.status(status).json({
    ok: false,
    code: error?.code || (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
    message: error?.message || "No se pudo procesar la comunicacion Gmail.",
  });
}

function workspaceUrl(communicationId) {
  const origin = String(process.env.APP_FRONTEND_URL || process.env.FRONTEND_URL || "").replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(origin) || !communicationId) return null;
  return `${origin}/gmail-context?communication_id=${encodeURIComponent(communicationId)}`;
}

async function register(req, res) {
  const { error, value } = registerSchema.validate(req.body, { abortEarly: false, convert: true });
  if (error) return validationError(res, error);
  try {
    const result = await service.registerCommunication({ user: req.user, payload: value });
    await logAction({
      user_id: req.user.id,
      module: "gmail_context",
      action: result.created ? "register" : "idempotent_replay",
      entity: "gmail_context_communications",
      entity_id: result.communication.id,
      details: { gmail_message_id: value.gmail_message_id, gmail_thread_id: value.gmail_thread_id || null },
    });
    return res.status(result.created ? 201 : 200).json({
      ok: true,
      data: { ...result, workspace_url: workspaceUrl(result.communication.id) },
    });
  } catch (serviceErr) {
    return serviceError(res, serviceErr);
  }
}

async function list(req, res) {
  try {
    const data = await service.listCommunications({
      user: req.user,
      status: req.query?.status || null,
      page: req.query?.page,
      pageSize: req.query?.page_size,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return serviceError(res, error);
  }
}

async function searchClients(req, res) {
  try {
    const data = await service.searchClients({ user: req.user, q: req.query?.q || "" });
    return res.json({ ok: true, data });
  } catch (error) {
    return serviceError(res, error);
  }
}

async function clientSuggestions(req, res) {
  try {
    const data = await service.getClientSuggestions({ id: req.params.id, user: req.user });
    return res.json({ ok: true, data });
  } catch (error) {
    return serviceError(res, error);
  }
}

async function processCandidates(req, res) {
  try {
    const data = await service.getProcessCandidates({
      id: req.params.id,
      user: req.user,
      clientRequestId: req.query?.client_request_id,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return serviceError(res, error);
  }
}

async function autoLink(req, res) {
  try {
    const data = await service.autoLinkCommunication({ id: req.params.id, user: req.user });
    await logAction({
      user_id: req.user.id,
      module: "gmail_context",
      action: "auto_link",
      entity: "gmail_context_communications",
      entity_id: data.id,
      details: { entity_type: data.linked_entity_type, entity_id: data.linked_entity_id, process_note_id: data.process_note_id },
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return serviceError(res, error);
  }
}

async function searchProcesses(req, res) {
  try {
    const data = await service.searchProcesses({
      user: req.user,
      entityType: req.query?.entity_type,
      q: req.query?.q || "",
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return serviceError(res, error);
  }
}

async function link(req, res) {
  const { error, value } = linkSchema.validate(req.body, { abortEarly: false, convert: true });
  if (error) return validationError(res, error);
  try {
    const data = await service.linkCommunication({
      id: req.params.id,
      user: req.user,
      entityType: value.entity_type,
      entityId: value.entity_id,
      clientRequestId: value.client_request_id,
    });
    await logAction({
      user_id: req.user.id,
      module: "gmail_context",
      action: "link",
      entity: "gmail_context_communications",
      entity_id: data.id,
      details: { entity_type: value.entity_type, entity_id: value.entity_id, process_note_id: data.process_note_id },
    });
    return res.json({ ok: true, data });
  } catch (serviceErr) {
    return serviceError(res, serviceErr);
  }
}

module.exports = { register, list, searchClients, clientSuggestions, processCandidates, autoLink, searchProcesses, link };
