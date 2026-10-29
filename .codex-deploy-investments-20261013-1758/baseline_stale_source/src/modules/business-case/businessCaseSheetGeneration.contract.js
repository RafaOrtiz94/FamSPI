const crypto = require("crypto");
const Joi = require("joi");

const DEFAULT_MAPPING_VERSION = process.env.BC_SHEET_MAPPING_VERSION || "BC_MAPPING_v2026_01_15";

const generationRequestSchema = Joi.object({
  request_id: Joi.string().uuid().optional(),
  idempotency_key: Joi.string().max(200).optional(),
  mapping_version: Joi.string().trim().min(1).default(DEFAULT_MAPPING_VERSION),
  output_folder_id: Joi.string().trim().min(1).optional(),
  fields: Joi.object().min(1).required(),
  inversiones: Joi.object()
    .pattern(
      Joi.string().trim().min(1),
      Joi.object({
        nombre: Joi.string().allow("").optional(),
        categoria: Joi.string().allow("").optional(),
        caracteristicas: Joi.string().allow("").optional(),
        observaciones: Joi.string().allow("").optional(),
        cantidad: Joi.number().min(0).required(),
        precio: Joi.number().min(0).required(),
        precio_operativo: Joi.alternatives().try(Joi.number().min(0).optional(), Joi.allow(null)),
        precio_financiero: Joi.alternatives().try(Joi.number().min(0).optional(), Joi.allow(null)),
        descripcion: Joi.string().allow("").optional(),
      }).required(),
    )
    .default({}),
  max_quantities: Joi.array()
    .items(
      Joi.object({
        item_key: Joi.string().trim().required(),
        item_id: Joi.alternatives().try(Joi.string().allow("").optional(), Joi.number().optional(), Joi.allow(null)),
        item_name: Joi.string().allow("").required(),
        item_type: Joi.string().allow("").optional(),
        source: Joi.string().allow("").optional(),
        equipment_id: Joi.alternatives().try(Joi.number().integer().optional(), Joi.allow(null)),
        equipment_name: Joi.string().allow("").optional(),
        annual_qty: Joi.alternatives().try(Joi.number().min(0).optional(), Joi.allow(null)),
        planned_qty: Joi.alternatives().try(Joi.number().min(0).optional(), Joi.allow(null)),
        ops_dispatch_qty: Joi.alternatives().try(Joi.number().min(0).optional(), Joi.allow(null)),
        ops_dispatched_qty: Joi.alternatives().try(Joi.number().min(0).optional(), Joi.allow(null)),
        unit_price: Joi.alternatives().try(Joi.number().min(0).optional(), Joi.allow(null)),
      }).unknown(false),
    )
    .default([]),
  equipment_tabs: Joi.array()
    .items(
      Joi.object({
        sheet_name: Joi.string().trim().required(),
        equipment_ids: Joi.array().items(Joi.number().integer()).default([]),
        equipment_names: Joi.array().items(Joi.string().allow("")).default([]),
        client: Joi.string().allow("").optional(),
        date: Joi.string().allow("").optional(),
        modality: Joi.string().allow("").optional(),
        deadline_months: Joi.alternatives().try(Joi.number().min(0).optional(), Joi.allow(null)),
        projected_deadline_months: Joi.alternatives().try(Joi.number().min(0).optional(), Joi.allow(null)),
        items: Joi.array().items(Joi.object().unknown(true)).default([]),
      }).unknown(false),
    )
    .default([]),
  sheet_context: Joi.object({
    deadline_months: Joi.alternatives().try(Joi.number().min(0).optional(), Joi.allow(null)),
    projected_deadline_months: Joi.alternatives().try(Joi.number().min(0).optional(), Joi.allow(null)),
    modality: Joi.alternatives().try(Joi.string().allow("").optional(), Joi.allow(null)),
  }).default({}),
  // Si true, se descarta el archivo existente y se crea una copia fresca del
  // Sheet maestro (drive.files.copy), incluso si el archivo actual ya tiene
  // todas las pestañas requeridas. Uso: forzar la correccion de formato en
  // BCs cuyo Sheet se genero antes de que existiera la copia del maestro.
  force_recreate: Joi.boolean().default(false),
}).required();

function sortRecursively(value) {
  if (Array.isArray(value)) return value.map(sortRecursively);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortRecursively(value[key]);
      return acc;
    }, {});
}

function stableStringify(value) {
  return JSON.stringify(sortRecursively(value));
}

function validateGenerationRequest(input) {
  const { error, value } = generationRequestSchema.validate(input, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (!error) {
    return { ok: true, value };
  }

  return {
    ok: false,
    error,
    message: error.details.map((item) => item.message).join("; "),
  };
}

function buildSignedWebAppPayload(payload, secret) {
  if (!secret) {
    const error = new Error("BC_SHEET_WEBAPP_SECRET no configurado");
    error.code = "WEBAPP_SECRET_MISSING";
    error.status = 500;
    throw error;
  }

  const base = {
    request_id: payload.request_id,
    idempotency_key: payload.idempotency_key,
    mapping_version: payload.mapping_version,
    timestamp: payload.timestamp,
    auth_token: payload.auth_token,
    output_folder_id: payload.output_folder_id,
    fields: payload.fields || {},
    inversiones: payload.inversiones || {},
    max_quantities: payload.max_quantities || [],
    equipment_tabs: payload.equipment_tabs || [],
    sheet_context: payload.sheet_context || {},
  };

  const canonical = stableStringify(base);
  const signature = crypto.createHmac("sha256", String(secret)).update(canonical, "utf8").digest("hex");

  return {
    ...base,
    signature,
  };
}

module.exports = {
  DEFAULT_MAPPING_VERSION,
  generationRequestSchema,
  validateGenerationRequest,
  stableStringify,
  buildSignedWebAppPayload,
};
