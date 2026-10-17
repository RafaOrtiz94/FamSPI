const Joi = require("joi");
const svc = require("./ca0112.service");
const repo = require("./ca0112.repository");
const logger = require("../../config/logger");

const createEvaluation = async (req, res, next) => {
  try {
    const schema = Joi.object({
      employeeId: Joi.string().uuid().required(),
      evaluationDate: Joi.date().iso().required(),
      hygieneArea: Joi.string().required(),
      evaluationType: Joi.string().valid("daily", "weekly", "monthly", "procedural").required(),
      result: Joi.string().valid("approved", "conditionally_approved", "failed"),
      observations: Joi.string(),
      evaluatedBy: Joi.string().uuid()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createEvaluation(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listEvaluations = async (req, res, next) => {
  try {
    const { employeeId, result, evaluationType } = req.query;
    const results = await repo.listEvaluations({ employeeId, result, evaluationType });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createPracticeVerification = async (req, res, next) => {
  try {
    const schema = Joi.object({
      evaluationId: Joi.string().uuid().required(),
      practiceName: Joi.string().required(),
      practiceCode: Joi.string().required(),
      isComplied: Joi.boolean(),
      severity: Joi.string().valid("critical", "major", "minor"),
      notes: Joi.string()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createPracticeVerification(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listPracticeVerifications = async (req, res, next) => {
  try {
    const { evaluationId } = req.query;
    const results = await repo.listPracticeVerifications({ evaluationId });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createNonCompliance = async (req, res, next) => {
  try {
    const schema = Joi.object({
      evaluationId: Joi.string().uuid().required(),
      practiceId: Joi.string().uuid(),
      description: Joi.string().required(),
      nonComplianceType: Joi.string().valid("hygiene", "ppe", "behavior", "contamination").required(),
      correctiveAction: Joi.string()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createNonCompliance(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listNonCompliances = async (req, res, next) => {
  try {
    const { evaluationId, status } = req.query;
    const results = await repo.listNonCompliances({ evaluationId, status });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createPpeCheck = async (req, res, next) => {
  try {
    const schema = Joi.object({
      evaluationId: Joi.string().uuid().required(),
      ppeType: Joi.string().valid("gloves", "mask", "gown", "cap", "goggles", "boots", "other").required(),
      isUsed: Joi.boolean(),
      condition: Joi.string().valid("good", "fair", "poor"),
      notes: Joi.string()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createPpeCheck(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listPpeChecks = async (req, res, next) => {
  try {
    const { evaluationId } = req.query;
    const results = await repo.listPpeChecks({ evaluationId });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createTraining = async (req, res, next) => {
  try {
    const schema = Joi.object({
      employeeId: Joi.string().uuid().required(),
      trainingType: Joi.string().valid("initial", "refresher", "specialized").required(),
      trainingDate: Joi.date().iso().required(),
      trainerId: Joi.string().uuid(),
      durationHours: Joi.number().integer().min(0),
      result: Joi.string().valid("passed", "failed", "pending"),
      certificateUrl: Joi.string().uri(),
      validityDate: Joi.date().iso()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createTraining(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listTrainings = async (req, res, next) => {
  try {
    const { employeeId, result } = req.query;
    const results = await repo.listTrainings({ employeeId, result });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const transitionRecord = async (req, res, next) => {
  try {
    const schema = Joi.object({
      flowName: Joi.string().valid("evaluation", "non_compliance", "training").required(),
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
  createEvaluation, listEvaluations,
  createPracticeVerification, listPracticeVerifications,
  createNonCompliance, listNonCompliances,
  createPpeCheck, listPpeChecks,
  createTraining, listTrainings,
  transitionRecord, getMetrics
};