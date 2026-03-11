const { requireRole: requireRoleStrict } = require("./roles");
const jwt = require("jsonwebtoken");
const logger = require("../config/logger");

const verifyToken = (req, res, next) => {
  try {
    const headerAuth =
      req.headers["authorization"] ||
      req.headers["Authorization"] ||
      req.headers["x-access-token"];

    if (!headerAuth) {
      logger.warn(`Acceso sin token desde ${req.ip}`);
      return res.status(401).json({ ok: false, code: "NO_TOKEN", message: "Token ausente" });
    }

    const token = headerAuth.startsWith("Bearer ") ? headerAuth.split(" ")[1] : headerAuth;

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.SECRET_KEY);
    } catch (err) {
      logger.warn(`Token invalido o expirado (${req.method} ${req.originalUrl}): ${err.message}`);
      return res.status(401).json({ ok: false, code: "INVALID_TOKEN", message: "Token invalido o expirado" });
    }

    if (decoded.iss !== "spi-fam-backend" || decoded.aud !== "spi-fam-frontend" || !decoded.sub) {
      logger.warn(`Token con claims invalidos: ${JSON.stringify(decoded)}`);
      return res.status(403).json({ ok: false, code: "INVALID_CLAIMS", message: "Token no valido para esta aplicacion" });
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
