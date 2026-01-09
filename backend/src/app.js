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
const { normalizeApiPayloads, logLegacyUsageStats } = require("./middlewares/apiNormalization");
const { verifyToken } = require("./middlewares/auth");

const app = express();
app.set("etag", false); // evitar 304 con body cacheado en endpoints dinámicos

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
  "https://spi-dev.famproject.com.ec", // dominio de producción LAN
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
// 📋 4️⃣ Request Context middleware (correlation ID)
// ======================================================
const requestContextMiddleware = require("./middlewares/requestContext");
app.use(requestContextMiddleware);

// ======================================================
// 🧾 5️⃣ Logger middleware global
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
const auditPrepRoutes = require("./modules/audit-prep/auditPrep.routes");
const managementRoutes = require("./modules/management/management.routes");
const documentsRoutes = require("./modules/documents/documents.routes");
const filesRoutes = require("./modules/files/files.routes");
const servicioRoutes = require("./modules/servicio/servicio.routes");
const technicalApplicationsRoutes = require("./modules/technical-applications/technicalApplications.routes");
const mantenimientosRoutes = require("./modules/mantenimientos/mantenimientos.routes");
const departmentsRoutes = require("./modules/departments/departments.routes");
const usersRoutes = require("./modules/users/users.routes");
const inventarioRoutes = require("./modules/inventario/inventario.routes");
const attendanceRoutes = require("./modules/attendance/attendance.routes");
const gmailRoutes = require("./modules/gmail/gmail.routes");
const equipmentPurchaseRoutes = require("./modules/equipment-purchases/equipmentPurchases.routes");
const personnelRequestsRoutes = require("./modules/personnel-requests/personnel-requests.routes");
const permisosRoutes = require("./modules/permisos/permisos.routes");
const vacacionesRoutes = require("./modules/vacaciones/vacaciones.routes");
const clientsRoutes = require("./modules/clients/clients.routes");
const schedulesRoutes = require("./modules/schedules/schedules.routes");
const privatePurchasesRoutes = require("./modules/private-purchases/privatePurchases.routes");
const {
  businessCaseRoutes,
  equipmentCatalogRoutes,
  determinationsCatalogRoutes,
  calculationTemplatesRoutes,
} = require("./modules/business-case/businessCase.routes");
const notificationsRoutes = require("./modules/notifications/notifications.routes");
const userProfileRoutes = require("./modules/user-profile/userProfile.routes");
const userCertificationsRoutes = require("./modules/user-certifications/userCertifications.routes");
const signatureRoutes = require("./modules/signature/signature.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");

// ======================================================
// ⏰ Initialize Attendance Overtime Scheduler
// ======================================================
const { processAutomaticOvertime } = require("./jobs/attendanceOvertimeScheduler");

// Run every 5 minutes (300,000 ms) in production, every 30 seconds in development
const SCHEDULER_INTERVAL = process.env.NODE_ENV === 'production' ? 5 * 60 * 1000 : 30 * 1000;

setInterval(async () => {
  try {
    await processAutomaticOvertime();
  } catch (error) {
    logger.error({ error }, "❌ Error in attendance overtime scheduler interval");
  }
}, SCHEDULER_INTERVAL);

logger.info(`⏰ Attendance overtime scheduler initialized (interval: ${SCHEDULER_INTERVAL / 1000}s)`);

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
    req.path === "/ws" || // permitir conexiones de websocket/sondeos sin JWT para evitar ruido en logs
    req.path.startsWith("/ws/") ||
    req.path.startsWith("/api/v1/auth/google") ||
    req.path.startsWith("/api/v1/gmail/auth/callback") ||
    req.path.startsWith("/health") ||
    req.path.startsWith("/api/verificar")
  ) {
    return next();
  }
  verifyToken(req, res, next);
});

// ======================================================
// 🔄 9️⃣ API Normalization Middleware
// ------------------------------------------------------
// Normalizes field names between legacy and canonical formats
// ======================================================
app.use(normalizeApiPayloads);
app.use(logLegacyUsageStats);

// ======================================================
// 🕵️ 🔟 Middleware de Auditoría Global
// ------------------------------------------------------
// Solo rutas autenticadas que modifiquen datos (POST, PUT, DELETE)
// ======================================================
app.use(auditMiddleware);

// ======================================================
// 🔍 API Normalization Stats Endpoint
// ------------------------------------------------------
// Endpoint to monitor legacy field usage during migration
// ======================================================
app.get("/api/v1/normalization/stats", (req, res) => {
  const { getLegacyUsageStats } = require("./middlewares/apiNormalization");
  const stats = getLegacyUsageStats();
  res.json({
    ok: true,
    totalLegacyFields: stats.length,
    stats: stats.slice(0, 50), // Limit response size
    timestamp: new Date().toISOString()
  });
});

// ======================================================
// 🚦 🔟 Rutas privadas (ordenadas por dominio)
// ======================================================
app.use("/api/v1/requests", requestRoutes);
app.use("/api/v1/approvals", approvalRoutes);
app.use("/api/v1/finanzas", finRoutes);
app.use("/api/v1/talento-humano", hrRoutes);
app.use("/api/v1/departments", departmentsRoutes);
app.use("/api/v1/auditoria", auditRoutes);
app.use("/api/v1/audit-prep", auditPrepRoutes);
app.use("/api/v1/management", managementRoutes);
app.use("/api/v1/documents", documentsRoutes);
app.use("/api/v1/files", filesRoutes);
app.use("/api/v1/servicio", servicioRoutes);
app.use("/api/v1/technical-applications", technicalApplicationsRoutes);
app.use("/api/v1/business-case", businessCaseRoutes);
app.use("/api/v1/equipment-catalog", equipmentCatalogRoutes);
app.use("/api/v1/determinations-catalog", determinationsCatalogRoutes);
app.use("/api/v1/calculation-templates", calculationTemplatesRoutes);
app.use("/api/v1/mantenimientos", mantenimientosRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/inventario", inventarioRoutes);
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/gmail", gmailRoutes);
app.use("/api/v1/equipment-purchases", equipmentPurchaseRoutes);
app.use("/api/v1/private-purchases", privatePurchasesRoutes);
app.use("/api/v1/personnel-requests", personnelRequestsRoutes);
app.use("/api/v1/permisos", permisosRoutes);
app.use("/api/v1/vacaciones", vacacionesRoutes);
app.use("/api/v1/clients", clientsRoutes);
app.use("/api/v1/schedules", schedulesRoutes);
app.use("/api/v1/notifications", notificationsRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/users/me/profile", userProfileRoutes);
app.use("/api/v1/users", userCertificationsRoutes);
app.use("/api", signatureRoutes);

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
