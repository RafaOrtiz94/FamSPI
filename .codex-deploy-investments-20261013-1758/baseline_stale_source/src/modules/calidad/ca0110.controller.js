const Joi = require("joi");
const svc = require("./ca0110.service");
const repo = require("./ca0110.repository");
const logger = require("../../config/logger");

const createFmea = async (req, res, next) => {
  try {
    const schema = Joi.object({
      processName: Joi.string().required(),
      failureMode: Joi.string().required(),
      severityScore: Joi.number().integer().min(1).max(10).required(),
      occurrenceScore: Joi.number().integer().min(1).max(10).required(),
      detectionScore: Joi.number().integer().min(1).max(10).required(),
      createdBy: Joi.string().uuid()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await svc.createFmeaWithRPN(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listFmea = async (req, res, next) => {
  try {
    const { status, riskLevel } = req.query;
    const results = await repo.listFmea({ status, riskLevel });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createMitigation = async (req, res, next) => {
  try {
    const schema = Joi.object({
      fmeaId: Joi.string().uuid().required(),
      mitigationAction: Joi.string().required(),
      responsibleId: Joi.string().uuid().required(),
      targetDate: Joi.date().iso().required()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createMitigation(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listMitigation = async (req, res, next) => {
  try {
    const { fmeaId, status } = req.query;
    const results = await repo.listMitigation({ fmeaId, status });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createReview = async (req, res, next) => {
  try {
    const schema = Joi.object({
      reviewType: Joi.string().valid("annual","quarterly","ad_hoc").required(),
      reviewDate: Joi.date().iso().required(),
      participants: Joi.array().items(Joi.string()).required(),
      conclusions: Joi.string(),
      actionItems: Joi.array().items(Joi.string()),
      createdBy: Joi.string().uuid()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createReview(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listReviews = async (req, res, next) => {
  try {
    const { reviewType, status } = req.query;
    const results = await repo.listReviews({ reviewType, status });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createImpactAssessment = async (req, res, next) => {
  try {
    const schema = Joi.object({
      riskId: Joi.string().uuid().required(),
      impactType: Joi.string().valid("financial","operational","regulatory","reputational").required(),
      description: Joi.string().required(),
      probability: Joi.number().min(0).max(1).required(),
      impactScore: Joi.number().integer().min(1).max(10).required(),
      mitigationPlan: Joi.string(),
      assessedBy: Joi.string().uuid()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createImpactAssessment(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listImpactAssessment = async (req, res, next) => {
  try {
    const { riskId, status } = req.query;
    const results = await repo.listImpactAssessment({ riskId, status });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const transitionRecord = async (req, res, next) => {
  try {
    const schema = Joi.object({
      flowName: Joi.string().valid("fmea", "mitigation", "reviews", "impact").required(),
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

module.exports = { createFmea, listFmea, createMitigation, listMitigation, createReview, listReviews, createImpactAssessment, listImpactAssessment, transitionRecord, getMetrics };