const logger = require("../config/logger");
const { processExpiredRecoveryCoordinations } = require("../modules/permisos/permisos.service");
const { isOffHours } = require("../utils/offHoursPolicy");
const { registerOffHoursJob } = require("./offHoursCoordinator");

const DEFAULT_INTERVAL_MINUTES = Number(process.env.PERMISOS_RECOVERY_EXPIRY_INTERVAL_MINUTES || 60);
const SHOULD_RUN_ON_START = String(process.env.JOBS_RUN_ON_START || "false").trim().toLowerCase() === "true";

async function runOnce() {
  const result = await processExpiredRecoveryCoordinations();
  logger.info(
    `[PERMISOS RECOVERY EXPIRY] scanned=${Number(result?.scanned || 0)} settled=${Number(result?.settled || 0)}`
  );
  return result;
}

let interval = null;

function startPermisosRecoveryCoordinationExpiryJob() {
  if (interval) return;
  const everyMs = Math.max(15, DEFAULT_INTERVAL_MINUTES) * 60 * 1000;
  logger.info(
    `Permisos recovery coordination expiry job configurado cada ${Math.round(everyMs / 60000)} min`
  );
  if (process.env.ENABLE_JOBS === "true" && SHOULD_RUN_ON_START) {
    runOnce().catch((error) => logger.error({ error }, "Error inicial recovery coordination expiry job"));
  }
  interval = setInterval(() => {
    if (isOffHours(new Date()).isOffHours) return; // manejado por offHoursCoordinator
    runOnce().catch((error) => logger.error({ error }, "Error recovery coordination expiry job"));
  }, everyMs);
  registerOffHoursJob({
    name: "permisos_recovery_coordination_expiry",
    runOnce,
    offHoursIntervalMs: everyMs * 6,
  });
}

module.exports = {
  runOnce,
  startPermisosRecoveryCoordinationExpiryJob,
};
