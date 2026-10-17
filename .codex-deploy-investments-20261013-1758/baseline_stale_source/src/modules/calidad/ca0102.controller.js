const Joi = require("joi");
const service = require("./ca0102.service");

/**
 * Controller - CA-01-02 (Limpieza de Áreas)
 * Capa Edge HTTP con validación Joi y mapeo de errores GXP.
 */

const CLEANING_TYPES = ["routine", "deep_cleaning", "spill_recovery"];
const RISK_LEVELS = ["high", "medium", "low", "sterile"];

const registerCleaningSchema = Joi.object({
  areaId: Joi.string().uuid().required(),
  cleaningType: Joi.string().valid(...CLEANING_TYPES).required(),
  cleaningAgentUsed: Joi.string().max(255).required(),
  operatorNotes: Joi.string().max(2000).optional().allow("", null),
});

const transitionSchema = Joi.object({
  toStatus: Joi.string().valid("verified", "closed").required(),
  qaNotes: Joi.string().max(2000).optional().allow("", null),
});

const createAreaSchema = Joi.object({
  name: Joi.string().max(255).required(),
  riskLevel: Joi.string().valid(...RISK_LEVELS).required(),
  requiredFrequency: Joi.string().max(100).required(),
  description: Joi.string().max(1000).optional().allow("", null),
});

const registerCleaning = async (req, res) => {
  const { error, value } = registerCleaningSchema.validate(req.body);
  if (error) return res.status(400).json({ ok: false, message: error.details[0].message });

  try {
    const log = await service.registrarLimpieza({
      ...value,
      executedBy: req.user?.name || req.user?.email || "sistema",
    });
    return res.status(201).json({ ok: true, data: log });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, message: err.message });
  }
};

const getActiveLogs = async (req, res) => {
  try {
    const logs = await service.getActiveLogs();
    return res.status(200).json({ ok: true, data: logs });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

const transitionLog = async (req, res) => {
  const { logId } = req.params;
  const { error, value } = transitionSchema.validate(req.body);
  if (error) return res.status(400).json({ ok: false, message: error.details[0].message });

  try {
    const updated = await service.transitionLog(logId, {
      ...value,
      verifiedBy: req.user?.name || req.user?.email || "qa",
    });
    return res.status(200).json({ ok: true, data: updated });
  } catch (err) {
    return res.status(err.status || 500).json({ ok: false, message: err.message });
  }
};

const createArea = async (req, res) => {
  const { error, value } = createAreaSchema.validate(req.body);
  if (error) return res.status(400).json({ ok: false, message: error.details[0].message });

  try {
    const area = await require("./ca0102.repository").createArea(value);
    return res.status(201).json({ ok: true, data: area });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

const getAreas = async (req, res) => {
  try {
    const areas = await service.getAreas({ riskLevel: req.query.riskLevel });
    return res.status(200).json({ ok: true, data: areas });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

module.exports = { registerCleaning, getActiveLogs, transitionLog, createArea, getAreas };
