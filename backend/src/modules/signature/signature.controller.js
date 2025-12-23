const rateLimit = require("express-rate-limit");
const QRCode = require("qrcode");
const crypto = require("crypto");
const { asyncHandler } = require("../../middlewares/asyncHandler");
const db = require("../../config/db");
const logger = require("../../config/logger");

// Constantes para mejorar mantenibilidad
const SIGNATURE_CONSTANTS = {
  ALGORITHMS: {
    SHA256: 'sha256',
    DISPLAY_NAME: 'SHA-256'
  },
  TYPES: {
    ADVANCED: 'ADVANCED',
    QUALIFIED: 'QUALIFIED'
  },
  AUTH_METHODS: {
    OAUTH_CORPORATE: 'OAUTH_CORPORATE',
    CERTIFICATE: 'CERTIFICATE',
    BIOMETRIC: 'BIOMETRIC'
  },
  STATUS: {
    PENDING: 'PENDING',
    SIGNED: 'SIGNED',
    LOCKED: 'LOCKED',
    VERIFIED: 'VERIFIED',
    CORRUPTED: 'CORRUPTED'
  },
  VALIDATION: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  }
};

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

/**
 * Funciones helper para mejorar legibilidad y separación de responsabilidades
 */
const validateSignatureRequest = (body) => {
  const { document_base64, consent } = body || {};

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
};

const calculateDocumentHash = async (client, documentId, documentBuffer, userId) => {
  const hashValue = crypto.createHash(SIGNATURE_CONSTANTS.ALGORITHMS.SHA256)
    .update(documentBuffer)
    .digest("hex");

  const hashResult = await client.query(`
    INSERT INTO document_hashes (document_id, hash_sha256, calculated_by, calculated_at)
    VALUES ($1, $2, $3, NOW())
    RETURNING id
  `, [documentId, hashValue, userId]);

  return { hashId: hashResult.rows[0].id, hashValue };
};

const updateDocumentWithHash = async (client, documentId, hashId) => {
  await client.query(`
    UPDATE documents
    SET current_hash_id = $1, signature_status = $2
    WHERE id = $3
  `, [hashId, SIGNATURE_CONSTANTS.STATUS.PENDING, documentId]);
};

const createAdvancedSignature = async (client, signatureData) => {
  const {
    documentId, userId, userName, roleAtSign, userRole,
    consentText, clientIp, userAgent, sessionId
  } = signatureData;

  const result = await client.query(`
    INSERT INTO document_signatures_advanced (
      document_id, signer_user_id, signer_name, signer_role,
      signature_type, auth_method, consent_text, ip_address,
      user_agent, session_id, signed_at, is_valid
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), true)
    RETURNING id
  `, [
    documentId, userId, userName, roleAtSign || userRole,
    SIGNATURE_CONSTANTS.TYPES.ADVANCED,
    SIGNATURE_CONSTANTS.AUTH_METHODS.OAUTH_CORPORATE,
    consentText, clientIp, userAgent, sessionId
  ]);

  return result.rows[0].id;
};

const createSealAndQR = async (client, documentId, authorizedRole, userRole, userId) => {
  const sealResult = await client.query(`
    SELECT * FROM create_document_seal_and_qr($1, $2, $3)
  `, [documentId, authorizedRole || userRole, userId]);

  return {
    sealId: sealResult.rows[0].seal_id,
    qrId: sealResult.rows[0].qr_id
  };
};

const getSealAndQRInfo = async (client, sealId) => {
  const result = await client.query(`
    SELECT ds.*, dqc.qr_url, dqc.verification_token
    FROM document_seals ds
    JOIN document_qr_codes dqc ON dqc.seal_id = ds.id
    WHERE ds.id = $1
  `, [sealId]);

  return result.rows[0];
};

