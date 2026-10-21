const cron = require("node-cron");
const logger = require("../config/logger");
const qualityService = require("../modules/calidad/ca0103.service");

/**
 * CRON Job - CA-01-03 Buenas Prácticas
 * -------------------------------------
 * Revisa SLAs de workflows para training, exams y certifications.
 * En esta iteracion no existe repositorio propio; por eso el worker
 * acepta una fuente de registros inyectable y, si no se provee, solo
 * ejecuta la rutina de supervision con trazabilidad.
 */

const DEFAULT_ESCALATION_MINUTES = 180;
const DEFAULT_FLOW_NAMES = ["training", "exams", "certifications"];

const reviewWorkflowSlaRecords = async ({
  records = [],
  now = new Date(),
  escalationMinutes = DEFAULT_ESCALATION_MINUTES,
  flowNames = DEFAULT_FLOW_NAMES,
} = {}) => {
  const thresholdMs = escalationMinutes * 60 * 1000;
  const overdueRecords = records.filter((record) => {
    const flowName = String(record?.flowName || record?.module || "").toLowerCase();
    const status = String(record?.status || "").toLowerCase();
    const updatedAt = record?.updatedAt ? new Date(record.updatedAt).getTime() : 0;
    const isOpenFlow = flowNames.includes(flowName);
    const isTerminal = status === "archived";
    return isOpenFlow && !isTerminal && updatedAt > 0 && now.getTime() - updatedAt > thresholdMs;
  });

  if (overdueRecords.length === 0) {
    logger.info(
      {
        escalationMinutes,
        flowNames,
      },
      "CA-01-03 SLA Scheduler: sin records vencidos en la ventana actual."
    );
    return { escalated: 0, recordsReviewed: records.length };
  }

  for (const record of overdueRecords) {
    try {
      const snapshot = qualityService.buildWorkflowSnapshot(record, record.flowName);
      logger.warn(
        {
          flowName: snapshot.flowName,
          recordId: snapshot.id,
          status: snapshot.status,
          updatedAt: record.updatedAt,
        },
        "CA-01-03 SLA Scheduler: workflow fuera de SLA detectado."
      );
    } catch (error) {
      logger.error(
        {
          error: error?.message,
          recordId: record?.id || null,
        },
        "CA-01-03 SLA Scheduler: error analizando un workflow vencido."
      );
    }
  }

  return { escalated: overdueRecords.length, recordsReviewed: records.length };
};

const scheduleWorkflowSlaReview = (options = {}) => {
  const cronExpression = options.cronExpression || "*/30 * * * *";
  const job = async () => {
    await reviewWorkflowSlaRecords(options);
  };

  cron.schedule(cronExpression, job);
  logger.info(
    { cronExpression, module: "CA-01-03" },
    "CA-01-03 SLA Scheduler registrado."
  );

  return { cronExpression, job };
};

module.exports = {
  DEFAULT_ESCALATION_MINUTES,
  DEFAULT_FLOW_NAMES,
  reviewWorkflowSlaRecords,
  scheduleWorkflowSlaReview,
};
