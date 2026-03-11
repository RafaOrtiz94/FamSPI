const crypto = require("crypto");
const db = require("../../config/db");
const logger = require("../../config/logger");
const immutableLogger = require("./immutableSignatureLogger.service");

class AdvancedSignatureService {
  async signDocument({ documentHash, user, roleAtSign, ip, userAgent, sessionId, client }) {
    if (!user?.id) {
      const err = new Error("Usuario no autenticado");
      err.status = 401;
      throw err;
    }

    if (!user?.email) {
      const err = new Error("El usuario autenticado no tiene email para registrar la firma");
      err.status = 422;
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
      const docRes = await pgClient.query(`SELECT * FROM documents WHERE id = $1`, [documentHash.document_id]);
      const document = docRes.rows[0];
      if (!document) {
        const err = new Error("Documento no encontrado");
        err.status = 404;
        throw err;
      }

      const lockedFlag = document.is_locked === true || document.signed === true;
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
        const err = new Error("Ya existe una firma avanzada para esta version");
        err.status = 409;
        throw err;
      }

      const signedAt = new Date();
      const signatureHash = crypto
        .createHash("sha256")
        .update(`${documentHash.hash_sha256}${user.id}${signedAt.toISOString()}${sessionId}`)
        .digest("hex");

      const insertRes = await pgClient.query(
        `INSERT INTO document_signatures_advanced (
          document_id,
          document_hash_id,
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
          signature_hash,
          is_valid
        ) VALUES ($1,$2,$3,$4,'ADVANCED',$5,$6,$7,$8,$9,$10,$11,'OAUTH_CORPORATE',$12,TRUE)
        RETURNING *`,
        [
          document.id,
          documentHash.id,
          user.id,
          roleAtSign || user.role || null,
          user.fullname || user.name || user.email,
          user.email,
          user.department || null,
          signedAt,
          ip || null,
          userAgent || null,
          sessionId,
          signatureHash,
        ]
      );

      await immutableLogger.appendEvent({
        client: pgClient,
        documentId: document.id,
        eventType: "DOCUMENT_SIGNED",
        eventPayload: {
          signer_user_id: user.id,
          signer_role: roleAtSign || user.role || null,
          signer_email: user.email,
          document_hash_id: documentHash.id,
          signed_at: signedAt.toISOString(),
          signature_hash: signatureHash,
        },
      });

      await pgClient.query(
        `UPDATE documents
         SET is_locked = TRUE,
             signed = TRUE,
             locked_at = NOW(),
             locked_by = $2,
             signature_status = 'SIGNED',
             updated_at = NOW()
         WHERE id = $1`,
        [document.id, user.id]
      );

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
      logger.error({ error }, "Error en firma avanzada");
      throw error;
    } finally {
      if (shouldRelease) pgClient.release();
    }
  }
}

module.exports = new AdvancedSignatureService();
