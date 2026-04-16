const Joi = require("joi");
const service = require("./ca0106.service");
const repository = require("./ca0106.repository");
const logger = require("../../config/logger");

/**
 * Controller - CA-01-06 (Retiro del Mercado/Recall)
 */

const RECALL_LEVELS = ["wholesale", "retail", "consumer", "defect"];
const TRACEABILITY_STATUS = ["active", "quarantine", "recalled", "closed"];
const COMM_STATUS = ["draft", "sent", "cancelled"];
const QUARANTINE_STATUS = ["pending", "approved", "released", "destroyed"];
const LOGISTICS_STATUS = ["pending", "in_transit", "completed", "cancelled"];

const traceabilitySchema = Joi.object({
  productId: Joi.string().uuid().required(),
  productName: Joi.string().max(255).required(),
  lotNumber: Joi.string().max(100).required(),
  manufacturingDate: Joi.date().iso(),
  expiryDate: Joi.date().iso(),
  quantityTotal: Joi.number().integer().min(0),
  distributionChannels: Joi.string().allow("", null),
  affectedCountries: Joi.string().allow("", null),
  recallLevel: Joi.string().valid(...RECALL_LEVELS),
});

const createTraceability = async (req, res, next) => {
  try {
    const { error, value } = traceabilitySchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repository.createTraceability(value);
    logger.info({ id: result.id }, "CA-01-06: Traceability created");
    return res.status(201).json({ ok: true, data: result });
  } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const listTraceability = async (req, res, next) => {
  try {
    const { productId, lotNumber, status } = req.query;
    const results = await repository.listTraceability({ productId, lotNumber, status });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const communicationSchema = Joi.object({
  recallId: Joi.string().uuid().required(),
  communicationType: Joi.string().valid("press", "direct", "regulatory", "internal").required(),
  subject: Joi.string().max(255).required(),
  body: Joi.string().required(),
  targetAudience: Joi.string().required(),
  channels: Joi.string().allow("", null),
});

const createCommunication = async (req, res, next) => {
  try {
    const { error, value } = communicationSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repository.createCommunication(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const listCommunications = async (req, res, next) => {
  try {
    const { recallId, status } = req.query;
    const results = await repository.listCommunications({ recallId, status });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const quarantineSchema = Joi.object({
  recallId: Joi.string().uuid().required(),
  locationId: Joi.string().uuid().required(),
  locationName: Joi.string().max(255).required(),
  quantityQuarantined: Joi.number().integer().min(0).required(),
  quarantineReason: Joi.string().required(),
});

const createQuarantine = async (req, res, next) => {
  try {
    const { error, value } = quarantineSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repository.createQuarantine(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const listQuarantine = async (req, res, next) => {
  try {
    const { recallId, status } = req.query;
    const results = await repository.listQuarantine({ recallId, status });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const logisticsSchema = Joi.object({
  recallId: Joi.string().uuid().required(),
  actionType: Joi.string().valid("pickup", "return", "destroy", "replace", "refund").required(),
  quantity: Joi.number().integer().min(0).required(),
  destination: Joi.string().allow("", null),
  carrier: Joi.string().allow("", null),
});

const createLogistics = async (req, res, next) => {
  try {
    const { error, value } = logisticsSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repository.createLogistics(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const listLogistics = async (req, res, next) => {
  try {
    const { recallId, status } = req.query;
    const results = await repository.listLogistics({ recallId, status });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const FLOW_NAMES = ["traceability", "communication", "quarantine", "logistics"];
const FLOW_STATES = ["draft", "pending", "in_progress", "completed", "closed", "cancelled"];

const transitionRecord = async (req, res, next) => {
  try {
    const schema = Joi.object({
      flowName: Joi.string().valid(...FLOW_NAMES).required(),
      record: Joi.object({ id: Joi.string().uuid().optional(), status: Joi.string().optional() }).required(),
      toStatus: Joi.string().valid(...FLOW_STATES).required(),
      notes: Joi.string().allow("", null),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const userId = req.user?.id || req.user?.uid || null;
    const result = await service.transitionWorkflowRecord(value.record, { flowName: value.flowName, toStatus: value.toStatus, notes: value.notes, userId });
    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ ok: false, message: err.message, code: err.code });
    logger.error({ err }, "Error"); next(err);
  }
};

module.exports = { createTraceability, listTraceability, createCommunication, listCommunications, createQuarantine, listQuarantine, createLogistics, listLogistics, transitionRecord };