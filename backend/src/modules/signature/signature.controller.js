const rateLimit = require("express-rate-limit");
const QRCode = require("qrcode");
const { asyncHandler } = require("../../middlewares/asyncHandler");
const db = require("../../config/db");
const logger = require("../../config/logger");
const documentHashService = require("../../services/signatures/documentHash.service");
const advancedSignatureService = require("../../services/signatures/advancedSignature.service");
const digitalSealService = require("../../services/signatures/digitalSeal.service");
const verificationService = require("../../services/signatures/verification.service");

const verificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const toBufferFromBase64 = (base64String) => {
  try {
    return Buffer.from(base64String, "base64");
  } catch (err) {
    const error = new Error("Documento inválido o corrupto");
    error.status = 400;
    throw error;
  }
};

exports.signDocument = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const {
    document_base64: documentBase64,
    consent,
    consent_text: consentText,
    role_at_sign: roleAtSign,
    authorized_role: authorizedRole,
    session_id: sessionIdHeader,
  } = req.body || {};

  if (!documentBase64) {
    return res.status(400).json({ ok: false, message: "Se requiere el documento en base64" });
  }

  // La firma avanzada exige manifestación expresa de voluntad
  if (consent !== true) {
    return res
      .status(400)
      .json({ ok: false, message: "Se requiere consentimiento expreso (consent=true)" });
  }

  const documentBuffer = toBufferFromBase64(documentBase64);
  const sessionId = sessionIdHeader || req.headers["x-session-id"];
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  const userAgent = req.headers["user-agent"]; // requerido para trazabilidad según LOPDP

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const hashRecord = await documentHashService.createHash({
      documentId,
      documentBuffer,
      userId: req.user.id,
      client,
    });

    const signatureRecord = await advancedSignatureService.signDocument({
      documentHash: hashRecord,
      user: req.user,
      consentText,
      roleAtSign,
      ip: clientIp,
      userAgent,
      sessionId,
      client,
    });

    const sealRecord = await digitalSealService.applySeal({
      documentHash: hashRecord,
      authorizedRole: authorizedRole || req.user?.role,
      client,
    });

    await client.query("COMMIT");

    const verificationUrl = `${process.env.PUBLIC_BASE_URL || "https://spi.local"}/api/verificar/${sealRecord.verification_token}`;
    const qrImage = await QRCode.toDataURL(verificationUrl);

    res.status(201).json({
      ok: true,
      message: "Firma avanzada aplicada y documento bloqueado",
      hash: hashRecord,
      signature: signatureRecord,
      seal: {
        ...sealRecord,
        verification_url: verificationUrl,
        qr: qrImage,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "❌ Error en flujo de firma avanzada");
    const status = err.status || 500;
    res.status(status).json({ ok: false, message: err.message });
  } finally {
    client.release();
  }
});

exports.verifySeal = [
  verificationLimiter,
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    const base64FromQuery = req.query?.document_base64 || req.body?.document_base64;
    const documentBuffer = base64FromQuery ? toBufferFromBase64(base64FromQuery) : null;

    const result = await verificationService.verify({ token, documentBuffer });
    res.json({ ok: true, result });
  }),
];
