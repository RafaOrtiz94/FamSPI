const crypto = require("crypto");
const logger = require("../config/logger");

/**
 * Middleware para autenticar imports de postulantes
 * Requiere header x-api-key con APPLICANTS_API_KEY
 */
module.exports = (req, res, next) => {
  const expectedKey = String(process.env.APPLICANTS_API_KEY || "").trim();

  if (!expectedKey) {
    logger.error("APPLICANTS_API_KEY no configurado");
    return res.status(500).json({
      ok: false,
      message: "API key no configurada",
    });
  }

  const provided = String(req.headers["x-api-key"] || "").trim();
  if (!provided) {
    logger.warn("Intento no autorizado en import de postulantes", {
      path: req.path,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });
    return res.status(401).json({
      ok: false,
      message: "Unauthorized",
    });
  }

  const expectedBuffer = Buffer.from(String(expectedKey));
  const providedBuffer = Buffer.from(String(provided));
  const valid =
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  if (valid) {
    return next();
  }

  logger.warn("Intento no autorizado en import de postulantes", {
    path: req.path,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  return res.status(401).json({
    ok: false,
    message: "Unauthorized",
  });
};
