const crypto = require("crypto");
const db = require("../../config/db");
const logger = require("../../config/logger");
const immutableLogger = require("./immutableSignatureLogger.service");

class DocumentHashService {
  async createHash({ documentId, documentBuffer, userId, client }) {
    if (!Buffer.isBuffer(documentBuffer)) {
      const err = new Error("Se requiere el buffer binario del documento para hashear");
      err.status = 400;
      throw err;
    }

    const hash = crypto.createHash("sha256").update(documentBuffer).digest("hex");
    const pgClient = client || (await db.getClient());
    let shouldRelease = false;

    if (!client) {
      shouldRelease = true;
      await pgClient.query("BEGIN");
    }

    try {
      const docRes = await pgClient.query(`SELECT * FROM documents WHERE id = $1`, [documentId]);
      const document = docRes.rows[0];
      if (!document) {
        const err = new Error("Documento no encontrado");
        err.status = 404;
        throw err;
      }

      await pgClient.query(
        `UPDATE document_hashes
         SET is_current = FALSE
         WHERE document_id = $1 AND is_current = TRUE`,
        [document.id]
      );

      const insertRes = await pgClient.query(
        `INSERT INTO document_hashes (
          document_id,
          document_type,
          hash_sha256,
          hash_algorithm,
          calculated_at,
          calculated_by,
          is_current
        ) VALUES ($1, $2, $3, 'SHA-256', NOW(), $4, TRUE)
        RETURNING *`,
        [document.id, document.request_type_id || null, hash, userId || null]
      );

      const hashRecord = insertRes.rows[0];

      await immutableLogger.appendEvent({
        client: pgClient,
        documentId: document.id,
        eventType: "HASH_CREATED",
        eventPayload: {
          hash_sha256: hash,
          hash_algorithm: "SHA-256",
          calculated_by: userId || null,
        },
      });

      if (shouldRelease) await pgClient.query("COMMIT");
      return hashRecord;
    } catch (error) {
      logger.error({ error }, "Error creando hash de documento");
      if (shouldRelease) await pgClient.query("ROLLBACK");
      throw error;
    } finally {
      if (shouldRelease) pgClient.release();
    }
  }
}

module.exports = new DocumentHashService();
