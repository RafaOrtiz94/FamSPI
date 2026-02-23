const db = require("../config/db");
const logger = require("../config/logger");
const notificationManager = require("../modules/notifications/notificationManager");

const DEFAULT_INTERVAL_MS = Number(process.env.BC_DETERMINATIONS_GATE_EXPIRY_INTERVAL_MS || 15 * 60 * 1000);

async function notifyExpiredGate({ businessCaseId, bcPurchaseType, deadlineAt, editors = [] }) {
  if (!Array.isArray(editors) || !editors.length) return;
  const { rows } = await db.query(
    `SELECT id, role FROM users WHERE role = ANY($1::text[]) AND active = true`,
    [editors],
  );
  if (!rows.length) return;
  await Promise.all(
    rows.map((user) =>
      notificationManager.sendNotification({
        userId: user.id,
        template: "custom_html",
        customTitle: "Ventana de determinaciones vencida",
        customMessage:
          `La ventana de 48 horas para determinaciones del BC ${businessCaseId} ha vencido. ` +
          `Tipo de flujo: ${bcPurchaseType || "N/A"}. Fecha limite: ${deadlineAt || "N/A"}.`,
        type: "alert",
        priority: 2,
        source: "business_case.determinations_gate_expired",
        email: true,
        chat: false,
        meta: {
          business_case_id: businessCaseId,
          bc_purchase_type: bcPurchaseType || null,
          determinations_deadline_at: deadlineAt || null,
          notified_role: user.role || null,
        },
      }).catch(() => null),
    ),
  );
}

async function runOnce() {
  const client = await db.getClient();
  const summary = { scanned: 0, expired: 0, notified: 0 };
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `
      SELECT id, bc_purchase_type, modern_bc_metadata
      FROM equipment_purchase_requests
      WHERE COALESCE((modern_bc_metadata->'determinations_gate'->>'enabled')::boolean, false) = true
        AND modern_bc_metadata->'determinations_gate'->>'deadline_at' IS NOT NULL
        AND COALESCE((modern_bc_metadata->'determinations_gate'->>'is_expired')::boolean, false) = false
        AND (modern_bc_metadata->'determinations_gate'->>'deadline_at')::timestamptz < NOW()
      FOR UPDATE SKIP LOCKED
      `,
    );
    summary.scanned = rows.length;

    for (const row of rows) {
      const metadata = row?.modern_bc_metadata && typeof row.modern_bc_metadata === "object"
        ? { ...row.modern_bc_metadata }
        : {};
      const gate = metadata?.determinations_gate && typeof metadata.determinations_gate === "object"
        ? { ...metadata.determinations_gate }
        : {};
      gate.is_expired = true;
      gate.expired_at = new Date().toISOString();
      gate.expired_notified_at = gate.expired_notified_at || null;
      metadata.determinations_gate = gate;

      await client.query(
        `UPDATE equipment_purchase_requests
         SET modern_bc_metadata = $2::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [row.id, JSON.stringify(metadata)],
      );

      summary.expired += 1;
    }
    await client.query("COMMIT");

    for (const row of rows) {
      const metadata = row?.modern_bc_metadata && typeof row.modern_bc_metadata === "object"
        ? row.modern_bc_metadata
        : {};
      const gate = metadata?.determinations_gate && typeof metadata.determinations_gate === "object"
        ? metadata.determinations_gate
        : {};
      const editors = String(row.bc_purchase_type || "").toLowerCase().includes("private")
        ? ["backoffice_comercial", "jefe_comercial"]
        : ["acp_comercial"];
      await notifyExpiredGate({
        businessCaseId: row.id,
        bcPurchaseType: row.bc_purchase_type,
        deadlineAt: gate?.deadline_at || null,
        editors,
      });
      summary.notified += 1;
    }
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error({ error: error.message }, "[BC][DETERMINATIONS_GATE] Error expirando ventanas");
    throw error;
  } finally {
    client.release();
  }
  logger.info({ summary }, "[BC][DETERMINATIONS_GATE] Expiraciones procesadas");
  return summary;
}

function startBusinessCaseDeterminationsGateExpiryJob() {
  const interval = Number.isFinite(DEFAULT_INTERVAL_MS) ? DEFAULT_INTERVAL_MS : 15 * 60 * 1000;
  setInterval(() => {
    runOnce().catch((error) => {
      logger.error({ error: error.message }, "[BC][DETERMINATIONS_GATE] Job interval failure");
    });
  }, interval);
  logger.info({ intervalMs: interval }, "[BC][DETERMINATIONS_GATE] Expiry job iniciado");
}

module.exports = {
  runOnce,
  startBusinessCaseDeterminationsGateExpiryJob,
};
