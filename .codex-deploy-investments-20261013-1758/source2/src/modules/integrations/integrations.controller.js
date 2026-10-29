const Joi = require("joi");
const service = require("./integrations.service");

const listProductMapQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(25),
  active: Joi.boolean().optional(),
  q: Joi.string().trim().allow("").optional(),
  business_category: Joi.string()
    .trim()
    .valid(...service.BUSINESS_CATEGORIES)
    .optional(),
});

const productMapUpsertSchema = Joi.object({
  id: Joi.number().integer().positive().optional(),
  legacy_code: Joi.string().trim().allow(null, "").optional(),
  spi_sku: Joi.string().trim().allow(null, "").optional(),
  spi_equipment_model_id: Joi.number().integer().positive().allow(null).optional(),
  odoo_product_id: Joi.number().integer().positive().allow(null).optional(),
  business_category: Joi.string()
    .trim()
    .valid(...service.BUSINESS_CATEGORIES)
    .optional(),
  active: Joi.boolean().optional(),
  notes: Joi.string().allow(null, "").max(2000).optional(),
}).custom((value, helpers) => {
  const hasId = Boolean(value.id);
  const hasReference = Boolean(value.legacy_code || value.spi_sku || value.spi_equipment_model_id);
  if (!hasId && !hasReference) {
    return helpers.error("any.custom", {
      message: "Se requiere id o una referencia (legacy_code, spi_sku, spi_equipment_model_id)",
    });
  }
  return value;
});

const productMapPatchSchema = Joi.object({
  legacy_code: Joi.string().trim().allow(null, "").optional(),
  spi_sku: Joi.string().trim().allow(null, "").optional(),
  spi_equipment_model_id: Joi.number().integer().positive().allow(null).optional(),
  odoo_product_id: Joi.number().integer().positive().allow(null).optional(),
  business_category: Joi.string()
    .trim()
    .valid(...service.BUSINESS_CATEGORIES)
    .optional(),
  active: Joi.boolean().optional(),
  notes: Joi.string().allow(null, "").max(2000).optional(),
})
  .or(
    "legacy_code",
    "spi_sku",
    "spi_equipment_model_id",
    "odoo_product_id",
    "business_category",
    "active",
    "notes",
  );

const coverageQuerySchema = Joi.object({
  missing_limit: Joi.number().integer().min(1).max(1000).default(200),
  missing_offset: Joi.number().integer().min(0).default(0),
  include_inactive: Joi.boolean().default(false),
});

const handleError = (res, error, fallbackMessage) => {
  const status = error?.status || 500;
  return res.status(status).json({
    ok: false,
    message: error?.message || fallbackMessage,
    code: error?.code || (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
    details: error?.details || null,
  });
};

const getValidationMessage = (error) => {
  if (!error?.details?.length) return "Solicitud invalida";
  return error.details.map((detail) => detail.message).join(", ");
};

async function getHealth(req, res) {
  try {
    const data = await service.getExternalIntegrationsHealth();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo obtener estado de integraciones");
  }
}

async function processExternalSyncQueue(req, res) {
  try {
    const data = await service.processExternalCasesSyncQueue({
      limit: req.body?.limit || req.query?.limit,
      actorUser: req.user || null,
    });
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return handleError(res, error, "No se pudo procesar cola de sincronizacion externa");
  }
}

async function listProductMap(req, res) {
  const { error, value } = listProductMapQuerySchema.validate(req.query || {}, {
    convert: true,
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      ok: false,
      code: "PRODUCT_MAP_QUERY_INVALID",
      message: getValidationMessage(error),
      details: error.details,
    });
  }

  try {
    const data = await service.listProductMap(value);
    return res.status(200).json({ ok: true, data });
  } catch (errorService) {
    return handleError(res, errorService, "No se pudo listar el libro de correspondencia");
  }
}

async function upsertProductMap(req, res) {
  const { error, value } = productMapUpsertSchema.validate(req.body || {}, {
    convert: true,
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      ok: false,
      code: "PRODUCT_MAP_PAYLOAD_INVALID",
      message: getValidationMessage(error),
      details: error.details,
    });
  }

  try {
    const data = await service.upsertProductMap(value);
    return res.status(200).json({ ok: true, data });
  } catch (errorService) {
    return handleError(res, errorService, "No se pudo guardar el libro de correspondencia");
  }
}

async function patchProductMap(req, res) {
  const mapId = Number.parseInt(String(req.params?.id || ""), 10);
  if (!Number.isFinite(mapId) || mapId < 1) {
    return res.status(400).json({
      ok: false,
      code: "PRODUCT_MAP_ID_INVALID",
      message: "id invalido",
    });
  }

  const { error, value } = productMapPatchSchema.validate(req.body || {}, {
    convert: true,
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      ok: false,
      code: "PRODUCT_MAP_PATCH_INVALID",
      message: getValidationMessage(error),
      details: error.details,
    });
  }

  try {
    const row = await service.updateProductMap(mapId, value);
    return res.status(200).json({ ok: true, data: row });
  } catch (errorService) {
    return handleError(res, errorService, "No se pudo actualizar la fila de correspondencia");
  }
}

async function getProductMapCoverageReport(req, res) {
  const { error, value } = coverageQuerySchema.validate(req.query || {}, {
    convert: true,
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      ok: false,
      code: "PRODUCT_MAP_COVERAGE_QUERY_INVALID",
      message: getValidationMessage(error),
      details: error.details,
    });
  }

  try {
    const data = await service.getProductMapCoverageReport(value);
    return res.status(200).json({ ok: true, data });
  } catch (errorService) {
    return handleError(res, errorService, "No se pudo construir el reporte de cobertura");
  }
}

module.exports = {
  getHealth,
  processExternalSyncQueue,
  listProductMap,
  upsertProductMap,
  patchProductMap,
  getProductMapCoverageReport,
};

