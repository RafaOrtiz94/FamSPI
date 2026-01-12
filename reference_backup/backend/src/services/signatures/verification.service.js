const crypto = require("crypto");
const db = require("../../config/db");

/**
 * Servicio: VerificationService
 * ----------------------------------------------
 * Endpoint público de verificación. No expone datos sensibles y
 * recalcula el hash recibido para validar integridad.
 */
class VerificationService {
  /**
   * Verifica token de sello y opcionalmente contrasta hash con archivo.
   * @param {Object} params
   * @param {string} params.token
   * @param {Buffer|null} params.documentBuffer
   */
  async verify({ token, documentBuffer }) {
    const sealRes = await db.query(
      `SELECT ds.*, dh.hash_value, dh.document_id, dh.document_version, dh.algorithm
       FROM document_seals ds
       JOIN document_hashes dh ON dh.id = ds.document_hash_id
       WHERE ds.verification_token = $1 AND ds.active = TRUE`,
      [token]
    );

    const seal = sealRes.rows[0];
    if (!seal) {
      const err = new Error("Token de verificación inválido o inactivo");
      err.status = 404;
      throw err;
    }

    const signatureRes = await db.query(
      `SELECT signer_user_id, role_at_sign, signed_at, signature_hash
       FROM document_signatures_advanced
       WHERE document_hash_id = $1`,
      [seal.document_hash_id]
    );

    const signature = signatureRes.rows[0] || null;
    let recalculatedHash = null;
    let integrity = "INVALID";

    if (documentBuffer) {
      recalculatedHash = crypto.createHash("sha256").update(documentBuffer).digest("hex");
      integrity = recalculatedHash === seal.hash_value ? "VALID" : "INVALID";
    } else {
      // Sin buffer no podemos certificar integridad, mantenemos resultado conservador
      integrity = "INVALID";
    }

    return {
      token,
      integrity,
      seal: {
        code: seal.seal_code,
        authorized_role: seal.authorized_role,
      },
      document: {
        id: seal.document_id,
        version: seal.document_version,
        hash: seal.hash_value,
        algorithm: seal.algorithm,
      },
      signature: signature
        ? {
            signed_at: signature.signed_at,
            role_at_sign: signature.role_at_sign,
            signature_hash: signature.signature_hash,
          }
        : null,
      recalculated_hash: recalculatedHash,
    };
  }
}

module.exports = new VerificationService();
