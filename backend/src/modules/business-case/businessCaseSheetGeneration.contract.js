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
        cantidad: Joi.number().min(0).required(),
        precio: Joi.number().min(0).required(),
      }).required(),
    )
    .default({}),
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
