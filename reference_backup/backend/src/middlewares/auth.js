/**
 * src/middlewares/auth.js
 * ----------------------------------------------------------
 * Middleware central de autenticación y autorización JWT
 * - Verifica token Bearer o X-Access-Token
 * - Adjunta usuario decodificado a req.user
 * - Permite validación por rol con jerarquía
 */

const jwt = require("jsonwebtoken");
const logger = require("../config/logger");

/* ============================================================
   🧱 Middleware: verifyToken
============================================================ */
const verifyToken = (req, res, next) => {
  try {
    const headerAuth =
      req.headers["authorization"] ||
      req.headers["Authorization"] ||
      req.headers["x-access-token"];

    if (!headerAuth) {
      logger.warn(`🚫 Acceso sin token desde ${req.ip}`);
      return res
        .status(401)
        .json({ ok: false, code: "NO_TOKEN", message: "Token ausente" });
    }

    const token = headerAuth.startsWith("Bearer ")
      ? headerAuth.split(" ")[1]
      : headerAuth;

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.SECRET_KEY);
    } catch (err) {
      logger.warn(`❌ Token inválido o expirado (${req.method} ${req.originalUrl}): ${err.message}`);
      return res
        .status(401)
        .json({ ok: false, code: "INVALID_TOKEN", message: "Token inválido o expirado" });
    }

    // Validación avanzada de claims
    if (
      decoded.iss !== "spi-fam-backend" ||
      decoded.aud !== "spi-fam-frontend" ||
      !decoded.sub
    ) {
      logger.warn(`⚠️ Token con claims inválidos: ${JSON.stringify(decoded)}`);
      return res
        .status(403)
        .json({ ok: false, code: "INVALID_CLAIMS", message: "Token no válido para esta aplicación" });
    }

    // Adjuntar información extendida al request
    req.user = {
      ...decoded,
      ip: req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || req.ip,
      userAgent: req.headers["user-agent"],
    };

    next();
  } catch (err) {
    logger.error("💥 Error general en verifyToken: %o", err);
    return res
      .status(500)
      .json({ ok: false, code: "SERVER_ERROR", message: "Error verificando autenticación" });
  }
};

/* ============================================================
   🧩 Middleware: requireRole(["admin", "ti", "gerencia"])
============================================================ */
const requireRole = (roles = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ ok: false, code: "NO_AUTH", message: "Usuario no autenticado" });
      }

      const role = req.user.role?.toLowerCase();
      const allowed = roles.map((r) => r.toLowerCase());

      // Definir jerarquía: gerencia > ti > cualquier otro
      const hierarchy = ["gerencia", "ti", "admin", "usuario"];
      const roleIndex = hierarchy.indexOf(role);
      const allowedIndex = Math.min(
        ...allowed.map((r) => hierarchy.indexOf(r)).filter((i) => i >= 0)
      );

      const hasAccess =
        role === "gerencia" || // acceso total
        allowed.includes(role) ||
        (allowedIndex >= 0 && roleIndex <= allowedIndex);

      if (hasAccess) {
        return next();
      }

      logger.info(
        `🚫 Acceso denegado → ${req.user.email} (${role}) intentó acceder a ${req.originalUrl}`
      );
      return res
        .status(403)
        .json({ ok: false, code: "FORBIDDEN", message: "No tienes permisos suficientes" });
    } catch (err) {
      logger.error("❌ Error en requireRole: %o", err);
      return res
        .status(500)
        .json({ ok: false, code: "ROLE_ERROR", message: "Error verificando permisos" });
    }
  };
};

module.exports = {
  verifyToken,
  requireRole,
};
