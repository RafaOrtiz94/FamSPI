const db = require("../../config/db");
const logger = require("../../config/logger");
const immutableLogger = require("./immutableSignatureLogger.service");
const { assertSignatureDependencies } = require("./signatureSchema.service");

class DigitalSealService {
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

      await assertSignatureDependencies(["sealGenerator"], { client: pgClient });

      const existingSeal = await pgClient.query(
        `SELECT id FROM document_seals WHERE document_hash_id = $1 AND is_active = TRUE LIMIT 1`,
        [documentHash.id]
      );
      if (existingSeal.rows.length) {
        const err = new Error("Ya existe un sello activo para esta version");
        err.status = 409;
        throw err;
      }

      const authorizedUserId = Number.isInteger(documentHash.calculated_by) ? documentHash.calculated_by : null;
      const sealResult = await pgClient.query(
        `SELECT * FROM create_document_seal_and_qr($1, $2, $3)`,
        [documentHash.document_id, authorizedRole, authorizedUserId]
      );

      const sealRow = sealResult.rows[0];
      if (!sealRow?.seal_id) {
        const err = new Error("No se pudo generar el sello institucional");
        err.status = 500;
        throw err;
      }

      const detailsResult = await pgClient.query(
        `SELECT ds.*, dqc.verification_token, dqc.qr_url, dqc.id AS qr_id
         FROM document_seals ds
         LEFT JOIN document_qr_codes dqc ON dqc.seal_id = ds.id
         WHERE ds.id = $1`,
        [sealRow.seal_id]
      );
      const seal = detailsResult.rows[0];

      await immutableLogger.appendEvent({
        client: pgClient,
        documentId: documentHash.document_id,
        eventType: "SEAL_APPLIED",
        eventPayload: {
          document_hash_id: documentHash.id,
          seal_id: sealRow.seal_id,
          qr_id: sealRow.qr_id || seal?.qr_id || null,
          authorized_role: authorizedRole,
          verification_token: seal?.verification_token || null,
        },
      });

      if (shouldRelease) await pgClient.query("COMMIT");
      return {
        ...seal,
        id: sealRow.seal_id,
        qr_id: sealRow.qr_id || seal?.qr_id || null,
      };
    } catch (error) {
      if (shouldRelease) await pgClient.query("ROLLBACK");
      logger.error({ error }, "Error aplicando sello digital");
      throw error;
    } finally {
      if (shouldRelease) pgClient.release();
    }
  }
}

module.exports = new DigitalSealService();
