/**
 * BC Notification Queue Service
 *
 * Persistent notification queue for Business Case state transitions.
 * Replaces fire-and-forget setImmediate with retries + exponential backoff.
 *
 * Retry schedule: attempt 1 → +0s, attempt 2 → +60s, attempt 3 → +300s
 * After max_attempts exhausted: status = 'dead', alert logged.
 */

const db = require('../../config/db');
const logger = require('../../config/logger');

const RETRY_DELAYS_SECONDS = [0, 60, 300]; // per attempt index
const BATCH_SIZE = 20;

let queueTableReady = false;
let queueTablePromise = null;

async function ensureQueueTable() {
  if (queueTableReady) return;
  if (queueTablePromise) return queueTablePromise;

  queueTablePromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.bc_notification_queue (
        id BIGSERIAL PRIMARY KEY,
        business_case_id UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        template TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        send_email BOOLEAN NOT NULL DEFAULT true,
        send_chat BOOLEAN NOT NULL DEFAULT false,
        priority INTEGER NOT NULL DEFAULT 2,
        source TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_error TEXT,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT bc_notification_queue_status_check
          CHECK (status IN ('pending', 'processing', 'sent', 'dead')),
        CONSTRAINT bc_notification_queue_attempts_check
          CHECK (attempts >= 0 AND max_attempts >= 1)
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_bc_notification_queue_status_next_attempt
        ON public.bc_notification_queue (status, next_attempt_at, priority DESC, id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_bc_notification_queue_business_case
        ON public.bc_notification_queue (business_case_id, created_at DESC);
    `);

    queueTableReady = true;
  })();

  try {
    await queueTablePromise;
  } finally {
    queueTablePromise = null;
  }
}

/**
 * Enqueue a notification for delivery.
 * @param {object} params
 */
async function enqueue({ businessCaseId, userId, template, payload = {}, sendEmail = true, sendChat = false, priority = 2, source = '' }) {
  await ensureQueueTable();
  await db.query(
    `INSERT INTO bc_notification_queue
       (business_case_id, user_id, template, payload, send_email, send_chat, priority, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [businessCaseId, userId, template, JSON.stringify(payload), sendEmail, sendChat, priority, source]
  );
}

/**
 * Enqueue notifications for multiple recipients atomically.
 * @param {object[]} notifications
 */
async function enqueueBatch(notifications) {
  await ensureQueueTable();
  if (!notifications.length) return;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    for (const n of notifications) {
      await client.query(
        `INSERT INTO bc_notification_queue
           (business_case_id, user_id, template, payload, send_email, send_chat, priority, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [n.businessCaseId, n.userId, n.template, JSON.stringify(n.payload || {}),
         n.sendEmail ?? true, n.sendChat ?? false, n.priority ?? 2, n.source || '']
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Process pending notifications. Called by scheduler.
 * Picks up to BATCH_SIZE items due for retry and sends them.
 */
async function processPendingNotifications() {
  await ensureQueueTable();
  // Claim a batch atomically
  const { rows } = await db.query(
    `UPDATE bc_notification_queue
     SET status = 'processing', updated_at = NOW()
     WHERE id IN (
       SELECT id FROM bc_notification_queue
       WHERE status IN ('pending', 'processing')
         AND next_attempt_at <= NOW()
         AND attempts < max_attempts
       ORDER BY priority DESC, next_attempt_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [BATCH_SIZE]
  );

  if (!rows.length) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;

  for (const item of rows) {
    try {
      const notificationManager = require('../notifications/notificationManager');
      await notificationManager.sendNotification({
        userId: item.user_id,
        template: item.template,
        data: item.payload,
        email: item.send_email,
        chat: item.send_chat,
        priority: item.priority,
        source: item.source,
        meta: { queueId: item.id, businessCaseId: item.business_case_id }
      });

      await db.query(
        `UPDATE bc_notification_queue
         SET status = 'sent', sent_at = NOW(), attempts = attempts + 1, updated_at = NOW()
         WHERE id = $1`,
        [item.id]
      );
      processed++;
    } catch (err) {
      const nextAttempt = item.attempts + 1;
      const delaySec = RETRY_DELAYS_SECONDS[nextAttempt] ?? RETRY_DELAYS_SECONDS[RETRY_DELAYS_SECONDS.length - 1];
      const isDead = nextAttempt >= item.max_attempts;

      await db.query(
        `UPDATE bc_notification_queue
         SET status = $1,
             attempts = attempts + 1,
             last_error = $2,
             next_attempt_at = NOW() + ($3 || ' seconds')::interval,
             updated_at = NOW()
         WHERE id = $4`,
        [isDead ? 'dead' : 'pending', err.message, String(delaySec), item.id]
      );

      if (isDead) {
        logger.error({ queueId: item.id, businessCaseId: item.business_case_id, template: item.template },
          'BC notification dead-lettered after max attempts');
      }
      failed++;
    }
  }

  logger.info({ processed, failed }, 'BC notification queue batch done');
  return { processed, failed };
}

module.exports = { enqueue, enqueueBatch, processPendingNotifications };
