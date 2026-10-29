const logger = require("../config/logger");
const notificationManager = require("../modules/notifications/notificationManager");

async function runOnce(options = {}) {
  const result = await notificationManager.processDispatchQueueBatch(options);
  logger.info({ result }, "[NOTIFICATIONS] Cola de despacho procesada");
  return result;
}

module.exports = { runOnce };

