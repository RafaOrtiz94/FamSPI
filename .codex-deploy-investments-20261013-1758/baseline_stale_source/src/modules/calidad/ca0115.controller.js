const Joi = require("joi");
const svc = require("./ca0115.service");
const repo = require("./ca0115.repository");
const logger = require("../../config/logger");

const createAudit = async (req, res, next) => {
  try {
    const schema = Joi.object({ auditNumber: Joi.string().required(), auditType: Joi.string().valid("internal", "external", "regulatory", "supplier").required(), scope: Joi.string().required(), standard: Joi.string().valid("iso_9001", "iso_14001", "gmp", "gdp", "gqp", "other").required(), plannedStartDate: Joi.date().iso(), plannedEndDate: Joi.date().iso(), leadAuditorId: Joi.string().uuid(), teamMembers: Joi.array() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createAudit(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const listAudits = async (req, res, next) => {
  try { const results = await repo.listAudits(req.query); return res.status(200).json({ ok: true, data: results }); }
  catch (err) { logger.error({ err }, "Error"); next(err); }
};

const createFinding = async (req, res, next) => {
  try {
    const schema = Joi.object({ auditId: Joi.string().uuid().required(), findingNumber: Joi.string().required(), findingType: Joi.string().valid("critical", "major", "minor", "observation", "opportunity").required(), description: Joi.string().required(), areaAffected: Joi.string(), clauseReference: Joi.string() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createFinding(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const listFindings = async (req, res, next) => {
  try { const results = await repo.listFindings(req.query); return res.status(200).json({ ok: true, data: results }); }
  catch (err) { logger.error({ err }, "Error"); next(err); }
};

const createEvidence = async (req, res, next) => {
  try {
    const schema = Joi.object({ auditId: Joi.string().uuid().required(), findingId: Joi.string().uuid(), evidenceType: Joi.string().valid("document", "photo", "record", "interview", "observation").required(), description: Joi.string(), fileUrl: Joi.string().uri(), uploadedBy: Joi.string().uuid() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createEvidence(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const createChecklist = async (req, res, next) => {
  try {
    const schema = Joi.object({ auditId: Joi.string().uuid().required(), clauseCode: Joi.string().required(), questionText: Joi.string().required(), response: Joi.string().valid("compliant", "non_compliant", "na", "pending"), evidenceRef: Joi.string() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await repo.createChecklist(value);
    return res.status(201).json({ ok: true, data: result });
  } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const listChecklists = async (req, res, next) => {
  try { const results = await repo.listChecklists(req.query); return res.status(200).json({ ok: true, data: results }); }
  catch (err) { logger.error({ err }, "Error"); next(err); }
};

const transitionRecord = async (req, res, next) => {
  try {
    const schema = Joi.object({ flowName: Joi.string().valid("audit", "finding").required(), record: Joi.object({ id: Joi.string().uuid().optional(), status: Joi.string().optional() }).required(), toStatus: Joi.string().required() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.details[0].message });
    const result = await svc.transitionWorkflowRecord(value.record, { flowName: value.flowName, toStatus: value.toStatus, userId: req.user?.id });
    return res.status(200).json({ ok: true, data: result });
  } catch (err) { if (err.status) return res.status(err.status).json({ ok: false, message: err.message, code: err.code }); logger.error({ err }, "Error"); next(err); }
};

const getMetrics = async (req, res, next) => {
  try { const metrics = await svc.getDashboardMetrics(); return res.status(200).json({ ok: true, data: metrics }); }
  catch (err) { logger.error({ err }, "Error"); next(err); }
};

module.exports = { createAudit, listAudits, createFinding, listFindings, createEvidence, createChecklist, listChecklists, transitionRecord, getMetrics };