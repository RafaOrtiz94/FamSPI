/**
 * src/app.js
 * ------------------------------------------------------------
 * 🚀 SPI Fam Backend — Configuración central Express
 * - Seguridad sin cookies (JWT por headers)
 * - Protección CORS dinámica
 * - Logging, auditoría y manejo de errores global
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const logger = require("./config/logger");
const { helmetConfig, corsConfig, isProd } = require("./config/security");
const mLogger = require("./middlewares/loggerMiddleware");
const { auditMiddleware } = require("./middlewares/auditMiddleware");
const { verifyToken } = require("./middlewares/auth");

const app = express();

const RATE_LIMIT_WINDOW_MS =
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, 10) || 15 * 60 * 1000;
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || (isProd ? 4000 : 0), 10);
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

// ======================================================
// 🧠 ENTORNO Y DOMINIOS PERMITIDOS
// ======================================================
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3001";
const ORIGIN_WHITELIST = new Set([
  FRONTEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3001",
  "http://localhost:5173", // soporte para Vite
]);

const trustProxyValue =
  process.env.TRUST_PROXY ?? (isProd ? "1" : "loopback");

if (
  trustProxyValue !== null &&
  trustProxyValue !== undefined &&
  `${trustProxyValue}`.toLowerCase() !== "false"
) {
  const normalizedTrustProxy =
    `${trustProxyValue}`.toLowerCase() === "true"
      ? true
      : Number.isNaN(Number(trustProxyValue))
        ? trustProxyValue
        : Number(trustProxyValue);

  app.set("trust proxy", normalizedTrustProxy);
  logger.info(
    `⚙️ trust proxy habilitado (${JSON.stringify(normalizedTrustProxy)})`
  );
}

// ======================================================
// 🛡️ 1️⃣ Seguridad base (Helmet + Rate Limit)
// ======================================================
app.use(helmet(helmetConfig));

app.use(
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX || 10000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldBypassRateLimit,
    handler: (req, res) => {
      logger.warn(`🚫 Rate limit alcanzado: ${req.ip} ${req.originalUrl}`);
      res.status(429).json({
        ok: false,
        code: "RATE_LIMIT",
        message: "Demasiadas peticiones, intenta de nuevo en unos segundos",
      });
    },
  })
);

// ======================================================
// 🌐 2️⃣ CORS dinámico — solo headers JWT
// ======================================================
app.use(
  cors({
    ...corsConfig,
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ORIGIN_WHITELIST.has(origin)) return callback(null, true);
      logger.warn(`❌ CORS bloqueado: ${origin}`);
      return callback(new Error(`Origen no permitido: ${origin}`));
    },
  })
);

// Preflight (CORS manual de respaldo)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ORIGIN_WHITELIST.has(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
  } else {
    res.header("Access-Control-Allow-Origin", FRONTEND_URL);
  }

  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-refresh-token"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ======================================================
// ⚙️ 3️⃣ Body parsers
// ======================================================
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ======================================================
// 🧾 4️⃣ Logger middleware global
// ======================================================
app.use(mLogger);

// ======================================================
// 📦 5️⃣ Importar rutas
// ======================================================
const authRoutes = require("./modules/auth/auth.routes");
const requestRoutes = require("./modules/requests/requests.routes");
const approvalRoutes = require("./modules/approvals/approvals.routes");
const finRoutes = require("./modules/finanzas/finanzas.routes");
const hrRoutes = require("./modules/talento_humano/hr.routes");
const auditRoutes = require("./modules/auditoria/audit.routes");
const managementRoutes = require("./modules/management/management.routes");
const documentsRoutes = require("./modules/documents/documents.routes");
const filesRoutes = require("./modules/files/files.routes");
const servicioRoutes = require("./modules/servicio/servicio.routes");
const mantenimientosRoutes = require("./modules/mantenimientos/mantenimientos.routes");
const departmentsRoutes = require("./modules/departments/departments.routes");
const usersRoutes = require("./modules/users/users.routes");
const inventarioRoutes = require("./modules/inventario/inventario.routes");
const attendanceRoutes = require("./modules/attendance/attendance.routes");
const gmailRoutes = require("./modules/gmail/gmail.routes");
const equipmentPurchaseRoutes = require("./modules/equipment-purchases/equipmentPurchases.routes");

// ======================================================
// ❤️ 6️⃣ Rutas públicas de salud
// ======================================================
app.get("/", (_req, res) => res.status(200).json({
  ok: true,
  message: "SPI FAM API",
  version: require("../package.json").version
}));
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

// ======================================================
// 🔓 7️⃣ Rutas públicas (sin JWT)
// ======================================================
app.use("/api/v1/auth", authRoutes);

// ======================================================
// 🔒 8️⃣ Middleware global JWT (solo rutas protegidas)
// ======================================================
app.use((req, res, next) => {
  if (
    req.path.startsWith("/api/v1/auth/google") ||
    req.path.startsWith("/api/v1/gmail/auth/callback") ||
    req.path.startsWith("/health")
  ) {
    return next();
  }
  verifyToken(req, res, next);
});

// ======================================================
// 🕵️ 9️⃣ Middleware de Auditoría Global
// ------------------------------------------------------
// Solo rutas autenticadas que modifiquen datos (POST, PUT, DELETE)
// ======================================================
app.use(auditMiddleware);

// ======================================================
// 🚦 🔟 Rutas privadas (ordenadas por dominio)
// ======================================================
app.use("/api/v1/requests", requestRoutes);
app.use("/api/v1/approvals", approvalRoutes);
app.use("/api/v1/finanzas", finRoutes);
app.use("/api/v1/talento-humano", hrRoutes);
app.use("/api/v1/departments", departmentsRoutes);
app.use("/api/v1/auditoria", auditRoutes);
app.use("/api/v1/management", managementRoutes);
app.use("/api/v1/documents", documentsRoutes);
app.use("/api/v1/files", filesRoutes);
app.use("/api/v1/servicio", servicioRoutes);
app.use("/api/v1/mantenimientos", mantenimientosRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/inventario", inventarioRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/gmail", gmailRoutes);
app.use("/api/v1/equipment-purchases", equipmentPurchaseRoutes);

// ======================================================
// 🚑 11️⃣ Manejo global de errores
// ======================================================
app.use((err, req, res, next) => {
  logger.error(
    { err, path: req.originalUrl, body: req.body, user: req.user?.email },
    "🔥 Error no manejado"
  );
  if (res.headersSent) return next(err);

  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    message: err.message || "Error interno del servidor",
  });
});

// ======================================================
// 🧩 Exportación
// ======================================================
module.exports = app;
