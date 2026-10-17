const { requireRole: requireRoleStrict } = require("./roles");
const jwt = require("jsonwebtoken");
const logger = require("../config/logger");
const { isTokenRevoked } = require("../modules/attendance/attendanceShortcutTokens.repository");

const buildAuthRequestMeta = (req = {}) => ({
  method: req.method || null,
  path: req.originalUrl || req.url || null,
  appPath: req.headers?.["x-app-path"] || null,
  ip: req.headers?.["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || req.ip || null,
  userAgent: req.headers?.["user-agent"] || null,
  referer: req.headers?.referer || null,
});

const verifyToken = async (req, res, next) => {
  try {
    const headerAuth =
      req.headers["authorization"] ||
      req.headers["Authorization"] ||
      req.headers["x-access-token"];

    if (!headerAuth) {
      logger.warn({ ...buildAuthRequestMeta(req) }, "Acceso sin token");
      return res.status(401).json({ ok: false, code: "NO_TOKEN", message: "Token ausente" });
    }

    const token = headerAuth.startsWith("Bearer ") ? headerAuth.split(" ")[1] : headerAuth;

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.SECRET_KEY);
    } catch (err) {
      logger.warn(
        {
          ...buildAuthRequestMeta(req),
          reason: err.message,
          tokenPreview: typeof token === "string" ? token.slice(0, 12) : null,
        },
        "Token invalido o expirado"
      );
      return res.status(401).json({ ok: false, code: "INVALID_TOKEN", message: "Token invalido o expirado" });
    }

    if (decoded.iss !== "spi-fam-backend" || decoded.aud !== "spi-fam-frontend" || !decoded.sub) {
      logger.warn(
        {
          ...buildAuthRequestMeta(req),
          decoded: {
            sub: decoded?.sub || null,
            iss: decoded?.iss || null,
            aud: decoded?.aud || null,
            email: decoded?.email || null,
          },
        },
        "Token con claims invalidos"
      );
      return res.status(403).json({ ok: false, code: "INVALID_CLAIMS", message: "Token no valido para esta aplicacion" });
    }

    // Tokens de Shortcuts (Siri) admiten revocación individual sin rotar
    // SECRET_KEY. Solo se consulta la tabla cuando el token trae ese origen.
    if (decoded.token_kind === "shortcut") {
      const revoked = await isTokenRevoked(decoded.jti).catch((err) => {
        logger.error({ err: err?.message }, "Error verificando revocacion de shortcut token");
        return false;
      });
      if (revoked) {
        return res.status(401).json({ ok: false, code: "TOKEN_REVOKED", message: "Token revocado" });
      }
    }

    req.user = {
      ...decoded,
      ip: req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || req.ip,
      userAgent: req.headers["user-agent"],
    };

    next();
  } catch (err) {
    logger.error("Error general en verifyToken: %o", err);
    return res.status(500).json({ ok: false, code: "SERVER_ERROR", message: "Error verificando autenticacion" });
  }
};

const requireRole = (roles = []) => requireRoleStrict(roles);

module.exports = {
  verifyToken,
  requireRole,
};
