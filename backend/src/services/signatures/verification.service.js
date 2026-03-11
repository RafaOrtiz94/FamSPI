const crypto = require("crypto");
const db = require("../../config/db");

class VerificationService {
  async verify({ token, documentBuffer }) {
    const verificationRes = await db.query(
      `SELECT *
       FROM document_verification_info
       WHERE verification_token = $1 AND qr_active = TRUE`,
      [token]
    );

    const verification = verificationRes.rows[0];
    if (!verification) {
      const err = new Error("Token de verificacion invalido o inactivo");
      err.status = 404;
      throw err;
    }

    let recalculatedHash = null;
    let integrity = "UNKNOWN";

    if (documentBuffer) {
      recalculatedHash = crypto.createHash("sha256").update(documentBuffer).digest("hex");
      integrity = recalculatedHash === verification.hash_sha256 ? "VALID" : "INVALID";
    }

    return {
      token,
      integrity,
      seal: {
        code: verification.seal_code,
        authorized_role: verification.authorized_role,
        issued_by: verification.issued_by,
        issued_at: verification.issued_at,
        is_active: verification.seal_active,
      },
      document: {
        id: verification.document_id,
        hash: verification.hash_sha256,
        algorithm: "SHA-256",
        signature_status: verification.signature_status,
        is_locked: verification.is_locked,
      },
      signature: verification.last_signed_at
        ? {
            signed_at: verification.last_signed_at,
            signer_name: verification.last_signer_name,
            signer_role: verification.last_signer_role,
          }
        : null,
      qr: {
        verification_token: verification.verification_token,
        access_count: verification.access_count,
        last_accessed_at: verification.last_accessed_at,
        is_active: verification.qr_active,
      },
      recalculated_hash: recalculatedHash,
    };
  }
}

module.exports = new VerificationService();
