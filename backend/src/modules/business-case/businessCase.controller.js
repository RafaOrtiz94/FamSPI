const Joi = require("joi");
const logger = require("../../config/logger");
const businessCaseService = require("./businessCase.service");
const equipmentSelectionService = require("./equipmentSelection.service");
const determinationsService = require("./determinations.service");

const createSchema = Joi.object({
  client_name: Joi.string().required(),
  client_id: Joi.number().integer().optional(),
  status: Joi.string().default("draft"),
  bc_stage: Joi.string().optional(),
  bc_progress: Joi.object().default({}),
  assigned_to_email: Joi.string().email().optional(),
  assigned_to_name: Joi.string().optional(),
  extra: Joi.object().default({}),
  modern_bc_metadata: Joi.object().default({}),
});

const updateSchema = Joi.object({
  client_name: Joi.string().optional(),
  client_id: Joi.number().integer().optional(),
  status: Joi.string().optional(),
  bc_stage: Joi.string().optional(),
  bc_progress: Joi.object().optional(),
  assigned_to_email: Joi.string().email().optional(),
  assigned_to_name: Joi.string().optional(),
  extra: Joi.object().optional(),
  modern_bc_metadata: Joi.object().optional(),
});

const equipmentSchema = Joi.object({
  equipmentId: Joi.number().integer().required(),
  isPrimary: Joi.boolean().default(true),
});

const determinationSchema = Joi.object({
  determinationId: Joi.number().integer().required(),
  monthlyQty: Joi.number().integer().positive().required(),
});

async function list(req, res) {
  try {
    const { page, pageSize, status, client_name, q } = req.query;
    const result = await businessCaseService.listBusinessCases({ page, pageSize, status, client_name, q });
    res.json({ ok: true, ...result });
  } catch (error) {
    logger.error(error);
    res.status(error.status || 500).json({ ok: false, message: error.message || "Error listando Business Cases" });
  }
}

async function create(req, res) {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const bc = await businessCaseService.createBusinessCase(value, req.user);
    res.status(201).json({ ok: true, data: bc });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error creando Business Case" });
  }
}

async function getById(req, res) {
  try {
    const bc = await businessCaseService.getBusinessCaseById(req.params.id);
    res.json({ ok: true, data: bc });
  } catch (error) {
    logger.error(error);
    res.status(error.status || 500).json({ ok: false, message: error.message || "No se pudo obtener el Business Case" });
  }
}

async function update(req, res) {
  try {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const bc = await businessCaseService.updateBusinessCase(req.params.id, value);
    res.json({ ok: true, data: bc });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error actualizando Business Case" });
  }
}

async function remove(req, res) {
  try {
    await businessCaseService.deleteBusinessCase(req.params.id);
    res.status(204).send();
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error eliminando Business Case" });
  }
}

async function selectEquipment(req, res) {
  try {
    const { error, value } = equipmentSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const selection = await equipmentSelectionService.selectEquipment(
      req.params.id,
      value.equipmentId,
      value.isPrimary,
      req.user,
    );
    res.status(201).json({ ok: true, data: selection });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error seleccionando equipo" });
  }
}

async function addDetermination(req, res) {
  try {
    const { error, value } = determinationSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const determination = await determinationsService.addDetermination(
      req.params.id,
      value.determinationId,
      value.monthlyQty,
      req.user,
    );
    res.status(201).json({ ok: true, data: determination, warnings: res.locals.warnings || [] });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error agregando determinación" });
  }
}

async function updateDetermination(req, res) {
  try {
    const { error, value } = Joi.object({ monthlyQty: Joi.number().integer().positive().required() }).validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const determination = await determinationsService.updateDeterminationQuantity(
      req.params.id,
      req.params.detId,
      value.monthlyQty,
    );
    res.json({ ok: true, data: determination, warnings: res.locals.warnings || [] });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error actualizando determinación" });
  }
}

async function removeDetermination(req, res) {
  try {
    await determinationsService.removeDetermination(req.params.id, req.params.detId);
    res.status(204).send();
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error eliminando determinación" });
  }
}

async function getDeterminations(req, res) {
  try {
    const dets = await determinationsService.getDeterminations(req.params.id);
    res.json({ ok: true, data: dets });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error obteniendo determinaciones" });
  }
}

async function getCalculations(req, res) {
  try {
    const calculations = await businessCaseService.getCalculations(req.params.id);
    res.json({ ok: true, data: calculations });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error obteniendo cálculos" });
  }
}

async function recalculate(req, res) {
  try {
    const calculations = await businessCaseService.recalculateBusinessCase(req.params.id);
    res.json({ ok: true, data: calculations });
  } catch (err) {
    logger.error(err);
    res.status(err.status || 500).json({ ok: false, message: err.message || "Error recalculando Business Case" });
  }
}

module.exports = {
  list,
  create,
  getById,
  update,
  remove,
  selectEquipment,
  addDetermination,
  updateDetermination,
  removeDetermination,
  getDeterminations,
  getCalculations,
  recalculate,
};
