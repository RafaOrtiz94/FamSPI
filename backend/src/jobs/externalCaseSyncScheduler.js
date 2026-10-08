const logger = require("../config/logger");
const externalCaseSyncService = require("../modules/servicio/externalCaseSync.service");
const { isOffHours } = require("../utils/offHoursPolicy");
const { registerOffHoursJob } = require("./offHoursCoordinator");

// 6min: > timeout de autosuspend de Neon (~5min), deja huecos reales en horario laboral.
const DEFAULT_INTERVAL_MS = Math.max(
  5000,
  Number(process.env.EXTERNAL_CASE_SYNC_INTERVAL_MS || 360000),
);
const SHOULD_RUN_ON_START = String(process.env.JOBS_RUN_ON_START || "false").trim().toLowerCase() === "true";

let intervalRef = null;
let running = false;

const normalizeLimit = (value, fallback = 20) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(200, parsed));
};

async function runOnce(options = {}) {
  const limit = normalizeLimit(options.limit, normalizeLimit(process.env.EXTERNAL_CASE_SYNC_BATCH_LIMIT, 20));
  const summary = await externalCaseSyncService.runOnce({
    limit,
    actorUser: options.actorUser || null,
    workerId: options.workerId || "external-case-sync-job",
  });
  logger.info({ summary }, "[EXTERNAL_CASE_SYNC_JOB] Batch procesado");
  return summary;
}

async function runScheduled() {
  if (running) {
    logger.warn("[EXTERNAL_CASE_SYNC_JOB] Tick omitido: proceso previo en ejecución");
    return;
  }
  running = true;
  try {
    await runOnce({
      limit: normalizeLimit(process.env.EXTERNAL_CASE_SYNC_BATCH_LIMIT, 20),
      workerId: "external-case-sync-job-scheduler",
    });
  } catch (error) {
    logger.error(
      { error: error?.message || String(error) },
      "[EXTERNAL_CASE_SYNC_JOB] Error en scheduler",
    );
  } finally {
    running = false;
  }
}

function startExternalCaseSyncJob() {
  if (intervalRef) return;
  const everyMs = DEFAULT_INTERVAL_MS;

  const tick = async () => {
    if (isOffHours(new Date()).isOffHours) return; // manejado por offHoursCoordinator
    await runScheduled();
  };

  logger.info({ interval_ms: everyMs }, "[EXTERNAL_CASE_SYNC_JOB] Scheduler iniciado");
  if (process.env.ENABLE_JOBS === "true" && SHOULD_RUN_ON_START) {
    tick().catch(() => null);
  }
  intervalRef = setInterval(() => {
    tick().catch(() => null);
  }, everyMs);
  registerOffHoursJob({
    name: "external_case_sync",
    runOnce: runScheduled,
    offHoursIntervalMs: everyMs * 6,
  });
}

module.exports = {
  runOnce,
  startExternalCaseSyncJob,
};
