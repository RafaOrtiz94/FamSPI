const Joi = require("joi");
const svc = require("./ca0113.service");
const repo = require("./ca0113.repository");
const logger = require("../../config/logger");

const createCommunication = async (req, res, next) => {
  try {
    const schema = Joi.object({
      communicationType: Joi.string().valid("internal", "external", "emergency", "regulatory", "general").required(),
      title: Joi.string().required(),
      content: Joi.string(),
      priority: Joi.string().valid("low", "normal", "high", "urgent").required(),
      channel: Joi.string().valid("email", "portal", "sms", "whatsapp", "physical", "all").required(),
      targetAudience: Joi.string(),
      createdBy: Joi.string().uuid(),
      expirationDate: Joi.date().iso()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createCommunication(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listCommunications = async (req, res, next) => {
  try {
    const { status, communicationType, priority } = req.query;
    const results = await repo.listCommunications({ status, communicationType, priority });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createRecipient = async (req, res, next) => {
  try {
    const schema = Joi.object({
      communicationId: Joi.string().uuid().required(),
      recipientType: Joi.string().valid("user", "role", "department", "all").required(),
      recipientId: Joi.string()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createRecipient(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listRecipients = async (req, res, next) => {
  try {
    const { communicationId } = req.query;
    const results = await repo.listRecipients({ communicationId });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createAttachment = async (req, res, next) => {
  try {
    const schema = Joi.object({
      communicationId: Joi.string().uuid().required(),
      fileName: Joi.string().required(),
      fileUrl: Joi.string().uri().required(),
      fileType: Joi.string(),
      fileSize: Joi.number().integer(),
      uploadedBy: Joi.string().uuid()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createAttachment(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listAttachments = async (req, res, next) => {
  try {
    const { communicationId } = req.query;
    const results = await repo.listAttachments({ communicationId });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const schema = Joi.object({
      communicationId: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createReadLog(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listReadLogs = async (req, res, next) => {
  try {
    const { communicationId, userId } = req.query;
    const results = await repo.listReadLogs({ communicationId, userId });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createTemplate = async (req, res, next) => {
  try {
    const schema = Joi.object({
      templateName: Joi.string().required(),
      templateType: Joi.string().valid("internal", "external", "emergency", "regulatory").required(),
      subjectTemplate: Joi.string(),
      bodyTemplate: Joi.string(),
      createdBy: Joi.string().uuid()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createTemplate(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listTemplates = async (req, res, next) => {
  try {
    const { templateType, isActive } = req.query;
    const results = await repo.listTemplates({ templateType, isActive });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const transitionRecord = async (req, res, next) => {
  try {
    const schema = Joi.object({
      flowName: Joi.string().valid("communication", "template").required(),
      record: Joi.object({ id: Joi.string().uuid().optional(), status: Joi.string().optional() }).required(),
      toStatus: Joi.string().required(),
      notes: Joi.string().allow("")
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const userId = req.user?.id || req.user?.uid;
    const result = await svc.transitionWorkflowRecord(value.record, { flowName: value.flowName, toStatus: value.toStatus, notes: value.notes, userId });
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message, code: err.code });
    logger.error({ err }, "Error");
    next(err);
  }
};

const getMetrics = async (req, res, next) => {
  try {
    const metrics = await svc.getDashboardMetrics();
    return res.status(200).json({ ok: true, data: metrics });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

module.exports = {
  createCommunication, listCommunications,
  createRecipient, listRecipients,
  createAttachment, listAttachments,
  markAsRead, listReadLogs,
  createTemplate, listTemplates,
  transitionRecord, getMetrics
};