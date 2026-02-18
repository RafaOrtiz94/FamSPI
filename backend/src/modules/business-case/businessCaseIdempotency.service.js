const crypto = require("crypto");
const db = require("../../config/db");

const MAX_IDEMPOTENCY_KEY_LENGTH = 200;

function normalizeIdempotencyKey(rawKey) {
  if (rawKey === undefined || rawKey === null) return null;
  const key = String(rawKey).trim();
  if (!key) return null;

  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    const error = new Error("Idempotency-Key excede el tamaño permitido");
    error.status = 400;
    error.code = "IDEMPOTENCY_KEY_TOO_LONG";
    throw error;
  }

  return key;
}

function normalizeScope(rawScope) {
  const scope = String(rawScope || "").trim().toLowerCase();
  if (!scope) {
    const error = new Error("operation_scope es requerido para idempotencia");
    error.status = 500;
    error.code = "IDEMPOTENCY_SCOPE_REQUIRED";
    throw error;
  }
  return scope;
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortObject(value[key]);
      return acc;
    }, {});
}

function hashPayload(payload) {
  const normalized = sortObject(payload || {});
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

async function start({ operationScope, idempotencyKey, businessCaseId = null, payload = {}, userId = null }) {
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  if (!normalizedKey) {
    return {
      enabled: false,
      replay: false,
      recordId: null,
      key: null,
      payloadHash: null,
    };
  }

  const scope = normalizeScope(operationScope);
  const payloadHash = hashPayload(payload);

  const insertResult = await db.query(
    `
    INSERT INTO business_case_idempotency_keys (
      operation_scope,
      idempotency_key,
      business_case_id,
      payload_hash,
      status,
      created_by,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, 'processing', $5, NOW(), NOW())
    ON CONFLICT (operation_scope, idempotency_key) DO NOTHING
    RETURNING id
    `,
    [scope, normalizedKey, businessCaseId, payloadHash, userId],
  );

  if (insertResult.rows.length) {
    return {
      enabled: true,
      replay: false,
      recordId: insertResult.rows[0].id,
      key: normalizedKey,
      payloadHash,
    };
  }

  const { rows } = await db.query(
    `
    SELECT id, payload_hash, status, http_status, response_payload
    FROM business_case_idempotency_keys
    WHERE operation_scope = $1
      AND idempotency_key = $2
    LIMIT 1
    `,
    [scope, normalizedKey],
  );

  const existing = rows[0];
  if (!existing) {
    const error = new Error("No se pudo validar idempotencia de la solicitud");
    error.status = 500;
    error.code = "IDEMPOTENCY_LOOKUP_ERROR";
    throw error;
  }

  if (existing.payload_hash !== payloadHash) {
    const error = new Error("Idempotency-Key ya fue usado con un payload distinto");
    error.status = 409;
    error.code = "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH";
    error.details = { operation_scope: scope };
    throw error;
  }

  if (existing.status === "completed" && existing.response_payload) {
    return {
      enabled: true,
      replay: true,
      recordId: existing.id,
      key: normalizedKey,
      replayStatus: existing.http_status || 200,
      replayPayload: existing.response_payload,
      payloadHash,
    };
  }

  if (existing.status === "processing") {
    const error = new Error("La solicitud con ese Idempotency-Key está en proceso");
    error.status = 409;
    error.code = "IDEMPOTENCY_KEY_IN_PROGRESS";
    throw error;
  }

  await db.query(
    `
    UPDATE business_case_idempotency_keys
    SET status = 'processing',
        error_message = NULL,
        updated_at = NOW()
    WHERE id = $1
    `,
    [existing.id],
  );

  return {
    enabled: true,
    replay: false,
    recordId: existing.id,
    key: normalizedKey,
    payloadHash,
  };
}

async function complete(recordId, { httpStatus = 200, responsePayload = {} } = {}) {
  if (!recordId) return;
  await db.query(
    `
    UPDATE business_case_idempotency_keys
    SET status = 'completed',
        http_status = $2,
        response_payload = $3::jsonb,
        error_message = NULL,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    `,
    [recordId, httpStatus, JSON.stringify(responsePayload || {})],
  );
}

async function fail(recordId, error) {
  if (!recordId) return;
  await db.query(
    `
    UPDATE business_case_idempotency_keys
    SET status = 'failed',
        error_message = $2,
        updated_at = NOW()
    WHERE id = $1
    `,
    [recordId, String(error?.message || "idempotent_write_failed")],
  );
}

module.exports = {
  start,
  complete,
  fail,
  hashPayload,
};
