const { OAuth2Client } = require("google-auth-library");
const db = require("../../config/db");

const verifier = new OAuth2Client();

function sendAuthError(res, status, code, message) {
  return res.status(status).json({ ok: false, code, message });
}

// El audience no se infiere: lo asigna Google al proyecto del Add-on y se
// configura en Cloud Run. Sin ese valor el canal permanece cerrado.
async function verifyAddonIdentity(req, res, next) {
  const audience = String(process.env.GMAIL_CONTEXT_ADDON_AUDIENCE || "").trim();
  if (!audience) {
    return sendAuthError(res, 503, "GMAIL_CONTEXT_ADDON_NOT_CONFIGURED", "La identidad del Add-on aun no esta configurada.");
  }

  const authorization = String(req.headers.authorization || "");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    return sendAuthError(res, 401, "GMAIL_CONTEXT_ADDON_TOKEN_MISSING", "Token de identidad del Add-on ausente.");
  }

  try {
    const ticket = await verifier.verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload() || {};
    const email = String(payload.email || "").trim().toLowerCase();
    if (!email || payload.email_verified !== true) {
      return sendAuthError(res, 403, "GMAIL_CONTEXT_ADDON_IDENTITY_INVALID", "La identidad Google no incluye un correo verificado.");
    }

    const { rows } = await db.query(
      `SELECT id, email, fullname, role, extra_roles
         FROM users
        WHERE lower(email) = lower($1)
          AND active = true
        LIMIT 1`,
      [email],
    );
    if (!rows[0]) {
      return sendAuthError(res, 403, "GMAIL_CONTEXT_ADDON_USER_NOT_FOUND", "El usuario Google no tiene una cuenta SPI activa.");
    }

    req.user = { ...rows[0], google_subject: payload.sub };
    return next();
  } catch (_error) {
    return sendAuthError(res, 401, "GMAIL_CONTEXT_ADDON_TOKEN_INVALID", "No se pudo verificar la identidad del Add-on.");
  }
}

module.exports = { verifyAddonIdentity };
