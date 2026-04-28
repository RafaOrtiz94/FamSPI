/**
 * BC Notification Queue Scheduler
 * Processes pending notifications every 30 seconds.
 */

const logger = require('../config/logger');
const { processPendingNotifications } = require('../modules/business-case/businessCaseNotificationQueue.service');
const SHOULD_RUN_ON_START = String(process.env.JOBS_RUN_ON_START || "false").trim().toLowerCase() === "true";

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

function start() {
  logger.info('BC notification queue scheduler started (30s interval)');
  setInterval(tick, 30_000);
  if (SHOULD_RUN_ON_START) {
    tick();
  }
}

module.exports = { start };
