/**
 * src/app.js
 * Configuracion central de Express para SPI.
 * - Seguridad con JWT por headers
 * - CORS dinamico
 * - Logging, auditoria y manejo global de errores
 * - Ajustes para Cloud Run
 */

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const logger = require("./config/logger");
const { helmetConfig, corsConfig, isProd } = require("./config/security");
const mLogger = require("./middlewares/loggerMiddleware");
const { auditMiddleware } = require("./middlewares/auditMiddleware");
const { normalizeApiPayloads, logLegacyUsageStats } = require("./middlewares/apiNormalization");
const { verifyToken } = require("./middlewares/auth");
const { moduleAccessGuard } = require("./middlewares/moduleAccess");
const { isPublicPath } = require("./routes/publicPaths");
const { mountPublicRoutes, mountPrivateRoutes } = require("./routes/registerRoutes");

const app = express();

app.disable("x-powered-by");
app.set("etag", false);
app.set("trust proxy", 1);

const RATE_LIMIT_WINDOW_MS =
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, 10) || 15 * 60 * 1000;
// Límite por ventana por usuario autenticado (o por IP si no autenticado).
// Default en prod: 3000 req/15min = 200 req/min por usuario — suficiente para
// polling intensivo en eventos como Kick Off sin sacrificar protección.
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || (isProd ? 3000 : 0), 10);
const DISABLE_RATE_LIMIT =
  process.env.DISABLE_RATE_LIMIT === "true" || (!isProd && RATE_LIMIT_MAX === 0);

const RATE_LIMIT_WHITELIST = new Set(
  (process.env.RATE_LIMIT_WHITELIST || "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean)
);

const shouldBypassRateLimit = (req) => {
  if (DISABLE_RATE_LIMIT) return true;
  if (!isProd) return true;

  const candidate =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip;

  if (!candidate) return false;

  if (
    candidate === "127.0.0.1" ||
    candidate === "::1" ||
    candidate === "::ffff:127.0.0.1" ||
    RATE_LIMIT_WHITELIST.has(candidate)
  ) {
    return true;
  }

  return false;
};

// Clave por usuario autenticado para evitar que redes corporativas (NAT compartido)
// hagan que todos los usuarios compartan el mismo contador de IP.
const rateLimitKeyGenerator = (req) => {
  if (req.user?.id) return `uid_${req.user.id}`;
  return ipKeyGenerator(req);
};

app.use(helmet(helmetConfig));

if (!DISABLE_RATE_LIMIT) {
  app.use(
    rateLimit({
      windowMs:        RATE_LIMIT_WINDOW_MS,
      max:             RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders:   false,
      skip:            shouldBypassRateLimit,
      keyGenerator:    rateLimitKeyGenerator,
      handler: (req, res) => {
        const key = req.user?.id ? `usuario ${req.user.id}` : req.ip;
        logger.warn(`Rate limit alcanzado: ${key} ${req.originalUrl}`);
        res.status(429).json({
          ok: false,
          code: "RATE_LIMIT",
          message: "Demasiadas peticiones, intenta de nuevo en unos segundos",
        });
      },
    })
  );
}

app.use(cors(corsConfig));
// 25mb: viaticos ya valida documentos de respaldo (file_base64) hasta 15MB
// en negocio (viaticos.service.js createAllowanceDocument), pero base64
// infla el tamano ~33% y el body JSON le suma overhead -- con 5mb ese limite
// de negocio era inalcanzable, el body parser rechazaba antes con un 413
// crudo (sin el mensaje "El archivo excede 15MB").
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

const requestContextMiddleware = require("./middlewares/requestContext");
app.use(requestContextMiddleware);
app.use(mLogger);

app.get("/", (_req, res) =>
  res.status(200).json({
    ok: true,
    message: "SPI FAM API",
    version: require("../package.json").version,
  })
);

app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

mountPublicRoutes(app);

app.use((req, res, next) => {
  if (isPublicPath(req.path)) {
    return next();
  }

  return verifyToken(req, res, next);
});

app.use(normalizeApiPayloads);
app.use(logLegacyUsageStats);
app.use(moduleAccessGuard);
app.use(auditMiddleware);

mountPrivateRoutes(app);

app.use((err, req, res, next) => {
  logger.error(
    { err, path: req.originalUrl, user: req.user?.email },
    "Error no manejado"
  );

  if (res.headersSent) return next(err);

  const statusCode = err.status || 500;
  res.status(statusCode).json({
    ok: false,
    message: err.message || "Error interno del servidor",
    code: err.code || (statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
    details: err.details || err.meta || null,
    retryable: typeof err.retryable === "boolean" ? err.retryable : statusCode >= 500,
    request_id: res.getHeader("x-correlation-id") || null,
  });
});

const { startKickoffScheduler } = require('./modules/kickoff/kickoff.scheduler');
startKickoffScheduler();

module.exports = app;
