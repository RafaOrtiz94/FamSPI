const svc = require("./document.service");
const { asyncHandler } = require("../../middlewares/asyncHandler");
const logger = require("../../config/logger");

exports.createFromTemplate = asyncHandler(async (req, res) => {
  // body: { request_id, template_id, folder_id?, title?, data, images? }
  const userId = req.user.id;
  logger.info(
    "[documents] createFromTemplate → request %s template %s",
    req.body?.request_id,
    req.body?.template_id
  );
  const doc = await svc.createFromTemplate({ ...req.body, created_by: userId });
  res.status(201).json({ ok: true, document: doc });
});

exports.signAtTag = asyncHandler(async (req, res) => {
  // body: { base64, tag, role_at_sign? }
  const { documentId } = req.params;
  const userId = req.user.id;
  const { base64, tag, role_at_sign } = req.body;
  const result = await svc.signAtTag({ documentId, userId, base64, tag, role_at_sign });
  res.json({ ok: true, result });
});

exports.exportPdf = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const pdf = await svc.exportPdf(documentId);
  res.json({ ok: true, pdf });
});

exports.signAdvanced = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const {
    consent,
    consent_text: consentText,
    role_at_sign: roleAtSign,
    authorized_role: authorizedRole,
    session_id: sessionId,
  } = req.body || {};

  // La firma avanzada sólo procede con consentimiento expreso del titular
  if (consent !== true) {
    return res.status(400).json({ ok: false, message: "Se requiere consentimiento expreso" });
  }

  if (!sessionId) {
    return res.status(400).json({ ok: false, message: "session_id es obligatorio para trazabilidad" });
  }

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  const userAgent = req.headers["user-agent"]; // Evidencia técnica exigida por LOPDP

  const result = await svc.applyAdvancedSignature({
    documentId,
    user: req.user,
    consentText,
    roleAtSign,
    authorizedRole,
    sessionId,
    ip,
    userAgent,
  });

  res.status(201).json({ ok: true, ...result });
});

exports.getDocument = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  logger.info("[documents] getDocument → %s", documentId);
  const doc = await svc.getDocument(documentId);
  if (!doc) return res.status(404).json({ ok: false, error: "No encontrado" });
  res.json({ ok: true, document: doc });
});

exports.listByRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  logger.info("[documents] listByRequest → request %s", requestId);
  const rows = await svc.listByRequest(requestId);
  logger.info("[documents] listByRequest ← %s documentos", rows.length);
  res.json({ ok: true, rows });
});
