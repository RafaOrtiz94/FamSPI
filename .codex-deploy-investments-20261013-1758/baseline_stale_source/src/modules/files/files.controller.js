const svc = require("./file.service");
const { asyncHandler } = require("../../middlewares/asyncHandler");
const logger = require("../../config/logger");

exports.uploadFiles = asyncHandler(async (req, res) => {
  const requestId = req.params.requestId;
  const userId = req.user.id;
  const files = req.files || [];

  if (!files.length) {
    return res.status(400).json({ ok: false, error: "No se subieron archivos." });
  }

  logger.info(
    "[files] uploadFiles → request %s (%s archivos) por usuario %s",
    requestId,
    files.length,
    userId
  );

  const result = await svc.uploadFiles({ requestId, userId, files });
  logger.info("[files] uploadFiles ← %s archivos registrados", result.length);
  res.status(201).json({ ok: true, uploaded: result });
});

exports.listByRequest = asyncHandler(async (req, res) => {
  const requestId = req.params.requestId;
  logger.info("[files] listByRequest → request %s", requestId);
  const result = await svc.listByRequest(requestId);
  logger.info("[files] listByRequest ← %s registros", result.length);
  res.json({ ok: true, files: result });
});

exports.getMetadata = asyncHandler(async (req, res) => {
  const fileId = req.params.fileId;
  const meta = await svc.getMetadata(fileId);
  res.json({ ok: true, metadata: meta });
});

exports.downloadFile = asyncHandler(async (req, res) => {
  const fileId = req.params.fileId;
  const file = await svc.downloadFile(fileId);
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
  file.stream.pipe(res);
});

exports.deleteFile = asyncHandler(async (req, res) => {
  const fileId = req.params.fileId;
  const userId = req.user.id;
  logger.warn("[files] deleteFile → file %s solicitado por %s", fileId, userId);
  await svc.deleteFile(fileId, userId);
  res.json({ ok: true, message: "Archivo eliminado correctamente." });
});
