const Joi = require("joi");
const repo = require("./ca0116.repository");
const svc = require("./ca0116.service");
const logger = require("../../config/logger");

const createBatch = async (req, res, next) => {
  try { const schema = Joi.object({ batchNumber: Joi.string().required(), productName: Joi.string().required(), quantity: Joi.number().required(), unit: Joi.string().required(), sampleDate: Joi.date().iso() }); const { error, value } = schema.validate(req.body); if (error) return res.status(400).json({ ok: false, message: error.details[0].message }); const result = await repo.createBatch(value); return res.status(201).json({ ok: true, data: result }); }
  catch (err) { logger.error({ err }, "Error"); next(err); }
};

const listBatches = async (req, res, next) => {
  try { const results = await repo.listBatches(req.query); return res.status(200).json({ ok: true, data: results }); }
  catch (err) { logger.error({ err }, "Error"); next(err); }
};

const createAnalysisResult = async (req, res, next) => {
  try { const schema = Joi.object({ batchId: Joi.string().uuid().required(), parameter: Joi.string().required(), resultValue: Joi.number().required(), conforms: Joi.boolean() }); const { error, value } = schema.validate(req.body); if (error) return res.status(400).json({ ok: false, message: error.details[0].message }); const result = await repo.createAnalysisResult(value); return res.status(201).json({ ok: true, data: result }); }
  catch (err) { logger.error({ err }, "Error"); next(err); }
};

const createApproval = async (req, res, next) => {
  try { const schema = Joi.object({ batchId: Joi.string().uuid().required(), approverId: Joi.string().uuid() }); const { error, value } = schema.validate(req.body); if (error) return res.status(400).json({ ok: false, message: error.details[0].message }); const result = await repo.createApproval(value); return res.status(201).json({ ok: true, data: result }); }
  catch (err) { logger.error({ err }, "Error"); next(err); }
};

const createRelease = async (req, res, next) => {
  try { const schema = Joi.object({ batchId: Joi.string().uuid().required(), releasedBy: Joi.string().uuid(), destination: Joi.string(), quantityReleased: Joi.number() }); const { error, value } = schema.validate(req.body); if (error) return res.status(400).json({ ok: false, message: error.details[0].message }); const result = await repo.createRelease(value); return res.status(201).json({ ok: true, data: result }); }
  catch (err) { logger.error({ err }, "Error"); next(err); }
};

const transitionBatch = async (req, res, next) => {
  try { const { id, toStatus } = req.body; const result = await repo.updateBatchStatus(id, toStatus); return res.status(200).json({ ok: true, data: result }); }
  catch (err) { logger.error({ err }, "Error"); next(err); }
};

const getMetrics = async (req, res, next) => { try { const metrics = await svc.getDashboardMetrics(); return res.status(200).json({ ok: true, data: metrics }); } catch (err) { logger.error({ err }, "Error"); next(err); } };

module.exports = { createBatch, listBatches, createAnalysisResult, createApproval, createRelease, transitionBatch, getMetrics };