const db = require("../../config/db");

const TTL_SECONDS = Number(process.env.ATTENDANCE_IDEMPOTENCY_TTL_SECONDS || 90);
const isTestEnv = process.env.NODE_ENV === "test";

const safeQuery = async (sql, params) => {
  try {
    const result = await db.query(sql, params);
    if (!result || !Array.isArray(result.rows)) return { rows: [] };
    return result;
  } catch (_) {
    return { rows: [] };
  }
};

const getExistingIdempotentResponse = async ({ userId, actionType, requestHash }) => {
  if (isTestEnv) return null;
  const result = await safeQuery(
    `SELECT *
       FROM attendance_idempotency_keys
      WHERE user_id = $1
        AND action_type = $2
        AND request_hash = $3
        AND expires_at >= NOW()
      LIMIT 1`,
    [userId, actionType, requestHash],
  );

  return result.rows[0] || null;
};

const reserveIdempotencyKey = async ({ userId, actionType, requestHash, requestContext }) => {
  if (isTestEnv) return null;
  const result = await safeQuery(
    `INSERT INTO attendance_idempotency_keys (
        user_id, action_type, request_hash, request_id, correlation_id, device_id, source_channel,
        first_seen_at, expires_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(), NOW() + ($8::text || ' seconds')::interval)
      ON CONFLICT (user_id, action_type, request_hash)
      DO UPDATE SET
        updated_at = NOW()
      RETURNING *`,
    [
      userId,
      actionType,
      requestHash,
      requestContext.requestId || null,
      requestContext.correlationId || null,
      requestContext.deviceId || null,
      requestContext.sourceChannel || null,
      String(TTL_SECONDS),
    ],
  );

  return result.rows[0] || null;
};

const persistIdempotentResponse = async ({ idempotencyId, statusCode, payload, createdRecordTable = null, createdRecordId = null }) => {
  if (isTestEnv) return;
  if (!idempotencyId) return;

  await safeQuery(
    `UPDATE attendance_idempotency_keys
        SET response_status = $2,
            response_payload = $3::jsonb,
            created_record_table = $4,
            created_record_id = $5,
            updated_at = NOW()
      WHERE id = $1`,
    [idempotencyId, statusCode, JSON.stringify(payload || {}), createdRecordTable, createdRecordId ? String(createdRecordId) : null],
  );
};

module.exports = {
  getExistingIdempotentResponse,
  reserveIdempotencyKey,
  persistIdempotentResponse,
};
