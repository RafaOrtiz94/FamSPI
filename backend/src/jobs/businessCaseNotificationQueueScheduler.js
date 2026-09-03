/**
 * BC Notification Queue Scheduler
 * Processes pending notifications periodically.
 */

const logger = require('../config/logger');
const { processPendingNotifications } = require('../modules/business-case/businessCaseNotificationQueue.service');
const { isOffHours } = require('../utils/offHoursPolicy');
const { registerOffHoursJob } = require('./offHoursCoordinator');
const SHOULD_RUN_ON_START = String(process.env.JOBS_RUN_ON_START || "false").trim().toLowerCase() === "true";
// 6min: > timeout de autosuspend de Neon (~5min), para dejar huecos reales
// incluso en horario laboral cuando no hay nada mas manteniendo el compute despierto.
const INTERVAL_MS = Math.max(5000, Number(process.env.BC_NOTIFICATION_QUEUE_INTERVAL_MS || 360000));

let running = false;

async function runScheduled() {
  if (running) return;
  running = true;
  try {
    await processPendingNotifications();
  } catch (err) {
    logger.error({ err }, 'BC notification queue scheduler error');
  } finally {
    running = false;
  }
}

async function tick() {
  if (isOffHours(new Date()).isOffHours) return; // manejado por offHoursCoordinator
  await runScheduled();
}

async function runOnce() {
  return processPendingNotifications();
}

function start() {
  logger.info({ interval_ms: INTERVAL_MS }, 'BC notification queue scheduler started');
  setInterval(tick, INTERVAL_MS);
  if (SHOULD_RUN_ON_START) {
    tick();
  }
  registerOffHoursJob({
    name: 'bc_notification_queue',
    runOnce: runScheduled,
    offHoursIntervalMs: INTERVAL_MS * 6,
  });
}

module.exports = { start, runOnce };
