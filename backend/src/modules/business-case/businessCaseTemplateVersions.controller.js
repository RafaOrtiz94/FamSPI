const { asyncHandler } = require("../../middlewares/asyncHandler");
const service = require("./businessCaseTemplateVersions.service");

const TEMPLATE_FOLDER_ID = process.env.BC_TEMPLATE_DRIVE_FOLDER_ID || null;

exports.getStatus = asyncHandler(async (req, res) => {
  const status = await service.getStatus();
  res.json({ ok: true, data: status });
});

exports.uploadVersion = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, message: "Debes adjuntar el archivo Excel de la plantilla base." });
  }
  const version = await service.uploadNewVersion({
    buffer: req.file.buffer,
    filename: req.file.originalname,
    user: req.user,
    folderId: TEMPLATE_FOLDER_ID,
  });
  res.status(201).json({ ok: true, data: version });
});

exports.activateVersion = asyncHandler(async (req, res) => {
  const version = await service.activateVersion(req.params.id, req.user);
  res.json({ ok: true, data: version });
});

exports.rejectVersion = asyncHandler(async (req, res) => {
  const version = await service.rejectVersion(req.params.id, req.user, req.body?.reason);
  res.json({ ok: true, data: version });
});

exports.getCatalogDiff = asyncHandler(async (req, res) => {
  const diff = await service.computeCatalogDiff();
  res.json({ ok: true, data: diff });
});

exports.syncCatalog = asyncHandler(async (req, res) => {
  const result = await service.syncCatalogFromActiveTemplate();
  res.json({ ok: true, data: result });
});

exports.getInvestmentCatalogDiff = asyncHandler(async (req, res) => {
  const diff = await service.computeInvestmentCatalogDiff();
  res.json({ ok: true, data: diff });
});

exports.syncInvestmentCatalog = asyncHandler(async (req, res) => {
  const result = await service.syncInvestmentCatalogFromActiveTemplate();
  res.json({ ok: true, data: result });
});

exports.getEquipmentSheetMappingReport = asyncHandler(async (req, res) => {
  const report = await service.buildEquipmentSheetMappingReport();
  res.json({ ok: true, data: report });
});