const generateQRCode = async (verificationToken) => {
  const verificationUrl = `${process.env.PUBLIC_BASE_URL || "https://spi.famproject.app"}/verificar/${verificationToken}`;
  const qrImage = await QRCode.toDataURL(verificationUrl);
  return { verificationUrl, qrImage };
};

const lockDocument = async (client, documentId, userId) => {
  await client.query(`
    UPDATE documents
    SET is_locked = true, locked_at = NOW(), locked_by = $1, signature_status = $2
    WHERE id = $3
  `, [userId, SIGNATURE_CONSTANTS.STATUS.SIGNED, documentId]);
};

/**
 * POST /api/documents/:documentId/sign
 * Firma avanzada completa con sello institucional y QR
 */
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

  // Validar solicitud
  validateSignatureRequest(req.body);

  const documentBuffer = toBufferFromBase64(documentBase64);
  const sessionId = sessionIdHeader || req.headers["x-session-id"];
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
  const userAgent = req.headers["user-agent"];

  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // 1. Calcular y almacenar hash del documento
    const { hashId, hashValue } = await calculateDocumentHash(client, documentId, documentBuffer, req.user.id);
    await updateDocumentWithHash(client, documentId, hashId);

    // 2. Crear firma avanzada
    const signatureId = await createAdvancedSignature(client, {
      documentId,
      userId: req.user.id,
      userName: req.user.name,
      roleAtSign,
      userRole: req.user.role,
      consentText,
      clientIp,
      userAgent,
      sessionId
    });

    // 3. Crear sello institucional y QR
    const { sealId, qrId } = await createSealAndQR(client, documentId, authorizedRole, req.user.role, req.user.id);

    // 4. Obtener información del sello y QR
    const sealInfo = await getSealAndQRInfo(client, sealId);

    // 5. Generar código QR
    const { verificationUrl, qrImage } = await generateQRCode(sealInfo.verification_token);

    // 6. Bloquear documento
    await lockDocument(client, documentId, req.user.id);

    await client.query("COMMIT");

    res.status(201).json({
      ok: true,
      message: "Firma avanzada aplicada y documento bloqueado",
      data: {
        document_id: documentId,
        hash: {
          id: hashId,
          value: hashValue,
          algorithm: SIGNATURE_CONSTANTS.ALGORITHMS.DISPLAY_NAME
        },
        signature: {
          id: signatureId,
          signed_at: new Date(),
          signer: req.user.name,
          role: roleAtSign || req.user.role
        },
        seal: {
          id: sealId,
          code: sealInfo.seal_code,
          issued_by: sealInfo.issued_by,
          authorized_role: sealInfo.authorized_role,
          verification_token: sealInfo.verification_token
        },
        qr: {
          id: qrId,
          url: verificationUrl,
          image: qrImage
        }
      }
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

/**
 * GET /api/verificar/:token
 * Verificación pública de documentos firmados
 */
exports.verifyDocument = [
  verificationLimiter,
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    try {
      // Buscar información de verificación
      const result = await db.query(`
        SELECT dvi.*,
               CASE WHEN dvi.chain_status = 'VERIFIED' THEN true ELSE false END as is_valid,
               dvi.recent_events
        FROM document_verification_info dvi
        WHERE dvi.qr_verification_token = $1 AND dvi.qr_active = true
      `, [token]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          ok: false,
          message: "Token de verificación no encontrado o expirado"
        });
      }

      const doc = result.rows[0];

      // Actualizar contador de accesos
      await db.query(`SELECT track_qr_access($1)`, [doc.qr_id]);

      res.json({
        ok: true,
        verification: {
          document_id: doc.document_id,
          signature_status: doc.signature_status,
          is_locked: doc.is_locked,
          is_valid: doc.is_valid,
          chain_status: doc.chain_status,

          hash: {
            value: doc.hash_sha256,
            algorithm: 'SHA-256',
            calculated_at: doc.hash_calculated_at
          },

          signature: {
            signed_at: doc.last_signed_at,
            signer_name: doc.last_signer_name,
            signer_role: doc.last_signer_role
          },

          seal: {
            code: doc.seal_code,
            issued_by: doc.seal_issued_by,
            authorized_role: doc.seal_authorized_role,
            issued_at: doc.seal_issued_at,
            is_active: doc.seal_active
          },

          qr: {
            verification_token: doc.qr_verification_token,
            access_count: doc.qr_access_count,
            last_accessed: doc.qr_last_accessed_at,
            is_active: doc.qr_active
          },

          recent_events: doc.recent_events
        }
      });

    } catch (err) {
      logger.error({ err }, "❌ Error en verificación de documento");
      res.status(500).json({ ok: false, message: "Error interno del servidor" });
    }
  })
];

