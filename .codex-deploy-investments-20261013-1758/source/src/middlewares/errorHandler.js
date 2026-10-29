/**
 * Middleware global de manejo de errores
 * --------------------------------------
 * - Captura errores de rutas asincrónicas
 * - Registra el error en logger y responde con JSON uniforme
 */

const logger = require("../config/logger");

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const message = err.message || "Error interno del servidor";

  logger.error({
    msg: "UnhandledError",
    status,
    path: req.originalUrl,
    method: req.method,
    user: req.user?.email || "anon",
    stack: err.stack
  });

  return res.status(status).json({
    ok: false,
    error: message,
    code: err.code || undefined
  });
}

module.exports = { errorHandler };
