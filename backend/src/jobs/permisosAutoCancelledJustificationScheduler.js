const logger = require("../config/logger");
const {
  processAutoCancelledJustificationWarnings,
  processAutoCancelledJustificationDeductions,
} = require("../modules/permisos/permisos.service");

const DEFAULT_INTERVAL_MINUTES = Number(process.env.PERMISOS_AUTO_CANCELLED_JUSTIFICATION_INTERVAL_MINUTES || 60);
const SHOULD_RUN_ON_START = String(process.env.JOBS_RUN_ON_START || "false").trim().toLowerCase() === "true";

async function runOnce() {
  const [warnings, deductions] = await Promise.all([
    processAutoCancelledJustificationWarnings(),
    processAutoCancelledJustificationDeductions(),
  ]);
  logger.info(
    `[PERMISOS AUTO-CANCELLED JUSTIFICATION] warnings: scanned=${Number(warnings?.scanned || 0)} warned=${Number(warnings?.warned || 0)} | deductions: scanned=${Number(deductions?.scanned || 0)} deducted=${Number(deductions?.deducted || 0)}`
  );
  return { warnings, deductions };
}

let interval = null;

function startPermisosAutoCancelledJustificationJob() {
  if (interval) return;
  const everyMs = Math.max(15, DEFAULT_INTERVAL_MINUTES) * 60 * 1000;
  logger.info(`Permisos auto-cancelled justification job configurado cada ${Math.round(everyMs / 60000)} min`);
  if (process.env.ENABLE_JOBS === "true" && SHOULD_RUN_ON_START) {
    runOnce().catch((error) => logger.error({ error }, "Error inicial permisos auto-cancelled justification job"));
  }
  interval = setInterval(() => {
    runOnce().catch((error) => logger.error({ error }, "Error permisos auto-cancelled justification job"));
  }, everyMs);
}

module.exports = {
  runOnce,
  startPermisosAutoCancelledJustificationJob,
};
