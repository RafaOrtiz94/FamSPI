const rateLimit = require("express-rate-limit");
const QRCode = require("qrcode");
const crypto = require("crypto");
const { asyncHandler } = require("../../middlewares/asyncHandler");
const db = require("../../config/db");
const logger = require("../../config/logger");
const { assertSignatureDependencies } = require("../../services/signatures/signatureSchema.service");

const SIGNATURE_CONSTANTS = {
  ALGORITHMS: {
    SHA256: "sha256",
    DISPLAY_NAME: "SHA-256",
  },
  TYPES: {
    ADVANCED: "ADVANCED",
  },
  AUTH_METHODS: {
    OAUTH_CORPORATE: "OAUTH_CORPORATE",
  },
  STATUS: {
    PENDING: "PENDING",
    SIGNED: "SIGNED",
  },
};

const verificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const toBufferFromBase64 = (base64String) => {
  try {
    return Buffer.from(base64String, "base64");
  } catch (_err) {
    const error = new Error("Documento invalido o corrupto");
    error.status = 400;
    throw error;
  }
};

const validateSignatureRequest = (body) => {
  const { document_base64, consent, role_at_sign: roleAtSign, authorized_role: authorizedRole } = body || {};

  if (!document_base64) {
    const error = new Error("Se requiere el documento en base64");
    error.status = 400;
    throw error;
  }

  if (consent !== true) {
    const error = new Error("Se requiere consentimiento expreso (consent=true)");
    error.status = 400;
    throw error;
  }

  if (!String(roleAtSign || "").trim()) {
    const error = new Error("Se requiere el rol con el que firma");
    error.status = 400;
    throw error;
  }

  if (!String(authorizedRole || "").trim()) {
    const error = new Error("Se requiere el rol autorizado para el sello");
    error.status = 400;
    throw error;
  }
};

const calculateDocumentHash = async (client, documentId, documentBuffer, userId) => {
  const hashValue = crypto.createHash(SIGNATURE_CONSTANTS.ALGORITHMS.SHA256).update(documentBuffer).digest("hex");

  await client.query(
    `UPDATE document_hashes
     SET is_current = FALSE
     WHERE document_id = $1 AND is_current = TRUE`,
    [documentId]
  );

  const hashResult = await client.query(
    `INSERT INTO document_hashes (
      document_id,
      document_type,
      hash_sha256,
      hash_algorithm,
      calculated_by,
      calculated_at,
      is_current
    ) VALUES ($1, $2, $3, 'SHA-256', $4, NOW(), TRUE)
    RETURNING id, hash_sha256`,
    [documentId, null, hashValue, userId]
  );

  return { hashId: hashResult.rows[0].id, hashValue: hashResult.rows[0].hash_sha256 };
};

const updateDocumentWithHash = async (client, documentId, hashId) => {
  await client.query(
    `UPDATE documents
     SET current_hash_id = $1,
         signature_status = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [hashId, SIGNATURE_CONSTANTS.STATUS.PENDING, documentId]
  );
};

const createAdvancedSignature = async (client, signatureData) => {
  const { documentId, hashId, userId, userName, userEmail, userDepartment, roleAtSign, userRole, clientIp, userAgent, sessionId } = signatureData;

  const result = await client.query(
    `INSERT INTO document_signatures_advanced (
      document_id,
      signer_user_id,
      signer_role,
      signature_type,
      signer_name,
      signer_email,
      signer_department,
      signed_at,
      ip_address,
      user_agent,
      session_id,
      auth_method,
      document_hash_id,
      signature_hash,
      is_valid
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12, $13, TRUE)
    RETURNING id, signed_at`,
    [
      documentId,
      userId,
      roleAtSign || userRole,
      SIGNATURE_CONSTANTS.TYPES.ADVANCED,
      userName,
      userEmail,
      userDepartment,
      clientIp,
      userAgent,
      sessionId,
      SIGNATURE_CONSTANTS.AUTH_METHODS.OAUTH_CORPORATE,
      hashId,
      crypto.createHash("sha256").update(`${documentId}:${hashId}:${userId}:${sessionId}`).digest("hex"),
    ]
  );

  return result.rows[0];
};

const createSealAndQR = async (client, documentId, authorizedRole, userRole, userId) => {
  const sealResult = await client.query(`SELECT * FROM create_document_seal_and_qr($1, $2, $3)`, [
    documentId,
    authorizedRole || userRole,
    userId,
  ]);

  return {
    sealId: sealResult.rows[0]?.seal_id,
    qrId: sealResult.rows[0]?.qr_id,
  };
};

const getSealAndQRInfo = async (client, sealId) => {
  const result = await client.query(
    `SELECT
       ds.id,
       ds.seal_code,
       ds.issued_by,
       ds.authorized_role,
       ds.issued_at,
       ds.is_active,
       dqc.id AS qr_id,
       dqc.qr_url,
       dqc.verification_token,
       dqc.access_count,
       dqc.last_accessed_at,
       dqc.is_active AS qr_active
     FROM document_seals ds
     LEFT JOIN document_qr_codes dqc ON dqc.seal_id = ds.id
     WHERE ds.id = $1`,
    [sealId]
  );

  return result.rows[0] || null;
};

const generateQRCode = async (verificationToken) => {
  const verificationUrl = `${(process.env.PUBLIC_BASE_URL || "https://spi.famproject.app").replace(/\/$/, "")}/verificar/${verificationToken}`;
  const qrImage = await QRCode.toDataURL(verificationUrl);
  return { verificationUrl, qrImage };
};

const lockDocument = async (client, documentId, userId) => {
  await client.query(
    `UPDATE documents
     SET is_locked = TRUE,
         signed = TRUE,
         locked_at = NOW(),
         locked_by = $1,
         signature_status = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [userId, SIGNATURE_CONSTANTS.STATUS.SIGNED, documentId]
  );
};

