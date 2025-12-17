const { asyncHandler } = require("../../middlewares/asyncHandler");
const { drive } = require("../../config/google");
const svc = require("./auditPrep.service");

const asJson = (settings) => ({
  ...settings,
  active: svc.isAuditActive(settings),
});

exports.getStatus = asyncHandler(async (_req, res) => {
  const settings = await svc.getSettings();
  return res.status(200).json({ ok: true, status: asJson(settings) });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { audit_mode, audit_start_date, audit_end_date } = req.body || {};
  const updated = await svc.updateSettings({
    user: req.user,
    audit_mode,
    audit_start_date,
    audit_end_date,
  });
  return res.status(200).json({ ok: true, status: updated });
});

exports.listSections = asyncHandler(async (req, res) => {
  const sections = await svc.listSections({ role: req.user?.role });
  return res.status(200).json({ ok: true, sections });
});

exports.upsertSection = asyncHandler(async (req, res) => {
  const saved = await svc.upsertSection({ user: req.user, payload: req.body });
  return res.status(200).json({ ok: true, section: saved });
});

exports.listDocuments = asyncHandler(async (req, res) => {
  const docs = await svc.listDocuments({ role: req.user?.role });
  return res.status(200).json({ ok: true, documents: docs });
});

exports.uploadDocument = asyncHandler(async (req, res) => {
  const { section_code, file } = req.body || {};
  const saved = await svc.uploadDocument({ user: req.user, section_code, file });
  return res.status(201).json({ ok: true, document: saved });
});

exports.updateDocumentStatus = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  const updated = await svc.updateDocumentStatus({ user: req.user, id: req.params.id, status });
  return res.status(200).json({ ok: true, document: updated });
});

exports.downloadDocument = asyncHandler(async (req, res) => {
  const doc = await svc.getDocumentWithDrive(req.params.id);
  if (!doc || !doc.drive_file_id) {
    return res.status(404).json({ ok: false, message: "Documento no encontrado" });
  }

  const settings = await svc.getSettings();
  const normalizedRole = (req.user?.role || "").toLowerCase();
  if (!svc.isAuditActive(settings) && !["gerencia", "admin_ti", "jefe_ti"].includes(normalizedRole)) {
    return res.status(403).json({ ok: false, message: "Auditoría desactivada" });
  }

  svc.assertAllowedSection({ allowed_roles: doc.allowed_roles, code: doc.section_code }, req.user?.role);

  const stream = await drive.files.get(
    { fileId: doc.drive_file_id, alt: "media" },
    { responseType: "stream" }
  );

  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.name)}"`);
  res.setHeader("Content-Type", "application/octet-stream");

  stream.data
    .on("error", (err) => {
      res.status(500).end();
      throw err;
    })
    .pipe(res);
});

exports.listExternalAccess = asyncHandler(async (_req, res) => {
  const grants = await svc.listExternalAccess();
  return res.status(200).json({ ok: true, grants });
});

exports.addExternalAccess = asyncHandler(async (req, res) => {
  const { email, display_name, expires_at } = req.body || {};
  const grant = await svc.addExternalAccess({ user: req.user, email, display_name, expires_at });
  return res.status(201).json({ ok: true, grant });
});

exports.revokeExternalAccess = asyncHandler(async (req, res) => {
  const grant = await svc.revokeExternalAccess({ user: req.user, id: req.params.id });
  return res.status(200).json({ ok: true, grant });
});
