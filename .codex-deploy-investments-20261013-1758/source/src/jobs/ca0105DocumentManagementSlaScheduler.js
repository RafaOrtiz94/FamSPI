const cron = require("node-cron");
const logger = require("../config/logger");
const qualityService = require("../modules/calidad/ca0105.service");

/**
 * CRON Job - CA-01-05 Gestión y Control de Documentos
 * -------------------------------------------------
 * Revisa SLAs de workflows para versioning, approval_flow, pdf_stamp y archiving.
 * Detecta documentos en revisión prolongada y dispara escalamientos.
 */

const DEFAULT_ESCALATION_HOURS = 72;
const DEFAULT_FLOW_NAMES = ["versioning", "approval_flow", "pdf_stamp", "archiving"];

const reviewDocumentSlaRecords = async ({
  records = [],
  now = new Date(),
  escalationHours = DEFAULT_ESCALATION_HOURS,
  flowNames = DEFAULT_FLOW_NAMES,
} = {}) => {
  const thresholdMs = escalationHours * 60 * 60 * 1000;
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
        escalationHours,
        flowNames,
      },
      "CA-01-05 SLA Scheduler: sin documentos vencidos en la ventana actual."
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
        "CA-01-05 SLA Scheduler: documento fuera de SLA detectado."
      );
    } catch (error) {
      logger.error(
        {
          error: error?.message,
          recordId: record?.id || null,
        },
        "CA-01-05 SLA Scheduler: error analizando un workflow vencido."
      );
    }
  }

  return { escalated: overdueRecords.length, recordsReviewed: records.length };
};

const scheduleDocumentSlaReview = (options = {}) => {
  const cronExpression = options.cronExpression || "0 */4 * * *";
  const job = async () => {
    await reviewDocumentSlaRecords(options);
  };

  cron.schedule(cronExpression, job);
  logger.info(
    { cronExpression, module: "CA-01-05" },
    "CA-01-05 SLA Scheduler registrado."
  );

  return { cronExpression, job };
};

module.exports = {
  DEFAULT_ESCALATION_HOURS,
  DEFAULT_FLOW_NAMES,
  reviewDocumentSlaRecords,
  scheduleDocumentSlaReview,
};