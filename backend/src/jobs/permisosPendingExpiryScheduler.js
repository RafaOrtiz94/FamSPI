const logger = require("../config/logger");
const { processExpiredPendingSolicitudes } = require("../modules/permisos/permisos.service");
const { isOffHours } = require("../utils/offHoursPolicy");
const { registerOffHoursJob } = require("./offHoursCoordinator");

const DEFAULT_INTERVAL_MINUTES = Number(process.env.PERMISOS_PENDING_EXPIRY_INTERVAL_MINUTES || 60);
const SHOULD_RUN_ON_START = String(process.env.JOBS_RUN_ON_START || "false").trim().toLowerCase() === "true";

async function runOnce() {
  const result = await processExpiredPendingSolicitudes();
  logger.info(
    `[PERMISOS PENDING EXPIRY] scanned=${Number(result?.scanned || 0)} cancelled=${Number(result?.cancelled || 0)}`
  );
  return result;
}

let interval = null;

function startPermisosPendingExpiryJob() {
  if (interval) return;
  const everyMs = Math.max(15, DEFAULT_INTERVAL_MINUTES) * 60 * 1000;
  logger.info(`Permisos pending expiry job configurado cada ${Math.round(everyMs / 60000)} min`);
  if (process.env.ENABLE_JOBS === "true" && SHOULD_RUN_ON_START) {
    runOnce().catch((error) => logger.error({ error }, "Error inicial permisos pending expiry job"));
  }
  interval = setInterval(() => {
    if (isOffHours(new Date()).isOffHours) return; // manejado por offHoursCoordinator
    runOnce().catch((error) => logger.error({ error }, "Error permisos pending expiry job"));
  }, everyMs);
  registerOffHoursJob({
    name: "permisos_pending_expiry",
    runOnce,
    offHoursIntervalMs: everyMs * 6,
  });
}

module.exports = {
  runOnce,
  startPermisosPendingExpiryJob,
};
