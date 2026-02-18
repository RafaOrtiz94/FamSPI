/**
 * src/app.js
 * ------------------------------------------------------------
 * 🚀 SPI Fam Backend — Configuración central Express (Cloud Run Optimized)
 * - Seguridad sin cookies (JWT por headers)
 * - Protección CORS dinámica
 * - Logging, auditoría y manejo de errores global
 * - Optimizado para Cloud Run / Free Tier
 */

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

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

app.disable("x-powered-by");
app.set("etag", false);

// ======================================================
// ⚙️ TRUST PROXY (OBLIGATORIO EN CLOUD RUN)
// ======================================================
app.set("trust proxy", 1);

// ======================================================
// 🧠 RATE LIMIT CONFIG
// ======================================================
const RATE_LIMIT_WINDOW_MS =
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, 10) || 15 * 60 * 1000;

// Ajuste por defecto más generoso en producción (si no se define RATE_LIMIT_MAX)
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || (isProd ? 1200 : 0), 10);

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
// 🛡️ SEGURIDAD BASE
// ======================================================
app.use(helmet(helmetConfig));


if (!DISABLE_RATE_LIMIT) {
  app.use(
    rateLimit({
      windowMs: RATE_LIMIT_WINDOW_MS,
      max: RATE_LIMIT_MAX,
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
}

// ======================================================
// 🌐 CORS
// ======================================================
app.use(cors(corsConfig));

// ======================================================
// ⚠️ BODY PARSERS (CRÍTICO ↓↓↓)
// ------------------------------------------------------
// 50MB rompe Cloud Run (OOM)
// 5MB es más que suficiente
// ======================================================
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// ======================================================
// 📋 REQUEST CONTEXT
// ======================================================
const requestContextMiddleware = require("./middlewares/requestContext");
app.use(requestContextMiddleware);

// ======================================================
// 🧾 LOGGER
// ======================================================
app.use(mLogger);

// ======================================================
// ❤️ HEALTH (ANTES DE TODO)
// ======================================================
app.get("/", (_req, res) =>
  res.status(200).json({
    ok: true,
    message: "SPI FAM API",
    version: require("../package.json").version,
  })
);

app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

// ======================================================
// 📦 IMPORTAR RUTAS
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
const applicantsRoutes = require("./modules/applicants/applicants.routes");
const {
  businessCaseRoutes,
  equipmentCatalogRoutes,
  determinationsCatalogRoutes,
  calculationTemplatesRoutes,
} = require("./modules/business-case/businessCase.routes");
const notificationsRoutes = require("./modules/notifications/notifications.routes");
const userProfileRoutes = require("./modules/user-profile/userProfile.routes");
const userCertificationsRoutes = require("./modules/user-certifications/userCertifications.routes");
const collaboratorsRoutes = require("./modules/collaborators/collaborators.routes");
const signatureRoutes = require("./modules/signature/signature.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const supportTicketsRoutes = require("./modules/support-tickets/supportTickets.routes");
const viaticosRoutes = require("./modules/viaticos/viaticos.routes");
const internalJobsRouter = require("./routes/internalJobs.routes");

// ======================================================
// 🔓 RUTAS PÚBLICAS
// ======================================================
app.use("/api/v1/auth", authRoutes);
app.use("/api/applicants", applicantsRoutes);

// ======================================================
// 🔒 JWT GLOBAL
// ======================================================
app.use((req, res, next) => {
  if (
    req.path === "/ws" ||
    req.path.startsWith("/ws/") ||
    req.path.startsWith("/internal/jobs") ||
    req.path.startsWith("/api/v1/equipment-purchases/events") ||
    req.path.startsWith("/api/v1/private-purchases/events") ||
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
// NORMALIZACIÓN + AUDITORÍA
// ======================================================
app.use(normalizeApiPayloads);
app.use(logLegacyUsageStats);
app.use(auditMiddleware);

// ======================================================
// RUTAS PRIVADAS
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
app.use("/api/v1/collaborators", collaboratorsRoutes);
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
app.use("/api/v1/support-tickets", supportTicketsRoutes);
app.use("/api/v1/viaticos", viaticosRoutes);
app.use("/internal/jobs", internalJobsRouter);
app.use("/api/v1/users/me/profile", userProfileRoutes);
app.use("/api/v1/users", userCertificationsRoutes);
app.use("/api", signatureRoutes);

// ======================================================
// 🚑 ERROR HANDLER GLOBAL
// ======================================================
app.use((err, req, res, next) => {
  logger.error(
    { err, path: req.originalUrl, user: req.user?.email },
    "🔥 Error no manejado"
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

// ======================================================
// EXPORT
// ======================================================
module.exports = app;
