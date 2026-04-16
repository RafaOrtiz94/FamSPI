const Joi = require("joi");
const svc = require("./ca0114.service");
const repo = require("./ca0114.repository");
const logger = require("../../config/logger");

const createArea = async (req, res, next) => {
  try {
    const schema = Joi.object({
      areaName: Joi.string().required(),
      areaCode: Joi.string().required(),
      areaType: Joi.string().valid("clean_room", "warehouse", "laboratory", "production", "storage", "quarantine", "other").required(),
      classificationLevel: Joi.string().valid("a", "b", "c", "d", "undefined").required(),
      qualificationType: Joi.string().valid("iq", "oq", "pq", "initial", "periodic", "requalification").required(),
      nextQualificationDate: Joi.date().iso(),
      validatedBy: Joi.string().uuid()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createArea(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listAreas = async (req, res, next) => {
  try {
    const { areaType, status, classificationLevel } = req.query;
    const results = await repo.listAreas({ areaType, status, classificationLevel });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createQualificationParam = async (req, res, next) => {
  try {
    const schema = Joi.object({
      areaId: Joi.string().uuid().required(),
      paramName: Joi.string().required(),
      paramCode: Joi.string().required(),
      paramType: Joi.string().valid("temperature", "humidity", "pressure", "particulate", "viable", "nonviable", "other").required(),
      minValue: Joi.number(),
      maxValue: Joi.number(),
      targetValue: Joi.number(),
      unit: Joi.string(),
      methodUsed: Joi.string()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createQualificationParam(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listQualificationParams = async (req, res, next) => {
  try {
    const { areaId } = req.query;
    const results = await repo.listQualificationParams({ areaId });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createMonitoringResult = async (req, res, next) => {
  try {
    const schema = Joi.object({
      areaId: Joi.string().uuid().required(),
      paramId: Joi.string().uuid(),
      readingValue: Joi.number().required(),
      isWithinSpec: Joi.boolean(),
      notes: Joi.string(),
      recordedBy: Joi.string().uuid()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createMonitoringResult(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listMonitoringResults = async (req, res, next) => {
  try {
    const { areaId } = req.query;
    const results = await repo.listMonitoringResults({ areaId });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createDeviation = async (req, res, next) => {
  try {
    const schema = Joi.object({
      areaId: Joi.string().uuid().required(),
      description: Joi.string().required(),
      severity: Joi.string().valid("minor", "major", "critical").required(),
      correctiveAction: Joi.string()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createDeviation(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listDeviations = async (req, res, next) => {
  try {
    const { areaId, status } = req.query;
    const results = await repo.listDeviations({ areaId, status });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const createQualificationDoc = async (req, res, next) => {
  try {
    const schema = Joi.object({
      areaId: Joi.string().uuid().required(),
      docType: Joi.string().valid("protocol", "report", "certificate", "sop", "other").required(),
      docName: Joi.string().required(),
      docUrl: Joi.string().uri(),
      version: Joi.string()
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createQualificationDoc(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const listQualificationDocs = async (req, res, next) => {
  try {
    const { areaId } = req.query;
    const results = await repo.listQualificationDocs({ areaId });
    return res.status(200).json({ ok: true, data: results });
  } catch (err) {
    logger.error({ err }, "Error");
    next(err);
  }
};

const transitionRecord = async (req, res, next) => {
  try {
    const schema = Joi.object({
      flowName: Joi.string().valid("area", "deviation").required(),
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
  createArea, listAreas,
  createQualificationParam, listQualificationParams,
  createMonitoringResult, listMonitoringResults,
  createDeviation, listDeviations,
  createQualificationDoc, listQualificationDocs,
  transitionRecord, getMetrics
};