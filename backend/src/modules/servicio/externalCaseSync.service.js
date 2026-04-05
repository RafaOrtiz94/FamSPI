const logger = require("../../config/logger");
const externalCasesService = require("./externalCases.service");

const DEFAULT_INTERVAL_MS = Math.max(
  5000,
  Number(process.env.EXTERNAL_CASE_SYNC_INTERVAL_MS || 30000),
);

let schedulerRef = null;
let running = false;

const normalizeLimit = (value, fallback = 20) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(200, parsed));
};

async function runOnce({ limit, actorUser = null, workerId = "external-case-sync-service" } = {}) {
  const safeLimit = normalizeLimit(
    limit,
    normalizeLimit(process.env.EXTERNAL_CASE_SYNC_BATCH_LIMIT, 20),
  );
  const summary = await externalCasesService.processPendingSyncJobs({
    limit: safeLimit,
    actorUser,
    workerId,
  });
  logger.info({ summary }, "[EXTERNAL_CASE_SYNC] Batch procesado");
  return summary;
}

function startExternalCaseSyncJob() {
  if (schedulerRef) return;
  const intervalMs = DEFAULT_INTERVAL_MS;
  logger.info({ interval_ms: intervalMs }, "[EXTERNAL_CASE_SYNC] Scheduler iniciado");

  const tick = async () => {
    if (running) {
      logger.warn("[EXTERNAL_CASE_SYNC] Tick omitido: ejecución previa en curso");
      return;
    }
    running = true;
    try {
      await runOnce({
        limit: normalizeLimit(process.env.EXTERNAL_CASE_SYNC_BATCH_LIMIT, 20),
        workerId: "external-case-sync-scheduler",
      });
    } catch (error) {
      logger.error(
        { error: error?.message || String(error) },
        "[EXTERNAL_CASE_SYNC] Error en scheduler",
      );
    } finally {
      running = false;
    }
  };

  if (process.env.ENABLE_JOBS === "true") {
    tick().catch(() => null);
  }
  schedulerRef = setInterval(() => {
    tick().catch(() => null);
  }, intervalMs);
}

module.exports = {
  runOnce,
  startExternalCaseSyncJob,
};
