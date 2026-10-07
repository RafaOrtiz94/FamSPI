/**
 * src/modules/attendance/attendanceShortcutTokens.repository.js
 * ----------------------------------------------------------------
 * Registro de tokens de Shortcut (Siri) para permitir revocación
 * individual sin rotar SECRET_KEY globalmente. Ver migración 246.
 */

const db = require("../../config/db");
const logger = require("../../config/logger");

async function recordIssuedToken({ jti, userId, issuedBy, expiresAt }) {
  await db.query(
    `INSERT INTO attendance_shortcut_tokens (jti, user_id, issued_by, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [jti, userId, issuedBy || null, expiresAt]
  );
}

// El Atajo de ubicacion llama cada pocos minutos desde cada iPhone: sin esta
// memoria cada llamada consultaria la base y la mantendria despierta. Una
// revocacion tarda como maximo REVOCATION_CACHE_TTL_MS en aplicarse en otras
// instancias; en la instancia que revoca es inmediata (revokeTokenById).
const REVOCATION_CACHE_TTL_MS = 5 * 60 * 1000;
const revocationCache = new Map(); // jti -> { revoked, checkedAt }

async function isTokenRevoked(jti) {
  if (!jti) return false;
  const cached = revocationCache.get(jti);
  // Revocado no se revierte: se recuerda sin vencimiento.
  if (cached && (cached.revoked || Date.now() - cached.checkedAt < REVOCATION_CACHE_TTL_MS)) {
    return cached.revoked;
  }
  const { rows } = await db.query(
    `SELECT revoked_at FROM attendance_shortcut_tokens WHERE jti = $1 LIMIT 1`,
    [jti]
  );
  // Fila ausente (tokens emitidos antes de esta migración) = no revocado.
  const revoked = Boolean(rows[0]?.revoked_at);
  revocationCache.set(jti, { revoked, checkedAt: Date.now() });
  return revoked;
}

async function listTokensForUser(userId) {
  const { rows } = await db.query(
    `SELECT id, issued_at, expires_at, revoked_at, issued_by, revoked_by
       FROM attendance_shortcut_tokens
      WHERE user_id = $1
      ORDER BY issued_at DESC`,
    [userId]
  );
  return rows;
}

async function revokeTokenById({ id, revokedBy }) {
  const { rows } = await db.query(
    `UPDATE attendance_shortcut_tokens
        SET revoked_at = NOW(), revoked_by = $2
      WHERE id = $1 AND revoked_at IS NULL
      RETURNING id, user_id, jti`,
    [id, revokedBy || null]
  );
  const row = rows[0] || null;
  if (row) {
    if (row.jti) revocationCache.set(row.jti, { revoked: true, checkedAt: Date.now() });
    logger.info({ tokenId: id, userId: row.user_id, revokedBy }, "[ATTENDANCE][SHORTCUT] Token revocado");
  }
  return row;
}

module.exports = {
  recordIssuedToken,
  isTokenRevoked,
  listTokensForUser,
  revokeTokenById,
  REVOCATION_CACHE_TTL_MS,
  __resetRevocationCacheForTests: () => revocationCache.clear(),
};
