const logger = require("../../config/logger");
const externalCasesService = require("./externalCases.service");

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

module.exports = {
  runOnce,
};