const collectRoles = (user = {}) => {
  const roles = new Set();
  const push = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized) roles.add(normalized);
  };

  push(user.role);
  push(user.scope);
  if (Array.isArray(user.roles)) user.roles.forEach(push);
  return roles;
};

exports.signDocument = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const { document_base64: documentBase64, role_at_sign: roleAtSign, authorized_role: authorizedRole, session_id: sessionIdHeader } = req.body || {};

  validateSignatureRequest(req.body);
  await assertSignatureDependencies(["sealGenerator"]);

  if (!req.user?.email) {
    return res.status(422).json({ ok: false, message: "El usuario autenticado no tiene email para registrar la firma" });
  }

  const documentBuffer = toBufferFromBase64(documentBase64);
  const sessionId = sessionIdHeader || req.headers["x-session-id"];
  if (!sessionId) {
    return res.status(400).json({ ok: false, message: "session_id requerido para trazabilidad" });
  }

  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  const userAgent = req.headers["user-agent"];
  const userName = req.user.fullname || req.user.name || req.user.email;

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const docResult = await client.query(`SELECT id FROM documents WHERE id = $1`, [documentId]);
    if (docResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, message: "Documento no encontrado" });
    }

    const { hashId, hashValue } = await calculateDocumentHash(client, documentId, documentBuffer, req.user.id);
    await updateDocumentWithHash(client, documentId, hashId);

    const signature = await createAdvancedSignature(client, {
      documentId,
      hashId,
      userId: req.user.id,
      userName,
      userEmail: req.user.email,
      userDepartment: req.user.department || null,
      roleAtSign,
      userRole: req.user.role,
      clientIp,
      userAgent,
      sessionId,
    });

    const { sealId, qrId } = await createSealAndQR(client, documentId, authorizedRole, req.user.role, req.user.id);
    const sealInfo = sealId ? await getSealAndQRInfo(client, sealId) : null;
    const qrData = sealInfo?.verification_token ? await generateQRCode(sealInfo.verification_token) : { verificationUrl: null, qrImage: null };

    await lockDocument(client, documentId, req.user.id);
    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      message: "Firma aplicada y documento bloqueado",
      data: {
        document_id: Number(documentId),
        hash: {
          id: hashId,
          value: hashValue,
          algorithm: SIGNATURE_CONSTANTS.ALGORITHMS.DISPLAY_NAME,
        },
        signature: {
          id: signature.id,
          signed_at: signature.signed_at,
          signer: userName,
          role: roleAtSign || req.user.role,
        },
        seal: sealInfo
          ? {
              id: sealInfo.id,
              code: sealInfo.seal_code,
              issued_by: sealInfo.issued_by,
              authorized_role: sealInfo.authorized_role,
              verification_token: sealInfo.verification_token,
            }
          : null,
        qr: sealInfo
          ? {
              id: qrId || sealInfo.qr_id,
              url: qrData.verificationUrl || sealInfo.qr_url,
              image: qrData.qrImage,
            }
          : null,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Error en flujo de firma");
    return res.status(err.status || 500).json({ ok: false, message: err.message || "Error interno del servidor" });
  } finally {
    client.release();
  }
});

