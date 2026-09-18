/**
 * Job: Expiración automática de flujos de firma vencidos
 * -------------------------------------------------------
 * Corre una vez al día a las 03:00. Marca como 'expired' los flujos
 * que llevan más de SIGNATURE_WORKFLOW_EXPIRY_DAYS días (default 30)
 * sin completarse, y actualiza los registros fuente relacionados.
 *
 * Activación: POST /internal-jobs/signature-workflows/expiry
 */

const cron = require("node-cron");
const db = require("../config/db");
const logger = require("../config/logger");

const DEFAULT_EXPIRY_DAYS = Number(process.env.SIGNATURE_WORKFLOW_EXPIRY_DAYS || 30);

async function _syncSourceRecord({ sourceModule, sourceEntity, sourceEntityId }) {
  try {
    if (sourceModule === "collab-deliveries" && sourceEntity === "acta") {
      await db.query(
        `UPDATE public.collab_delivery_actas
            SET signature_workflow_status = 'expired',
                updated_at = now()
          WHERE id = $1`,
        [sourceEntityId],
      );
    } else if (sourceModule === "ti-assets" && sourceEntity === "acta") {
      await db.query(
        `UPDATE public.ti_asset_actas
            SET signature_workflow_status = 'expired',
                updated_at = now()
          WHERE id = $1`,
        [sourceEntityId],
      );
    }
  } catch (err) {
    // Log but don't throw — source sync is best-effort
    logger.warn(
      { error: err?.message, sourceModule, sourceEntity, sourceEntityId },
      "[JOBS][SIG_WORKFLOW_EXPIRY] Error sincronizando registro fuente",
    );
  }
}

async function runOnce() {
  const expiryDays = Math.max(1, DEFAULT_EXPIRY_DAYS);
  logger.info(
    { expiryDays },
    "[JOBS][SIG_WORKFLOW_EXPIRY] Iniciando expiración de flujos de firma vencidos",
  );

  const { rows: expiredWorkflows } = await db.query(
    `SELECT
       id,
       workflow_code,
       title,
       status,
       source_module,
       source_entity,
       source_entity_id
     FROM public.signature_workflows
     WHERE status IN ('sent', 'in_progress', 'partially_signed')
       AND sent_at < now() - make_interval(days => $1)
     ORDER BY sent_at ASC`,
    [expiryDays],
  );

  let expired = 0, failed = 0;

  for (const workflow of expiredWorkflows) {
    try {
      await db.query(
        `UPDATE public.signature_workflows
            SET status     = 'expired',
                expired_at = now(),
                active     = false,
                updated_at = now()
          WHERE id = $1`,
        [workflow.id],
      );

      expired++;
      logger.info(
        { workflowId: workflow.id, workflowCode: workflow.workflow_code },
        "[JOBS][SIG_WORKFLOW_EXPIRY] Flujo marcado como expirado",
      );

      if (workflow.source_module && workflow.source_entity && workflow.source_entity_id) {
        await _syncSourceRecord({
          sourceModule: workflow.source_module,
          sourceEntity: workflow.source_entity,
          sourceEntityId: workflow.source_entity_id,
        });
      }
    } catch (err) {
      failed++;
      logger.error(
        { error: err?.message, workflowId: workflow.id, workflowCode: workflow.workflow_code },
        "[JOBS][SIG_WORKFLOW_EXPIRY] Error expirando flujo",
      );
    }
  }

  const result = { scanned: expiredWorkflows.length, expired, failed };
  logger.info(result, "[JOBS][SIG_WORKFLOW_EXPIRY] Finalizado");
  return result;
}

let _cronTask = null;
function startSignatureWorkflowExpiryJob() {
  if (_cronTask) return;
  logger.info("[JOBS][SIG_WORKFLOW_EXPIRY] Scheduler configurado — corre diariamente a las 03:00");
  _cronTask = cron.schedule("0 3 * * *", () => {
    runOnce().catch((err) =>
      logger.error({ error: err?.message }, "[JOBS][SIG_WORKFLOW_EXPIRY] Error en ejecución programada"),
    );
  });
}

module.exports = { runOnce, startSignatureWorkflowExpiryJob };
