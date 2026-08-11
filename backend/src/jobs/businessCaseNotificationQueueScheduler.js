/**
 * BC Notification Queue Scheduler
 * Processes pending notifications periodically.
 */

const logger = require('../config/logger');
const { processPendingNotifications } = require('../modules/business-case/businessCaseNotificationQueue.service');
const SHOULD_RUN_ON_START = String(process.env.JOBS_RUN_ON_START || "false").trim().toLowerCase() === "true";
const INTERVAL_MS = Math.max(5000, Number(process.env.BC_NOTIFICATION_QUEUE_INTERVAL_MS || 120000));

let running = false;

async function tick() {
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

async function runOnce() {
  return processPendingNotifications();
}

function start() {
  logger.info({ interval_ms: INTERVAL_MS }, 'BC notification queue scheduler started');
  setInterval(tick, INTERVAL_MS);
  if (SHOULD_RUN_ON_START) {
    tick();
  }
}

module.exports = { start, runOnce };