exports.verifyDocument = [
  verificationLimiter,
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    try {
      const dependencyStatus = await assertSignatureDependencies(["verificationView"]);
      const result = await db.query(
        `SELECT *
         FROM document_verification_info
         WHERE verification_token = $1 AND qr_active = TRUE`,
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ ok: false, message: "Token de verificacion no encontrado o expirado" });
      }

      const doc = result.rows[0];
      const qrLookup = await db.query(
        `SELECT id FROM document_qr_codes WHERE verification_token = $1 LIMIT 1`,
        [token]
      );
      if (dependencyStatus.qrTracker && qrLookup.rows[0]?.id) {
        await db.query(`SELECT track_qr_access($1)`, [qrLookup.rows[0].id]);
      } else if (!dependencyStatus.qrTracker) {
        logger.warn("Seguimiento QR omitido: track_qr_access() no esta disponible");
      }

      return res.json({
        ok: true,
        verification: {
          document_id: doc.document_id,
          signature_status: doc.signature_status,
          is_locked: doc.is_locked,
          is_valid: !!doc.hash_sha256,
          hash: {
            value: doc.hash_sha256,
            algorithm: "SHA-256",
            calculated_at: doc.hash_calculated_at,
          },
          signature: {
            signed_at: doc.last_signed_at,
            signer_name: doc.last_signer_name,
            signer_role: doc.last_signer_role,
          },
          seal: {
            code: doc.seal_code,
            issued_by: doc.issued_by,
            authorized_role: doc.authorized_role,
            issued_at: doc.issued_at,
            is_active: doc.seal_active,
            token: doc.seal_token,
          },
          qr: {
            verification_token: doc.verification_token,
            url: doc.qr_url,
            access_count: doc.access_count,
            last_accessed_at: doc.last_accessed_at,
            is_active: doc.qr_active,
          },
        },
      });
    } catch (err) {
      logger.error({ err }, "Error en verificacion de documento");
      return res.status(err.status || 500).json({ ok: false, message: err.message || "Error interno del servidor" });
    }
  }),
];

exports.getDocumentAuditTrail = asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  try {
    const docResult = await db.query(
      `SELECT d.id, d.request_id, d.locked_by, dsa.signer_user_id
       FROM documents d
       LEFT JOIN document_signatures_advanced dsa ON dsa.document_id = d.id
       WHERE d.id = $1`,
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Documento no encontrado" });
    }

    const doc = docResult.rows[0];
    const roles = collectRoles(req.user);
    const isAdmin = roles.has("admin") || roles.has("administrador");
    if (req.user.id !== doc.signer_user_id && req.user.id !== doc.locked_by && !isAdmin) {
      return res.status(403).json({ ok: false, message: "No autorizado para ver este historial" });
    }

    const auditResult = await db.query(
      `SELECT
         id,
         event_type,
         event_description,
         user_id,
         user_name,
         user_role,
         user_email,
         ip_address,
         user_agent,
         session_id,
         event_hash,
         previous_event_hash,
         event_data,
         event_timestamp,
         created_at
       FROM document_signature_logs
       WHERE document_id = $1
       ORDER BY event_timestamp ASC, id ASC`,
      [documentId]
    );

    return res.json({ ok: true, document_id: Number(documentId), audit_trail: auditResult.rows });
  } catch (err) {
    logger.error({ err }, "Error obteniendo audit trail");
    return res.status(500).json({ ok: false, message: "Error interno del servidor" });
  }
});

exports.getSignatureDashboard = asyncHandler(async (_req, res) => {
  try {
    const metricsResult = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE signature_status = 'SIGNED') AS signed_documents,
         COUNT(*) FILTER (WHERE is_locked = TRUE) AS locked_documents,
         COUNT(*) AS total_documents,
         AVG(EXTRACT(EPOCH FROM (locked_at - created_at)) / 3600) AS avg_signing_time_hours
       FROM documents
       WHERE signature_status IS NOT NULL`
    );

    const statusResult = await db.query(
      `SELECT signature_status, COUNT(*) AS count
       FROM documents
       WHERE signature_status IS NOT NULL
       GROUP BY signature_status
       ORDER BY signature_status`
    );

    const recentActivity = await db.query(
      `SELECT document_id, event_type, event_description, user_name, user_role, user_email, event_timestamp
       FROM document_signature_logs
       ORDER BY event_timestamp DESC, id DESC
       LIMIT 10`
    );

    const metrics = metricsResult.rows[0] || {};

    return res.json({
      ok: true,
      dashboard: {
        total_documents: parseInt(metrics.total_documents || 0, 10),
        signed_documents: parseInt(metrics.signed_documents || 0, 10),
        locked_documents: parseInt(metrics.locked_documents || 0, 10),
        avg_signing_time_hours: parseFloat(metrics.avg_signing_time_hours || 0),
        status_distribution: statusResult.rows,
        recent_activity: recentActivity.rows,
      },
    });
  } catch (err) {
    logger.error({ err }, "Error obteniendo dashboard");
    return res.status(500).json({ ok: false, message: "Error interno del servidor" });
  }
});
