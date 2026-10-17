/**
 * src/middlewares/loggerMiddleware.js
 * -------------------------------------------------
 * 📜 Middleware global para registrar cada request HTTP
 * - Compatible con logger Pino / Winston configurado en config/logger.js
 * - Muestra trazabilidad completa: usuario, IP, método, ruta, status y duración
 */

const logger = require("../config/logger");

const mLogger = (req, res, next) => {
  const start = Date.now();

  // Al finalizar la respuesta
  res.on("finish", () => {
    const duration = Date.now() - start;

    // Si hay usuario autenticado en el request (inyectado por verifyToken)
    const userEmail = req.user?.email || "anon";

    const logData = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.headers["x-forwarded-for"],
      user: userEmail,
      status: res.statusCode,
      ms: duration,
    };

    // Formato de mensaje legible
    const message = `${req.method} ${req.originalUrl} [${res.statusCode}] ${duration}ms - ${userEmail}`;

    logger.http(message, logData);
    if (res.statusCode >= 500) {
      logger.error(logData, message);
    } else if (res.statusCode >= 400) {
      logger.warn(logData, message);
    }
  });

  next();
};

module.exports = mLogger;
