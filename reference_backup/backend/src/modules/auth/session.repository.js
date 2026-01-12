const db = require("../../config/db");
const logger = require("../../config/logger");

/**
 * Inserta una sesión y devuelve el registro creado.
 */
async function createSession({ email, ip, userAgent, refreshToken }) {
  const { rows } = await db.query(
    `
    INSERT INTO user_sessions (user_email, ip, user_agent, refresh_token, login_time)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING id, user_email, login_time;
    `,
    [email, ip, userAgent, refreshToken]
  );

  const session = rows[0];
  logger.info("[AUTH] Sesión registrada", {
    sessionId: session?.id,
    email,
    ip,
    userAgent,
  });
  return session;
}

/**
 * Actualiza el refresh_token de una sesión activa concreta.
 * Retorna el número de filas afectadas.
 */
async function updateSessionRefreshToken({ email, previousToken, newToken }) {
  const { rowCount } = await db.query(
    `
    UPDATE user_sessions
    SET refresh_token = $1
    WHERE user_email = $2
      AND refresh_token = $3
      AND logout_time IS NULL
    `,
    [newToken, email, previousToken]
  );

  if (!rowCount) {
    logger.warn("[AUTH] No se encontró la sesión a refrescar", {
      email,
      previousTokenFragment: previousToken?.slice(0, 8),
    });
  }
  return rowCount;
}

/**
 * Marca como cerradas todas las sesiones activas de un usuario.
 */
async function closeSessionsByEmail(email) {
  const { rowCount } = await db.query(
    `
    UPDATE user_sessions
    SET logout_time = NOW()
    WHERE user_email = $1 AND logout_time IS NULL
    `,
    [email]
  );
  logger.info("[AUTH] Sesiones cerradas", { email, count: rowCount });
  return rowCount;
}

/**
 * Marca como cerrada una sesión por refresh token (para múltiples dispositivos).
 */
async function closeSessionByRefreshToken(refreshToken) {
  if (!refreshToken) return 0;
  const { rowCount } = await db.query(
    `
    UPDATE user_sessions
    SET logout_time = NOW()
    WHERE refresh_token = $1 AND logout_time IS NULL
    `,
    [refreshToken]
  );
  if (rowCount) {
    logger.info("[AUTH] Sesión cerrada por refresh token", {
      refreshTokenFragment: refreshToken.slice(0, 8),
      count: rowCount,
    });
  }
  return rowCount;
}

module.exports = {
  createSession,
  updateSessionRefreshToken,
  closeSessionsByEmail,
  closeSessionByRefreshToken,
};
