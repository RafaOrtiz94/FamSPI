const logger = require("../../config/logger");
const { isOdooIntegrationEnabled } = require("../../config/odooIntegration");
const { enqueueIntegrationEvent } = require("./integrationOutbox.service");

const normalizeText = (value) => String(value || "").trim();

const toPositiveIntegerOrNull = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

function enqueuePurchaseStatusChangedEvent({
  purchaseType,
  id,
  status,
  businessCaseId = null,
  correlationId = null,
} = {}) {
  if (!isOdooIntegrationEnabled()) {
    return {
      enqueued: false,
      skipped: true,
      reason: "integration_disabled",
    };
  }

  const normalizedPurchaseType = normalizeText(purchaseType);
  const normalizedStatus = normalizeText(status);
  const normalizedId = normalizeText(id);

  if (!normalizedPurchaseType || !normalizedStatus || !normalizedId) {
    logger.warn(
      {
        purchase_type: normalizedPurchaseType || null,
        id: normalizedId || null,
        status: normalizedStatus || null,
      },
      "[INTEGRATION_HOOK] Datos incompletos para emitir status_changed",
    );
    return {
      enqueued: false,
      skipped: true,
      reason: "invalid_payload",
    };
  }

  const eventType = `${normalizedPurchaseType}.status_changed`;
  const idempotencyKey = `${normalizedPurchaseType}:${normalizedId}:status:${normalizedStatus}`;
  const payload = {
    id: toPositiveIntegerOrNull(id) || normalizedId,
    status: normalizedStatus,
    business_case_id: toPositiveIntegerOrNull(businessCaseId),
  };

  // REQ-SPI-013: no await externo en el request path.
  setImmediate(async () => {
    try {
      await enqueueIntegrationEvent({
        eventType,
        payload,
        idempotencyKey,
        correlationId,
      });
    } catch (error) {
      logger.warn(
        {
          event_type: eventType,
          idempotency_key: idempotencyKey,
          error: error?.message || String(error),
        },
        "[INTEGRATION_HOOK] No se pudo encolar evento de compra",
      );
    }
  });

  return {
    enqueued: true,
    skipped: false,
    event_type: eventType,
    idempotency_key: idempotencyKey,
  };
}

module.exports = {
  enqueuePurchaseStatusChangedEvent,
};
