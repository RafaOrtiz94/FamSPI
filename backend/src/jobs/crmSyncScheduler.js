const logger = require("../config/logger");
const { isCrmSyncEnabled } = require("../config/crmDb");
const { processPendingOutboxBatch } = require("../modules/integrations/integrationOutboxWorker.service");
const { isOffHours } = require("../utils/offHoursPolicy");
const { registerOffHoursJob } = require("./offHoursCoordinator");

// 6min: > timeout de autosuspend de Neon (~5min), deja huecos reales en horario laboral.
const DEFAULT_INTERVAL_MS = Math.max(
  5000,
  Number(process.env.CRM_SYNC_INTERVAL_MS || 360000),
);
const DEFAULT_BATCH_LIMIT = Math.max(
  1,
  Math.min(100, Number(process.env.CRM_SYNC_BATCH_LIMIT || 20)),
);
const SHOULD_RUN_ON_START =
  String(process.env.JOBS_RUN_ON_START || "false").trim().toLowerCase() === "true";

let intervalRef = null;
let running = false;

async function runOnce() {
  if (!isCrmSyncEnabled()) {
    logger.info("[CRM_SYNC_JOB] CRM_SYNC_ENABLED=false — tick omitido");
    return { skipped: true, reason: "crm_sync_disabled" };
  }

  const summary = await processPendingOutboxBatch({
    limit: DEFAULT_BATCH_LIMIT,
    eventTypeFilter: "crm.%",
  });

  logger.info({ summary }, "[CRM_SYNC_JOB] Batch procesado");
  return summary;
}

function startCrmSyncJob() {
  if (!isCrmSyncEnabled()) {
    logger.info("[CRM_SYNC_JOB] Deshabilitado (CRM_SYNC_ENABLED=false) — scheduler no iniciado");
    return;
  }

  if (intervalRef) return;

  const runScheduled = async () => {
    if (running) {
      logger.warn("[CRM_SYNC_JOB] Tick omitido: proceso previo en ejecucion");
      return;
    }
    running = true;
    try {
      await runOnce();
    } catch (error) {
      logger.error(
        { error: error?.message || String(error) },
        "[CRM_SYNC_JOB] Error en scheduler",
      );
    } finally {
      running = false;
    }
  };

  const tick = async () => {
    if (isOffHours(new Date()).isOffHours) return; // manejado por offHoursCoordinator
    await runScheduled();
  };

  logger.info({ interval_ms: DEFAULT_INTERVAL_MS }, "[CRM_SYNC_JOB] Scheduler iniciado");

  if (SHOULD_RUN_ON_START) {
    tick().catch(() => null);
  }

  intervalRef = setInterval(() => {
    tick().catch(() => null);
  }, DEFAULT_INTERVAL_MS);
  registerOffHoursJob({
    name: "crm_sync",
    runOnce: runScheduled,
    offHoursIntervalMs: DEFAULT_INTERVAL_MS * 6,
  });
}

module.exports = { runOnce, startCrmSyncJob };
