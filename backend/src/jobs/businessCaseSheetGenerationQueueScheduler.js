const logger = require("../config/logger");
const sheetGenerationService = require("../modules/business-case/businessCaseSheetGeneration.service");

const DEFAULT_INTERVAL_MS = Number(process.env.BC_SHEET_JOB_INTERVAL_MS || 15000);
const DEFAULT_BATCH_LIMIT = Number(process.env.BC_SHEET_JOB_BATCH_LIMIT || 10);

let intervalRef = null;
let isRunning = false;

function normalizeLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_BATCH_LIMIT;
  return Math.max(1, Math.min(100, Math.floor(n)));
}

async function runOnce(options = {}) {
  const limit = normalizeLimit(options.limit);
  const summary = await sheetGenerationService.processPendingJobsBatch({ limit });
  logger.info({ limit, summary }, "[BC_SHEET] Batch de cola procesado");
  return summary;
}

function startBusinessCaseSheetGenerationQueueJob() {
  if (intervalRef) return;
  const everyMs = Math.max(5000, Number(DEFAULT_INTERVAL_MS || 15000));

  const tick = async () => {
    if (isRunning) {
      logger.warn("[BC_SHEET] Tick omitido porque el job anterior sigue en ejecucion");
      return;
    }

    isRunning = true;
    try {
      await runOnce({ limit: normalizeLimit(process.env.BC_SHEET_JOB_BATCH_LIMIT) });
    } catch (error) {
      logger.error(
        { error: error?.message || String(error) },
        "[BC_SHEET] Error ejecutando scheduler de cola",
      );
    } finally {
      isRunning = false;
    }
  };

  logger.info({ interval_ms: everyMs }, "[BC_SHEET] Scheduler de cola iniciado");
  if (process.env.ENABLE_JOBS === "true") {
    tick().catch(() => null);
  }
  intervalRef = setInterval(() => {
    tick().catch(() => null);
  }, everyMs);
}

module.exports = {
  runOnce,
  startBusinessCaseSheetGenerationQueueJob,
};
