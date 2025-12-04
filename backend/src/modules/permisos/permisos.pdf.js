const logger = require("../../config/logger");

async function generateFRH10(solicitud) {
  logger.info({ solicitudId: solicitud?.id }, "generateFRH10 placeholder");
  return null;
}

module.exports = { generateFRH10 };
