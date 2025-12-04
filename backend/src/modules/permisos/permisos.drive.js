const logger = require("../../config/logger");

async function uploadJustificante({ solicitudId, tipoPermiso, tipoJustificante, fileBuffer, fileName, mimeType }) {
  logger.info({ solicitudId, tipoPermiso, tipoJustificante, fileName, mimeType }, "uploadJustificante placeholder");
  return { fileId: null, webViewLink: null };
}

module.exports = { uploadJustificante };
