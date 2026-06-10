const logger = require('../../config/logger');
const svc    = require('./kickoff.service');

const CHECK_INTERVAL_MS = 30_000;

async function startKickoffScheduler() {
  // Crear tablas de desempate una sola vez al arrancar — evita DDL en cada request
  try {
    await svc.initTiebreakerSchema();
    logger.info('[kickoff-scheduler] Schema de desempate verificado');
  } catch (err) {
    logger.error(`[kickoff-scheduler] Error inicializando schema de desempate: ${err.message}`);
  }

  const run = async () => {
    await svc.autoStartOverduePresentations();
  };

  run();
  const interval = setInterval(run, CHECK_INTERVAL_MS);
  if (interval.unref) interval.unref();

  logger.info('[kickoff-scheduler] Auto-start scheduler iniciado (intervalo 30 s)');
}

module.exports = { startKickoffScheduler };
