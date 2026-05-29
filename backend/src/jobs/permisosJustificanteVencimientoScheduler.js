const logger = require("../config/logger");
const { processJustificanteVencimientos } = require("../modules/permisos/permisos.service");

const DEFAULT_INTERVAL_MINUTES = Math.min(Number(process.env.PERMISOS_JUSTIFICANTE_EXPIRY_INTERVAL_MINUTES || 60), 240);
const SHOULD_RUN_ON_START = String(process.env.JOBS_RUN_ON_START || "false").trim().toLowerCase() === "true";

async function runOnce() {
  const result = await processJustificanteVencimientos();
  logger.info(
    `[PERMISOS JUSTIFICANTE VENCIMIENTO] scanned=${Number(result?.scanned || 0)} expired=${Number(result?.expired || 0)}`
  );
  return result;
}

let interval = null;

function startPermisosJustificanteVencimientoJob() {
  if (interval) return;
  const everyMs = Math.max(15, DEFAULT_INTERVAL_MINUTES) * 60 * 1000;
  logger.info(`Permisos justificante vencimiento job configurado cada ${Math.round(everyMs / 60000)} min`);
  if (process.env.ENABLE_JOBS === "true" && SHOULD_RUN_ON_START) {
    runOnce().catch((error) => logger.error({ error }, "Error inicial permisos justificante vencimiento job"));
  }
  interval = setInterval(() => {
    runOnce().catch((error) => logger.error({ error }, "Error permisos justificante vencimiento job"));
  }, everyMs);
}

module.exports = {
  runOnce,
  startPermisosJustificanteVencimientoJob,
};
