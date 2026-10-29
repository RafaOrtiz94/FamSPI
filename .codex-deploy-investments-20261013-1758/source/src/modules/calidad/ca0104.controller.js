const Joi = require("joi");
const service = require("./ca0104.service");
const logger = require("../../config/logger");

/**
 * Controller - CA-01-04 (Control de Plagas)
 * -----------------------------------------
 * Edge HTTP con validación Joi y mapeo de errores GXP.
 */

const FLOW_NAMES = ["traps_map", "inspections", "vendor_api", "toxicity"];
const STATUS_VALUES = ["draft", "review", "approved", "archived"];

const trapsMapSchema = Joi.object({
  areaName: Joi.string().max(255).required(),
  trapCode: Joi.string().max(120).required(),
  pestType: Joi.string().max(255).required(),
  riskLevel: Joi.string().valid("high", "medium", "low", "sterile").required(),
  coordinates: Joi.string().max(500).optional().allow("", null),
  description: Joi.string().max(2000).optional().allow("", null),
  status: Joi.string().valid(...STATUS_VALUES).optional(),
});

const inspectionSchema = Joi.object({
  trapsMapId: Joi.string().uuid().required(),
  inspectionDate: Joi.date().iso().required(),
  inspectorName: Joi.string().max(255).required(),
  findings: Joi.string().max(4000).required(),
  pestEvidence: Joi.boolean().optional(),
  qaNotes: Joi.string().max(2000).optional().allow("", null),
  status: Joi.string().valid(...STATUS_VALUES).optional(),
});

const vendorApiSchema = Joi.object({
  vendorName: Joi.string().max(255).required(),
  apiEndpoint: Joi.string().uri().required(),
  apiKeyRef: Joi.string().max(255).optional().allow("", null),
  contactEmail: Joi.string().email().optional().allow("", null),
  description: Joi.string().max(2000).optional().allow("", null),
  status: Joi.string().valid(...STATUS_VALUES).optional(),
});

const toxicitySchema = Joi.object({
  inspectionId: Joi.string().uuid().optional().allow("", null),
  chemicalName: Joi.string().max(255).required(),
  toxicityLevel: Joi.string().max(120).required(),
  exposureNotes: Joi.string().max(2000).optional().allow("", null),
  qaNotes: Joi.string().max(2000).optional().allow("", null),
  status: Joi.string().valid(...STATUS_VALUES).optional(),
});

const transitionSchema = Joi.object({
  flowName: Joi.string().valid(...FLOW_NAMES).required(),
  toStatus: Joi.string().valid(...STATUS_VALUES).required(),
  qaNotes: Joi.string().max(2000).optional().allow("", null),
});

const softDeleteSchema = Joi.object({
  flowName: Joi.string().valid(...FLOW_NAMES).required(),
});

const validateBody = (schema, res, body) => {
  const { error, value } = schema.validate(body);
  if (error) {
    res.status(400).json({ ok: false, message: error.details[0].message });
    return null;
  }
  return value;
};

const getUserRef = (req) => req.user?.name || req.user?.email || req.user?.id || req.user?.uid || "sistema";

const createTrapsMap = async (req, res, next) => {
  try {
    const value = validateBody(trapsMapSchema, res, req.body);
    if (!value) return;

    const result = await service.registerTrapsMap({
      ...value,
      createdBy: getUserRef(req),
    });

    res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error endpoint CA-01-04: createTrapsMap");
    next(err);
  }
};

const createInspection = async (req, res, next) => {
  try {
    const value = validateBody(inspectionSchema, res, req.body);
    if (!value) return;

    const result = await service.registerInspection({
      ...value,
      createdBy: getUserRef(req),
    });

    res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error endpoint CA-01-04: createInspection");
    next(err);
  }
};

const createVendorApi = async (req, res, next) => {
  try {
    const value = validateBody(vendorApiSchema, res, req.body);
    if (!value) return;

    const result = await service.registerVendorApi({
      ...value,
      createdBy: getUserRef(req),
    });

    res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error endpoint CA-01-04: createVendorApi");
    next(err);
  }
};

const createToxicity = async (req, res, next) => {
  try {
    const value = validateBody(toxicitySchema, res, req.body);
    if (!value) return;

    const result = await service.registerToxicity({
      ...value,
      createdBy: getUserRef(req),
    });

    res.status(201).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error endpoint CA-01-04: createToxicity");
    next(err);
  }
};

const transitionRecord = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    if (!recordId) {
      return res.status(400).json({ ok: false, message: "ID del registro es mandatorio en path." });
    }

    const value = validateBody(transitionSchema, res, req.body);
    if (!value) return;

    const payload = { ...value, userId: req.user?.id || req.user?.uid || null };
    const result = await service.transitionRecord({ id: recordId, status: req.body.currentStatus || undefined }, payload);

    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    if (err.status) {
      logger.warn({ err }, "Intento fallido de transicion CA-01-04 bloqueado.");
      return res.status(err.status).json({ ok: false, message: err.message, code: err.code });
    }
    logger.error({ err }, "Error endpoint CA-01-04: transitionRecord");
    next(err);
  }
};

const listTrapsMaps = async (req, res, next) => {
  try {
    const data = await service.listTrapsMaps({
      riskLevel: req.query.riskLevel,
      status: req.query.status,
    });
    res.status(200).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
};

const listInspections = async (req, res, next) => {
  try {
    const data = await service.listInspections({
      trapsMapId: req.query.trapsMapId,
      status: req.query.status,
    });
    res.status(200).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
};

const listVendorApis = async (req, res, next) => {
  try {
    const data = await service.listVendorApis({ status: req.query.status });
    res.status(200).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
};

const listToxicity = async (req, res, next) => {
  try {
    const data = await service.listToxicity({
      inspectionId: req.query.inspectionId,
      status: req.query.status,
    });
    res.status(200).json({ ok: true, data });
  } catch (err) {
    next(err);
  }
};

const softDeleteRecord = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    if (!recordId) {
      return res.status(400).json({ ok: false, message: "ID del registro es mandatorio en path." });
    }

    const value = validateBody(softDeleteSchema, res, req.body);
    if (!value) return;

    let result;
    if (value.flowName === "traps_map") {
      result = await service.softDeleteTrapsMap(recordId);
    } else if (value.flowName === "inspections") {
      result = await service.softDeleteInspection(recordId);
    } else if (value.flowName === "vendor_api") {
      result = await service.softDeleteVendorApi(recordId);
    } else {
      result = await service.softDeleteToxicity(recordId);
    }

    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "Error endpoint CA-01-04: softDeleteRecord");
    next(err);
  }
};

module.exports = {
  createTrapsMap,
  createInspection,
  createVendorApi,
  createToxicity,
  transitionRecord,
  listTrapsMaps,
  listInspections,
  listVendorApis,
  listToxicity,
  softDeleteRecord,
};
