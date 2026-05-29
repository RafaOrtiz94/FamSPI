const logger = require("../config/logger");
const { processApprovalEscalationReminders } = require("../modules/permisos/permisos.service");

const DEFAULT_INTERVAL_MINUTES = Math.min(Number(process.env.PERMISOS_APPROVAL_ESCALATION_INTERVAL_MINUTES || 30), 240);
const SHOULD_RUN_ON_START = String(process.env.JOBS_RUN_ON_START || "false").trim().toLowerCase() === "true";

async function runOnce() {
  const result = await processApprovalEscalationReminders();
  logger.info(
    `[PERMISOS APPROVAL ESCALATION] scanned=${Number(result?.scanned || 0)} reminded=${Number(result?.reminded || 0)} escalated=${Number(result?.escalated || 0)}`
  );
  return result;
}

let interval = null;

function startPermisosApprovalEscalationJob() {
  if (interval) return;
  const everyMs = Math.max(15, DEFAULT_INTERVAL_MINUTES) * 60 * 1000;
  logger.info(`Permisos approval escalation job configurado cada ${Math.round(everyMs / 60000)} min`);
  if (process.env.ENABLE_JOBS === "true" && SHOULD_RUN_ON_START) {
    runOnce().catch((error) => logger.error({ error }, "Error inicial permisos approval escalation job"));
  }
  interval = setInterval(() => {
    runOnce().catch((error) => logger.error({ error }, "Error permisos approval escalation job"));
  }, everyMs);
}

module.exports = {
  runOnce,
  startPermisosApprovalEscalationJob,
};
