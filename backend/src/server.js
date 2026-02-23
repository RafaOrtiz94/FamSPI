console.log("🎬 Bootstrapping SPI FAM API [Cloud Run Mode]...");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
  require("dotenv").config({ path: "./.env.jobs" });
}

// ======================================================
// 🛡️  Cloud Run Safe Error Handling (DEFINIR ANTES DE NADA)
// ======================================================
const isProduction = process.env.NODE_ENV === "production";

process.on("unhandledRejection", (err) => {
  console.error("🛡️ [FATAL] Promesa no manejada:", err);
  if (isProduction) process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("🛡️ [FATAL] Excepción no capturada:", err);
  if (isProduction) process.exit(1);
});

const app = require("./app");
const logger = require("./config/logger");
//const { checkDbSchema } = require("./utils/dbHealth");

const { startReminderScheduler } = require("./modules/mantenimientos/mantenimiento.scheduler");
const { startExpiredReservationsJob } = require("./jobs/checkExpiredReservations");
const { startBusinessCasePreflowExpiryJob } = require("./jobs/businessCasePreflowExpiryScheduler");

const PORT = Number(process.env.PORT) || 8080;
const ENV = process.env.NODE_ENV || "development";

console.log(`🔌 Intentando escuchar en el puerto ${PORT}...`);

const ENABLE_JOBS =
  process.env.ENABLE_JOBS === "true" ||
  (ENV !== "production");

const server = app.listen(PORT, "0.0.0.0", async () => {
  logger.info(`🚀 SPI FAM API running on port ${PORT} [${ENV}]`);

  if (ENABLE_JOBS) {
    logger.info("⏰ Jobs internos habilitados");
    startReminderScheduler();
    startExpiredReservationsJob();
    startBusinessCasePreflowExpiryJob();
  } else {
    logger.info("⏸️ Jobs deshabilitados (usar Cloud Scheduler)");
  }
});

// Graceful shutdown solo para señales del sistema
const gracefulShutdown = (signal) => {
  logger.info(`🧹 Señal recibida: ${signal}, cerrando servidor gracefulmente`);

  server.close(() => {
    logger.info("✅ Servidor cerrado correctamente");
    // En Cloud Run, NO usamos process.exit() - el contenedor se maneja automáticamente
  });

  // Timeout de seguridad para Cloud Run
  setTimeout(() => {
    logger.warn(`⏰ Timeout de ${signal}, forzando cierre`);
    // Cloud Run maneja la terminación del contenedor
  }, 10000).unref();
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
