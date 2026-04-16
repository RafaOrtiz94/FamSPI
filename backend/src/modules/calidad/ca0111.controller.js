const Joi = require("joi");
const svc = require("./ca0111.service");
const repo = require("./ca0111.repository");
const logger = require("../../config/logger");

const createIncident = async (req, res, next) => {
  try {
    const schema = Joi.object({
      incidentType: Joi.string().valid("spill", "fire", "security", "equipment_failure", "environmental", "other").required(),
      severity: Joi.string().valid("low", "medium", "high", "critical").required(),
      title: Joi.string().required(),
      description: Joi.string(),
      location: Joi.string(),
      reportedBy: Joi.string().uuid()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createIncident(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listIncidents = async (req, res, next) => {
  try {
    const { status, severity, incidentType } = req.query;
    const results = await repo.listIncidents({ status, severity, incidentType });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createContainmentAction = async (req, res, next) => {
  try {
    const schema = Joi.object({
      incidentId: Joi.string().uuid().required(),
      actionDescription: Joi.string().required(),
      responsibleId: Joi.string().uuid()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createContainmentAction(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listContainmentActions = async (req, res, next) => {
  try {
    const { incidentId, actionStatus } = req.query;
    const results = await repo.listContainmentActions({ incidentId, actionStatus });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createHazardousMaterial = async (req, res, next) => {
  try {
    const schema = Joi.object({
      incidentId: Joi.string().uuid().required(),
      materialName: Joi.string().required(),
      quantity: Joi.string(),
      unit: Joi.string(),
      casNumber: Joi.string(),
      hazardClass: Joi.string()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createHazardousMaterial(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listHazardousMaterials = async (req, res, next) => {
  try {
    const { incidentId } = req.query;
    const results = await repo.listHazardousMaterials({ incidentId });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createAffected = async (req, res, next) => {
  try {
    const schema = Joi.object({
      incidentId: Joi.string().uuid().required(),
      affectedType: Joi.string().valid("person", "area", "equipment", "environment").required(),
      entityName: Joi.string(),
      description: Joi.string(),
      quantity: Joi.number().integer().min(1)
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createAffected(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listAffected = async (req, res, next) => {
  try {
    const { incidentId } = req.query;
    const results = await repo.listAffected({ incidentId });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createCleanupAction = async (req, res, next) => {
  try {
    const schema = Joi.object({
      incidentId: Joi.string().uuid().required(),
      cleanupDescription: Joi.string().required(),
      methodUsed: Joi.string(),
      responsibleId: Joi.string().uuid()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createCleanupAction(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listCleanupActions = async (req, res, next) => {
  try {
    const { incidentId, cleanupStatus } = req.query;
    const results = await repo.listCleanupActions({ incidentId, cleanupStatus });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const transitionRecord = async (req, res, next) => {
  try {
    const schema = Joi.object({
      flowName: Joi.string().valid("incident", "containment", "cleanup").required(),
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
  createIncident, listIncidents,
  createContainmentAction, listContainmentActions,
  createHazardousMaterial, listHazardousMaterials,
  createAffected, listAffected,
  createCleanupAction, listCleanupActions,
  transitionRecord, getMetrics
};