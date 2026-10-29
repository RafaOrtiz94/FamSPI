const db = require("../../config/db");
const logger = require("../../config/logger");
const crmService = require("./crm.service");

const DEFAULT_BATCH_LIMIT = Number(process.env.INTEGRATION_OUTBOX_BATCH_LIMIT || 20);
const DEFAULT_MAX_ATTEMPTS = Number(process.env.INTEGRATION_OUTBOX_MAX_ATTEMPTS || 3);

const normalizeBatchLimit = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return Math.max(1, DEFAULT_BATCH_LIMIT);
  return Math.max(1, Math.min(200, parsed));
};

const normalizeMaxAttempts = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return Math.max(1, DEFAULT_MAX_ATTEMPTS);
  return Math.max(1, Math.min(20, parsed));
};

const CRM_EVENT_PREFIX = "crm.";

const isCrmEvent = (eventType) =>
  String(eventType || "").startsWith(CRM_EVENT_PREFIX);

const sendToCrm = async (row) => {
  const { event_type, payload } = row;
  const p = payload || {};

  switch (event_type) {
    case "crm.client.approved":
      return crmService.sendClientApproved(p);
    case "crm.client.updated":
      return crmService.sendClientUpdated(p);
    case "crm.opportunity.sync":
      return crmService.sendOpportunitySync(p);
    case "crm.visit.registered":
      return crmService.sendVisitSync(p);
    case "crm.prospect.upsert":
      return crmService.sendProspectSync(p);
    default:
      logger.warn({ event_type }, "[INTEGRATION_OUTBOX_CRM] Tipo de evento CRM no mapeado — marcando como skipped");
      return { skipped: true, reason: "unmapped_crm_event" };
  }
};

const claimPendingBatch = async (limit, eventTypeFilter = null) => {
  const filterSql = eventTypeFilter
    ? `AND event_type LIKE '${eventTypeFilter}'`
    : "";

  const { rows } = await db.query(
    `
    WITH candidates AS (
      SELECT id
      FROM public.integration_outbox
      WHERE status = 'pending'
      ${filterSql}
      ORDER BY id ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.integration_outbox o
    SET
      status = 'processing',
      attempt_count = o.attempt_count + 1,
      updated_at = NOW(),
      last_error = NULL
    FROM candidates c
    WHERE o.id = c.id
    RETURNING o.*
    `,
    [limit],
  );

  return rows || [];
};

const markSent = async ({ id }) => {
  await db.query(
    `
    UPDATE public.integration_outbox
    SET
      status = 'sent',
      processed_at = NOW(),
      updated_at = NOW(),
      last_error = NULL
    WHERE id = $1
    `,
    [id],
  );
};

const markFailure = async ({ id, attemptCount, errorMessage, maxAttempts }) => {
  const isDead = Number(attemptCount) >= Number(maxAttempts);
  await db.query(
    `
    UPDATE public.integration_outbox
    SET
      status = $2,
      processed_at = CASE WHEN $2 = 'dead' THEN NOW() ELSE processed_at END,
      updated_at = NOW(),
      last_error = $3
    WHERE id = $1
    `,
    [id, isDead ? "dead" : "failed", errorMessage],
  );

  return isDead ? "dead" : "failed";
};

async function processPendingOutboxBatch({
  limit = DEFAULT_BATCH_LIMIT,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  eventTypeFilter = null,
} = {}) {
  const safeLimit = normalizeBatchLimit(limit);
  const safeMaxAttempts = normalizeMaxAttempts(maxAttempts);

  const batch = await claimPendingBatch(safeLimit, eventTypeFilter);
  const summary = {
    enabled: true,
    scanned: batch.length,
    sent: 0,
    failed: 0,
    dead: 0,
    skipped: 0,
    processed_ids: [],
  };

  for (const row of batch) {
    try {
      if (!isCrmEvent(row.event_type)) {
        // ponytail: no queda ningun provider para eventos no-CRM (Odoo se
        // elimino del sistema). Si en el futuro se agrega otra integracion,
        // este es el lugar para despacharla.
        await db.query(
          `UPDATE public.integration_outbox SET status='skipped', processed_at=NOW(), updated_at=NOW(), last_error='no_provider_for_event_type' WHERE id=$1`,
          [row.id],
        );
        summary.skipped += 1;
        summary.processed_ids.push(Number(row.id));
        continue;
      }
      if (!crmService.isCrmSyncEnabled()) {
        await db.query(
          `UPDATE public.integration_outbox SET status='skipped', processed_at=NOW(), updated_at=NOW(), last_error='crm_sync_disabled' WHERE id=$1`,
          [row.id],
        );
        summary.skipped += 1;
        summary.processed_ids.push(Number(row.id));
        continue;
      }
      await sendToCrm(row);

      await markSent({ id: row.id });
      summary.sent += 1;
      summary.processed_ids.push(Number(row.id));
      logger.info(
        {
          outbox_id: Number(row.id),
          event_type: row.event_type,
          correlation_id: row.correlation_id,
        },
        "[INTEGRATION_OUTBOX] Evento enviado",
      );
    } catch (error) {
      const errorMessage = String(error?.message || "outbox processing error");
       
      const status = await markFailure({
        id: row.id,
        attemptCount: Number(row.attempt_count || 0),
        errorMessage,
        maxAttempts: safeMaxAttempts,
      });

      if (status === "dead") summary.dead += 1;
      else summary.failed += 1;
      summary.processed_ids.push(Number(row.id));
      logger.error(
        {
          outbox_id: Number(row.id),
          event_type: row.event_type,
          correlation_id: row.correlation_id,
          status,
          error: errorMessage,
        },
        "[INTEGRATION_OUTBOX] Error procesando evento",
      );
    }
  }

  logger.info({ summary }, "[INTEGRATION_OUTBOX] Batch procesado");
  return summary;
}

module.exports = {
  sendToCrm,
  processPendingOutboxBatch,
};

