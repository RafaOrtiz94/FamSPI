const crypto = require("crypto");
const db = require("../../config/db");
const logger = require("../../config/logger");

/**
 * Servicio: ImmutableSignatureLogger
 * ----------------------------------------------
 * Registra eventos encadenados mediante hash para garantizar
 * trazabilidad y evitar alteraciones (append-only). Cada nuevo evento
 * enlaza el hash previo cumpliendo con los principios de integridad y
 * rendición de cuentas exigidos por la LOPDP.
 */
class ImmutableSignatureLogger {
  /**
   * Inserta un evento encadenado.
   * @param {Object} params
   * @param {number} params.documentId
   * @param {string} params.eventType
   * @param {Object} params.eventPayload
   * @param {import('pg').PoolClient} [params.client]
   */
  async appendEvent({ documentId, eventType, eventPayload = {}, client }) {
    const pgClient = client || (await db.getClient());
    let shouldRelease = false;
    if (!client) {
      shouldRelease = true;
      await pgClient.query("BEGIN");
    }

    try {
      const payloadString = JSON.stringify({
        ...eventPayload,
        previous_event_hash: undefined,
      });

      const prevRes = await pgClient.query(
        `SELECT event_hash FROM document_signature_logs
         WHERE document_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [documentId]
      );
      const previousHash = prevRes.rows[0]?.event_hash || "";

      const eventHash = crypto
        .createHash("sha256")
        .update(previousHash + payloadString)
        .digest("hex");

      const insertPayload = {
        ...eventPayload,
        previous_event_hash: previousHash || null,
      };

      await pgClient.query(
        `INSERT INTO document_signature_logs (document_id, event_type, event_payload, event_hash)
         VALUES ($1, $2, $3, $4)`,
        [documentId, eventType, insertPayload, eventHash]
      );

      if (shouldRelease) await pgClient.query("COMMIT");
      return { event_hash: eventHash };
    } catch (error) {
      logger.error({ error }, "❌ Error registrando log inmutable");
      if (shouldRelease) await pgClient.query("ROLLBACK");
      throw error;
    } finally {
      if (shouldRelease) pgClient.release();
    }
  }
}

module.exports = new ImmutableSignatureLogger();
