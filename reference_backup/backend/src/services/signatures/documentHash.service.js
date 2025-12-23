const crypto = require("crypto");
const db = require("../../config/db");
const logger = require("../../config/logger");
const immutableLogger = require("./immutableSignatureLogger.service");

/**
 * Servicio: DocumentHashService
 * ----------------------------------------------
 * Calcula el hash SHA-256 de un documento (PDF/DOCX) y lo
 * guarda en la tabla document_hashes sin persistir archivos.
 * Este hash es la base legal de integridad exigida por la Ley de
 * Comercio Electrónico de Ecuador: garantiza que el documento
 * no ha sido alterado desde el consentimiento del firmante.
 */
class DocumentHashService {
  /**
   * Calcula y almacena el hash actual para una versión de documento.
   * @param {Object} params
   * @param {number|string} params.documentId
   * @param {Buffer} params.documentBuffer
   * @param {number} [params.version]
   * @param {number} params.userId
   * @param {import('pg').PoolClient} params.client
   */
  async createHash({ documentId, documentBuffer, version, userId, client }) {
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
      const docRes = await pgClient.query(`SELECT * FROM documents WHERE id=$1`, [documentId]);
      const document = docRes.rows[0];
      if (!document) {
        const err = new Error("Documento no encontrado");
        err.status = 404;
        throw err;
      }

      const docVersion = version || document.version || document.document_version || 1;

      await pgClient.query(
        `UPDATE document_hashes
         SET is_current = FALSE
         WHERE document_id = $1 AND document_version = $2 AND is_current = TRUE`,
        [document.id, docVersion]
      );

      const insertRes = await pgClient.query(
        `INSERT INTO document_hashes (
          document_id,
          document_version,
          hash_value,
          algorithm,
          is_current,
          created_by
        ) VALUES ($1, $2, $3, 'SHA-256', TRUE, $4)
        RETURNING *`,
        [document.id, docVersion, hash, userId || null]
      );

      const hashRecord = insertRes.rows[0];

      await immutableLogger.appendEvent({
        client: pgClient,
        documentId: document.id,
        eventType: "HASH_CREATED",
        eventPayload: {
          hash_value: hash,
          algorithm: "SHA-256",
          document_version: docVersion,
          created_by: userId || null,
        },
      });

      if (shouldRelease) await pgClient.query("COMMIT");

      return hashRecord;
    } catch (error) {
      logger.error({ error }, "❌ Error creando hash de documento");
      if (shouldRelease) await pgClient.query("ROLLBACK");
      throw error;
    } finally {
      if (shouldRelease) pgClient.release();
    }
  }
}

module.exports = new DocumentHashService();