/**
 * GET /api/documents/:documentId/audit-trail
 * Consulta el trail de auditoría completo de un documento
 */
exports.getDocumentAuditTrail = asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  try {
    // Verificar permisos (solo el firmante o administradores)
    const docResult = await db.query(`
      SELECT d.*, dsa.signer_user_id
      FROM documents d
      LEFT JOIN document_signatures_advanced dsa ON dsa.document_id = d.id
      WHERE d.id = $1
    `, [documentId]);

    if (docResult.rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Documento no encontrado" });
    }

    const doc = docResult.rows[0];

    // Verificar permisos
    if (req.user.id !== doc.signer_user_id && !req.user.roles?.includes('admin')) {
      return res.status(403).json({ ok: false, message: "No autorizado para ver este audit trail" });
    }

    // Obtener audit trail
    const auditResult = await db.query(`
      SELECT * FROM get_document_audit_trail($1)
    `, [documentId]);

    res.json({
      ok: true,
      document_id: documentId,
      audit_trail: auditResult.rows
    });

  } catch (err) {
    logger.error({ err }, "❌ Error obteniendo audit trail");
    res.status(500).json({ ok: false, message: "Error interno del servidor" });
  }
});

/**
 * GET /api/signature/dashboard
 * Dashboard de métricas de firmas
 */
exports.getSignatureDashboard = asyncHandler(async (req, res) => {
  try {
    // Obtener métricas generales
    const metricsResult = await db.query(`
      SELECT
        COUNT(CASE WHEN signature_status = 'SIGNED' THEN 1 END) as signed_documents,
        COUNT(CASE WHEN is_locked = true THEN 1 END) as locked_documents,
        COUNT(*) as total_documents,
        AVG(EXTRACT(EPOCH FROM (locked_at - created_at))/3600) as avg_signing_time_hours
      FROM documents
      WHERE signature_status IS NOT NULL
    `);

    const metrics = metricsResult.rows[0];

    // Obtener distribución por estados
    const statusResult = await db.query(`
      SELECT signature_status, COUNT(*) as count
      FROM documents
      WHERE signature_status IS NOT NULL
      GROUP BY signature_status
    `);

    // Obtener actividad reciente
    const recentActivity = await db.query(`
      SELECT dsl.event_type, dsl.user_name, dsl.event_timestamp, d.id as document_id
      FROM document_signature_logs dsl
      JOIN documents d ON d.id = dsl.document_id
      ORDER BY dsl.event_timestamp DESC
      LIMIT 10
    `);

    res.json({
      ok: true,
      dashboard: {
        total_documents: parseInt(metrics.total_documents) || 0,
        signed_documents: parseInt(metrics.signed_documents) || 0,
        locked_documents: parseInt(metrics.locked_documents) || 0,
        avg_signing_time_hours: parseFloat(metrics.avg_signing_time_hours) || 0,
        status_distribution: statusResult.rows,
        recent_activity: recentActivity.rows
      }
    });

  } catch (err) {
    logger.error({ err }, "❌ Error obteniendo dashboard");
    res.status(500).json({ ok: false, message: "Error interno del servidor" });
  }
});
