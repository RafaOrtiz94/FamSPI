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
const { startBusinessCaseWorkflowSlaJob } = require("./jobs/businessCaseWorkflowSlaScheduler");
const { startBusinessCaseDeterminationsGateExpiryJob } = require("./jobs/businessCaseDeterminationsGateExpiryScheduler");
const { startBusinessCaseSheetGenerationQueueJob } = require("./jobs/businessCaseSheetGenerationQueueScheduler");
const { start: startBcNotificationQueueJob } = require("./jobs/businessCaseNotificationQueueScheduler");
const { startDatabaseBackupJob } = require("./jobs/databaseBackupToDrive");
const { startPermisosPendingExpiryJob } = require("./jobs/permisosPendingExpiryScheduler");
const { startPermisosRecoveryCoordinationExpiryJob } = require("./jobs/permisosRecoveryCoordinationExpiryScheduler");
const { startPermisosAutoCancelledJustificationJob } = require("./jobs/permisosAutoCancelledJustificationScheduler");
const { startPermisosApprovalEscalationJob } = require("./jobs/permisosApprovalEscalationScheduler");
const { startPermisosJustificanteVencimientoJob } = require("./jobs/permisosJustificanteVencimientoScheduler");
const { startExternalCaseSyncJob } = require("./jobs/externalCaseSyncScheduler");
const { startCrmSyncJob } = require("./jobs/crmSyncScheduler");
const { startSignatureWorkflowReminderJob } = require("./jobs/signatureWorkflowReminderScheduler");
const { startSignatureWorkflowExpiryJob } = require("./jobs/signatureWorkflowExpiryScheduler");
const { startTrainingSignatureReminderJob } = require("./jobs/trainingSignatureReminderScheduler");
const { startScheduleVisitCompletionReminderJob } = require("./jobs/scheduleVisitCompletionReminderScheduler");

const PORT = Number(process.env.PORT) || 8080;
const ENV = process.env.NODE_ENV || "development";
const ENABLE_JOBS = process.env.ENABLE_JOBS === "true" || ENV !== "production";
const IS_JOBS_RUNNER_INSTANCE =
  ENV !== "production" || String(process.env.JOBS_RUNNER_INSTANCE || "false").toLowerCase() === "true";
const JOB_EXECUTION_MODE = ENABLE_JOBS ? "in_process" : "external_scheduler";
const JOB_BOOTSTRAP_STAGGER_MS = Math.max(1000, Number(process.env.JOBS_BOOTSTRAP_STAGGER_MS || 15000));

console.log(`Intentando escuchar en el puerto ${PORT}...`);

const server = app.listen(PORT, "0.0.0.0", async () => {
  logger.info(`SPI FAM API running on port ${PORT} [${ENV}]`);
  logger.info({ job_execution_mode: JOB_EXECUTION_MODE }, "Modo de ejecucion de jobs");

  if (ENABLE_JOBS && IS_JOBS_RUNNER_INSTANCE) {
    logger.info("Jobs internos habilitados");
    const jobs = [
      { name: "mantenimiento_reminder", fn: startReminderScheduler },
      { name: "expired_reservations", fn: startExpiredReservationsJob },
      { name: "bc_preflow_expiry", fn: startBusinessCasePreflowExpiryJob },
      { name: "bc_workflow_sla", fn: startBusinessCaseWorkflowSlaJob },
      { name: "bc_determinations_gate_expiry", fn: startBusinessCaseDeterminationsGateExpiryJob },
      { name: "bc_sheet_generation_queue", fn: startBusinessCaseSheetGenerationQueueJob },
      { name: "bc_notification_queue", fn: startBcNotificationQueueJob },
      { name: "permisos_pending_expiry", fn: startPermisosPendingExpiryJob },
      { name: "permisos_recovery_coordination_expiry", fn: startPermisosRecoveryCoordinationExpiryJob },
      { name: "permisos_auto_cancelled_justification", fn: startPermisosAutoCancelledJustificationJob },
      { name: "permisos_approval_escalation", fn: startPermisosApprovalEscalationJob },
      { name: "permisos_justificante_vencimiento", fn: startPermisosJustificanteVencimientoJob },
      { name: "db_backup", fn: startDatabaseBackupJob },
      { name: "external_case_sync", fn: startExternalCaseSyncJob },
      { name: "crm_sync", fn: startCrmSyncJob },
      { name: "signature_workflow_reminder", fn: startSignatureWorkflowReminderJob },
      { name: "signature_workflow_expiry", fn: startSignatureWorkflowExpiryJob },
      { name: "training_signature_reminder", fn: startTrainingSignatureReminderJob },
      { name: "schedule_visit_completion_reminder", fn: startScheduleVisitCompletionReminderJob },
    ];

    jobs.forEach((job, index) => {
      const delayMs = index * JOB_BOOTSTRAP_STAGGER_MS;
      setTimeout(() => {
        try {
          logger.info({ job: job.name, delay_ms: delayMs }, "Iniciando job interno");
          job.fn();
        } catch (error) {
          logger.error({ job: job.name, error: error?.message || String(error) }, "Error iniciando job interno");
        }
      }, delayMs);
    });
  } else if (ENABLE_JOBS && !IS_JOBS_RUNNER_INSTANCE) {
    logger.info("Jobs internos deshabilitados en esta instancia; no es jobs-runner");
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
