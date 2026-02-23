const db = require("../config/db");
const logger = require("../config/logger");
const notificationManager = require("../modules/notifications/notificationManager");

const DEFAULT_INTERVAL_MINUTES = Number(process.env.BC_PREFLOW_EXPIRY_INTERVAL_MINUTES || 60);

async function runOnce() {
  const { rows } = await db.query(
    `SELECT id, client_name, modern_bc_metadata
       FROM equipment_purchase_requests
      WHERE request_type = 'business_case'
        AND COALESCE((modern_bc_metadata->>'preflow_enabled')::boolean, false) = true
        AND COALESCE((modern_bc_metadata->>'preflow_process_created')::boolean, false) = false`,
  );

  let expiredCount = 0;
  for (const row of rows || []) {
    const metadata = row.modern_bc_metadata && typeof row.modern_bc_metadata === 'object'
      ? row.modern_bc_metadata
      : {};
    const deadlineRaw = metadata.preflow_deadline_at || null;
    if (!deadlineRaw) continue;

    const deadline = new Date(deadlineRaw);
    if (!Number.isFinite(deadline.getTime()) || Date.now() <= deadline.getTime()) continue;
    if (String(metadata.preflow_status || '').toLowerCase() === 'expired') continue;

    expiredCount += 1;
    const nextMetadata = {
      ...metadata,
      preflow_status: 'expired',
      preflow_expired_at: new Date().toISOString(),
    };

    await db.query(
      `UPDATE equipment_purchase_requests
          SET modern_bc_metadata = $1::jsonb,
              updated_at = now()
        WHERE id = $2`,
      [JSON.stringify(nextMetadata), row.id],
    );

    await db.query(
      `INSERT INTO business_case_section_ownership_audit
         (business_case_id, section_name, action, performed_by, performed_by_role, canonical_state, metadata, performed_at)
       VALUES ($1,'preflow','preflow_expired',NULL,'system','draft',$2,now())`,
      [row.id, JSON.stringify({ deadline_at: deadlineRaw })],
    );

    const { rows: recipients } = await db.query(
      `SELECT id FROM users
        WHERE role = ANY($1)
          AND active = true`,
      [["jefe_comercial", "acp_comercial", "backoffice_comercial", "gerencia"]],
    );

    await Promise.all(
      (recipients || []).map((recipient) =>
        notificationManager.sendNotification({
          userId: recipient.id,
          customTitle: "Business Case preflujo vencido",
          customMessage: `El BC ${row.id} (${row.client_name || 'Cliente'}) vencio su ventana de 48h sin completar secciones requeridas.`,
          type: "warning",
          source: "business_case.preflow.expiry",
          priority: 2,
          email: true,
          chat: false,
          meta: { businessCaseId: row.id, deadline_at: deadlineRaw },
        }).catch(() => null),
      ),
    );
  }

  return { scanned: rows?.length || 0, expired: expiredCount };
}

let interval = null;
function startBusinessCasePreflowExpiryJob() {
  if (interval) return;
  const everyMs = Math.max(15, DEFAULT_INTERVAL_MINUTES) * 60 * 1000;
  logger.info(`Business Case preflow expiry job configurado cada ${Math.round(everyMs / 60000)} min`);
  if (process.env.ENABLE_JOBS === 'true') {
    runOnce().catch((error) => logger.error({ error }, "Error inicial preflow expiry job"));
  }
  interval = setInterval(() => {
    runOnce().catch((error) => logger.error({ error }, "Error preflow expiry job"));
  }, everyMs);
}

module.exports = {
  runOnce,
  startBusinessCasePreflowExpiryJob,
};
