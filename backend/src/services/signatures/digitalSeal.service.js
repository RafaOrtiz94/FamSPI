const { v4: uuidv4 } = require("uuid");
const db = require("../../config/db");
const logger = require("../../config/logger");
const immutableLogger = require("./immutableSignatureLogger.service");

/**
 * Servicio: DigitalSealService
 * ----------------------------------------------
 * Aplica sello institucional (no personal) posterior a la firma
 * avanzada. Cumple la función de sellado corporativo exigida para
 * representación institucional y facilita la verificación vía token QR.
 */
class DigitalSealService {
  /**
   * @param {Object} params
   * @param {Object} params.documentHash
   * @param {string} params.authorizedRole
   * @param {import('pg').PoolClient} params.client
   */
  async applySeal({ documentHash, authorizedRole, client }) {
    const pgClient = client || (await db.getClient());
    let shouldRelease = false;
    if (!client) {
      shouldRelease = true;
      await pgClient.query("BEGIN");
    }

    try {
      if (!authorizedRole) {
        const err = new Error("Rol institucional requerido para el sello digital");
        err.status = 400;
        throw err;
      }

      const existingSeal = await pgClient.query(
        `SELECT id FROM document_seals WHERE document_hash_id = $1 AND active = TRUE LIMIT 1`,
        [documentHash.id]
      );
      if (existingSeal.rows.length) {
        const err = new Error("Ya existe un sello activo para esta versión");
        err.status = 409;
        throw err;
      }

      const year = new Date().getFullYear();
      const sequence = Math.floor(Math.random() * 9000 + 1000);
      const sealCode = `SPI-${year}-ADV-${sequence}`;
      const verificationToken = uuidv4();

      const insertRes = await pgClient.query(
        `INSERT INTO document_seals (
          document_hash_id,
          seal_code,
          authorized_role,
          verification_token,
          active
        ) VALUES ($1,$2,$3,$4,TRUE)
        RETURNING *`,
        [documentHash.id, sealCode, authorizedRole, verificationToken]
      );

      await immutableLogger.appendEvent({
        client: pgClient,
        documentId: documentHash.document_id,
        eventType: "SEAL_APPLIED",
        eventPayload: {
          document_hash_id: documentHash.id,
          seal_code: sealCode,
          authorized_role: authorizedRole,
        },
      });

      if (shouldRelease) await pgClient.query("COMMIT");
      return insertRes.rows[0];
    } catch (error) {
      if (shouldRelease) await pgClient.query("ROLLBACK");
      logger.error({ error }, "❌ Error aplicando sello digital");
      throw error;
    } finally {
      if (shouldRelease) pgClient.release();
    }
  }
}

module.exports = new DigitalSealService();
