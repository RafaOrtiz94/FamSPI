const crypto = require("crypto");
const db = require("../../config/db");
const logger = require("../../config/logger");
const immutableLogger = require("./immutableSignatureLogger.service");

/**
 * Servicio: AdvancedSignatureService
 * ----------------------------------------------
 * Gestiona la firma electrónica avanzada sin certificados externos.
 * Valida identidad (OAuth corporativo), voluntad (consentimiento expreso)
 * y genera una huella criptográfica del acto de firma.
 */
class AdvancedSignatureService {
  /**
   * Ejecuta la firma avanzada para una versión de documento.
   * @param {Object} params
   * @param {Object} params.documentHash
   * @param {Object} params.user
   * @param {string} params.consentText
   * @param {string} params.roleAtSign
   * @param {string} params.ip
   * @param {string} params.userAgent
   * @param {string} params.sessionId
   * @param {import('pg').PoolClient} params.client
   */
  async signDocument({
    documentHash,
    user,
    consentText,
    roleAtSign,
    ip,
    userAgent,
    sessionId,
    client,
  }) {
    if (!user?.id) {
      const err = new Error("Usuario no autenticado");
      err.status = 401;
      throw err;
    }

    if (!consentText || typeof consentText !== "string" || consentText.trim().length === 0) {
      const err = new Error("Se requiere manifestación expresa de consentimiento");
      err.status = 400;
      throw err;
    }

    if (!sessionId) {
      const err = new Error("session_id requerido para trazabilidad");
      err.status = 400;
      throw err;
    }

    const pgClient = client || (await db.getClient());
    let shouldRelease = false;
    if (!client) {
      shouldRelease = true;
      await pgClient.query("BEGIN");
    }

    try {
      const docRes = await pgClient.query(`SELECT * FROM documents WHERE id=$1`, [documentHash.document_id]);
      const document = docRes.rows[0];
      if (!document) {
        const err = new Error("Documento no encontrado");
        err.status = 404;
        throw err;
      }

      const lockedFlag =
        ("locked" in document && document.locked === true) ||
        ("signed" in document && document.signed === true);
      if (lockedFlag) {
        const err = new Error("Documento bloqueado para nuevas firmas");
        err.status = 409;
        throw err;
      }

      const existingSig = await pgClient.query(
        `SELECT id FROM document_signatures_advanced
         WHERE document_id = $1 AND document_hash_id = $2
         LIMIT 1`,
        [document.id, documentHash.id]
      );
      if (existingSig.rows.length) {
        const err = new Error("Ya existe una firma avanzada para esta versión");
        err.status = 409;
        throw err;
      }

      const signedAt = new Date();
      const signatureHash = crypto
        .createHash("sha256")
        .update(`${documentHash.hash_value}${user.id}${signedAt.toISOString()}${sessionId}`)
        .digest("hex");

      const insertRes = await pgClient.query(
        `INSERT INTO document_signatures_advanced (
          document_id,
          document_hash_id,
          signer_user_id,
          role_at_sign,
          consent_text,
          ip_address,
          user_agent,
          session_id,
          signed_at,
          signature_hash
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *`,
        [
          document.id,
          documentHash.id,
          user.id,
          roleAtSign || user.role || null,
          consentText.trim(),
          ip || null,
          userAgent || null,
          sessionId,
          signedAt,
          signatureHash,
        ]
      );

      await immutableLogger.appendEvent({
        client: pgClient,
        documentId: document.id,
        eventType: "DOCUMENT_SIGNED",
        eventPayload: {
          signer_user_id: user.id,
          role_at_sign: roleAtSign || user.role || null,
          consent_text: consentText.trim(),
          document_hash_id: documentHash.id,
          signed_at: signedAt.toISOString(),
          signature_hash: signatureHash,
        },
      });

      // Bloquear documento para impedir re-firmas; se usa signed o locked según disponibilidad
      if ("locked" in document) {
        await pgClient.query(`UPDATE documents SET locked = TRUE, updated_at = now() WHERE id = $1`, [
          document.id,
        ]);
      } else if ("signed" in document) {
        await pgClient.query(`UPDATE documents SET signed = TRUE, updated_at = now() WHERE id = $1`, [
          document.id,
        ]);
      }

      await immutableLogger.appendEvent({
        client: pgClient,
        documentId: document.id,
        eventType: "DOCUMENT_LOCKED",
        eventPayload: {
          locked_by: user.id,
          reason: "advanced_signature",
          document_hash_id: documentHash.id,
        },
      });

      if (shouldRelease) await pgClient.query("COMMIT");
      return insertRes.rows[0];
    } catch (error) {
      if (shouldRelease) await pgClient.query("ROLLBACK");
      logger.error({ error }, "❌ Error en firma avanzada");
      throw error;
    } finally {
      if (shouldRelease) pgClient.release();
    }
  }
}

module.exports = new AdvancedSignatureService();
