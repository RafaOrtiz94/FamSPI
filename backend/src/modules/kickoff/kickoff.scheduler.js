const logger = require('../../config/logger');
const svc    = require('./kickoff.service');
const { isOffHours } = require('../../utils/offHoursPolicy');
const { registerOffHoursJob } = require('../../jobs/offHoursCoordinator');

// 6min: > timeout de autosuspend de Neon (~5min), deja huecos reales en horario laboral.
// Antes 30s corriendo sin condicion en cada instancia (app.js) -> nunca dejaba
// suspender el compute de Neon durante todo el horario laboral. Ahora corre
// solo en la instancia jobs-runner (ver server.js) con este intervalo.
const CHECK_INTERVAL_MS = Math.max(
  5000,
  Number(process.env.KICKOFF_AUTOSTART_INTERVAL_MS || 360000),
);

async function runOnce() {
  await svc.autoStartOverduePresentations();
}

async function startKickoffScheduler() {
  // Crear tablas de desempate una sola vez al arrancar — evita DDL en cada request
  try {
    await svc.initTiebreakerSchema();
    logger.info('[kickoff-scheduler] Schema de desempate verificado');
  } catch (err) {
    logger.error(`[kickoff-scheduler] Error inicializando schema de desempate: ${err.message}`);
  }

  runOnce();
  // Los eventos Kickoff/famdays solo pasan en horario laboral -> fuera de
  // horario, en vez de este intervalo indefinido, lo maneja offHoursCoordinator
  // a un ritmo mucho mas bajo (nada que auto-iniciar cuando no hay evento).
  const interval = setInterval(() => {
    if (isOffHours(new Date()).isOffHours) return;
    runOnce();
  }, CHECK_INTERVAL_MS);
  if (interval.unref) interval.unref();
  registerOffHoursJob({
    name: 'kickoff_auto_start_overdue',
    runOnce,
    offHoursIntervalMs: 60 * 60 * 1000,
  });

  logger.info(
    { interval_ms: CHECK_INTERVAL_MS },
    '[kickoff-scheduler] Auto-start scheduler iniciado',
  );
}

module.exports = { startKickoffScheduler, runOnce };
