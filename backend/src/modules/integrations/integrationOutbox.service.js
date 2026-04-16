const crypto = require("crypto");
const db = require("../../config/db");
const { getContext } = require("../../utils/requestContext");

const OUTBOX_STATUSES = Object.freeze([
  "pending",
  "processing",
  "sent",
  "failed",
  "dead",
  "skipped",
]);

const buildError = (
  message,
  { status = 400, code = "INTEGRATION_OUTBOX_ERROR", details = null } = {},
) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
};

const asTrimmedText = (value, fallback = null) => {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
};

const resolveCorrelationId = (explicitCorrelationId) => {
  const explicit = asTrimmedText(explicitCorrelationId, null);
  if (explicit) return explicit;

  const context = getContext();
  const fromContext = asTrimmedText(context?.correlationId, null);
  if (fromContext) return fromContext;

  return crypto.randomUUID();
};

const ensurePayloadObject = (payload) => {
  if (payload === undefined || payload === null) return {};
  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw buildError("payload debe ser un objeto JSON", {
      code: "INTEGRATION_OUTBOX_INVALID_PAYLOAD",
    });
  }
  return payload;
};

const ensureEventType = (eventType) => {
  const normalized = asTrimmedText(eventType, null);
  if (!normalized) {
    throw buildError("eventType es requerido", {
      code: "INTEGRATION_OUTBOX_EVENT_TYPE_REQUIRED",
    });
  }
  return normalized;
};

const ensureIdempotencyKey = (idempotencyKey) => {
  const normalized = asTrimmedText(idempotencyKey, null);
  if (!normalized) {
    throw buildError("idempotencyKey es requerido", {
      code: "INTEGRATION_OUTBOX_IDEMPOTENCY_REQUIRED",
    });
  }
  return normalized;
};

const parsePgError = (error) => {
  if (!error?.code) return error;

  if (error.code === "23514") {
    return buildError("Validacion de negocio incumplida en integration_outbox", {
      status: 400,
      code: "INTEGRATION_OUTBOX_CHECK_VIOLATION",
      details: { constraint: error.constraint || null },
    });
  }

  return error;
};

async function enqueueIntegrationEvent({
  eventType,
  payload,
  idempotencyKey,
  correlationId = null,
  dbClient = null,
} = {}) {
  const normalizedEventType = ensureEventType(eventType);
  const normalizedPayload = ensurePayloadObject(payload);
  const normalizedIdempotencyKey = ensureIdempotencyKey(idempotencyKey);
  const normalizedCorrelationId = resolveCorrelationId(correlationId);
  const queryRunner = dbClient || db;

  try {
    const { rows } = await queryRunner.query(
      `
      INSERT INTO public.integration_outbox (
        event_type,
        payload,
        idempotency_key,
        correlation_id,
        status,
        attempt_count,
        last_error,
        created_at,
        updated_at
      )
      VALUES ($1, $2::jsonb, $3, $4, 'pending', 0, NULL, NOW(), NOW())
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id, created_at
      `,
      [
        normalizedEventType,
        JSON.stringify(normalizedPayload),
        normalizedIdempotencyKey,
        normalizedCorrelationId,
      ],
    );

    if (!rows.length) {
      return {
        inserted: false,
        duplicate: true,
        idempotency_key: normalizedIdempotencyKey,
        correlation_id: normalizedCorrelationId,
      };
    }

    return {
      inserted: true,
      duplicate: false,
      outbox_id: Number(rows[0].id),
      created_at: rows[0].created_at,
      idempotency_key: normalizedIdempotencyKey,
      correlation_id: normalizedCorrelationId,
    };
  } catch (error) {
    throw parsePgError(error);
  }
}

module.exports = {
  OUTBOX_STATUSES,
  enqueueIntegrationEvent,
};

