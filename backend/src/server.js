console.log("Bootstrapping SPI FAM API [Cloud Run Mode]...");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
  require("dotenv").config({ path: "./.env.jobs" });
}

const isProduction = process.env.NODE_ENV === "production";

process.on("unhandledRejection", (err) => {
  console.error("[FATAL] Promesa no manejada:", err);
  if (isProduction) process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("[FATAL] Excepcion no capturada:", err);
  if (isProduction) process.exit(1);
});

const app = require("./app");
const logger = require("./config/logger");

const { startReminderScheduler } = require("./modules/mantenimientos/mantenimiento.scheduler");
const { startExpiredReservationsJob } = require("./jobs/checkExpiredReservations");
const { startBusinessCasePreflowExpiryJob } = require("./jobs/businessCasePreflowExpiryScheduler");
const { startBusinessCaseDeterminationsGateExpiryJob } = require("./jobs/businessCaseDeterminationsGateExpiryScheduler");
const { startBusinessCaseSheetGenerationQueueJob } = require("./jobs/businessCaseSheetGenerationQueueScheduler");
const { startDatabaseBackupJob } = require("./jobs/databaseBackupToDrive");
const { startPermisosRecoveryCoordinationExpiryJob } = require("./jobs/permisosRecoveryCoordinationExpiryScheduler");
const { startExternalCaseSyncJob } = require("./jobs/externalCaseSyncScheduler");

const PORT = Number(process.env.PORT) || 8080;
const ENV = process.env.NODE_ENV || "development";
const ENABLE_JOBS = process.env.ENABLE_JOBS === "true" || ENV !== "production";
const JOB_EXECUTION_MODE = ENABLE_JOBS ? "in_process" : "external_scheduler";

console.log(`Intentando escuchar en el puerto ${PORT}...`);

const server = app.listen(PORT, "0.0.0.0", async () => {
  logger.info(`SPI FAM API running on port ${PORT} [${ENV}]`);
  logger.info({ job_execution_mode: JOB_EXECUTION_MODE }, "Modo de ejecucion de jobs");

  if (ENABLE_JOBS) {
    logger.info("Jobs internos habilitados");
    startReminderScheduler();
    startExpiredReservationsJob();
    startBusinessCasePreflowExpiryJob();
    startBusinessCaseDeterminationsGateExpiryJob();
    startBusinessCaseSheetGenerationQueueJob();
    startPermisosRecoveryCoordinationExpiryJob();
    startDatabaseBackupJob();
    startExternalCaseSyncJob();
  } else {
    logger.info("Jobs internos deshabilitados; usar scheduler externo");
  }
});

const gracefulShutdown = (signal) => {
  logger.info(`Senal recibida: ${signal}, cerrando servidor de forma controlada`);

  server.close(() => {
    logger.info("Servidor cerrado correctamente");
  });

  setTimeout(() => {
    logger.warn(`Timeout de cierre para ${signal}`);
  }, 10000).unref();
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
