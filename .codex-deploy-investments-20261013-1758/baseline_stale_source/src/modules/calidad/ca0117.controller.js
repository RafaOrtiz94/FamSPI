const Joi = require("joi");
const repo = require("./ca0117.repository");
const svc = require("./ca0117.service");
const logger = require("../../config/logger");

const createReport = async (req, res, next) => {
  try { const schema = Joi.object({ reportNumber: Joi.string().required(), deviceName: Joi.string().required(), deviceModel: Joi.string(), serialNumber: Joi.string(), incidentType: Joi.string().valid("malfunction", "adverse_event", "near_miss", "recall", "other").required(), severity: Joi.string().valid("low", "moderate", "serious", "critical").required(), description: Joi.string(), reportedBy: Joi.string().uuid() }); const { error, value } = schema.validate(req.body); if (error) return res.status(400).json({ ok: false, message: error.details[0].message }); const result = await repo.createReport(value); return res.status(201).json({ ok: true, data: result }); } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const listReports = async (req, res, next) => {
  try { const results = await repo.listReports(req.query); return res.status(200).json({ ok: true, data: results }); } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const createInvestigation = async (req, res, next) => {
  try { const schema = Joi.object({ reportId: Joi.string().uuid().required(), investigatorId: Joi.string().uuid() }); const { error, value } = schema.validate(req.body); if (error) return res.status(400).json({ ok: false, message: error.details[0].message }); const result = await repo.createInvestigation(value); return res.status(201).json({ ok: true, data: result }); } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const createCorrectiveAction = async (req, res, next) => {
  try { const schema = Joi.object({ investigationId: Joi.string().uuid().required(), actionDescription: Joi.string().required(), responsibleId: Joi.string().uuid(), targetDate: Joi.date().iso() }); const { error, value } = schema.validate(req.body); if (error) return res.status(400).json({ ok: false, message: error.details[0].message }); const result = await repo.createCorrectiveAction(value); return res.status(201).json({ ok: true, data: result }); } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const transitionReport = async (req, res, next) => {
  try { const { id, toStatus } = req.body; const result = await repo.updateReportStatus(id, toStatus); return res.status(200).json({ ok: true, data: result }); } catch (err) { logger.error({ err }, "Error"); next(err); }
};

const getMetrics = async (req, res, next) => { try { const metrics = await svc.getDashboardMetrics(); return res.status(200).json({ ok: true, data: metrics }); } catch (err) { logger.error({ err }, "Error"); next(err); } };

module.exports = { createReport, listReports, createInvestigation, createCorrectiveAction, transitionReport, getMetrics };