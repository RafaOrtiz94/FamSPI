const cron = require("node-cron");
const logger = require("../config/logger");
const qualityService = require("../modules/calidad/ca0104.service");

/**
 * CRON Job - CA-01-04 Control de Plagas
 * --------------------------------------
 * Revisa vencimientos de SLA para traps maps, inspections, vendor api y toxicity.
 * La fuente de registros se mantiene inyectable para no acoplar el worker a una
 * consulta concreta antes de montar la persistencia completa del módulo.
 */

const DEFAULT_ESCALATION_MINUTES = 240;
const DEFAULT_FLOW_NAMES = ["traps_map", "inspections", "vendor_api", "toxicity"];

const reviewPestControlSlaRecords = async ({
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
      "CA-01-04 SLA Scheduler: sin records vencidos en la ventana actual."
    );
    return { escalated: 0, recordsReviewed: records.length };
  }

  for (const record of overdueRecords) {
    try {
      const snapshot = qualityService.buildSnapshot(record, record.flowName);
      logger.warn(
        {
          flowName: snapshot.flowName,
          recordId: snapshot.id,
          status: snapshot.status,
          updatedAt: record.updatedAt,
        },
        "CA-01-04 SLA Scheduler: flujo de plagas fuera de SLA detectado."
      );
    } catch (error) {
      logger.error(
        {
          error: error?.message,
          recordId: record?.id || null,
        },
        "CA-01-04 SLA Scheduler: error analizando un registro vencido."
      );
    }
  }

  return { escalated: overdueRecords.length, recordsReviewed: records.length };
};

const schedulePestControlSlaReview = (options = {}) => {
  const cronExpression = options.cronExpression || "*/30 * * * *";
  const job = async () => {
    await reviewPestControlSlaRecords(options);
  };

  cron.schedule(cronExpression, job);
  logger.info(
    { cronExpression, module: "CA-01-04" },
    "CA-01-04 SLA Scheduler registrado."
  );

  return { cronExpression, job };
};

module.exports = {
  DEFAULT_ESCALATION_MINUTES,
  DEFAULT_FLOW_NAMES,
  reviewPestControlSlaRecords,
  schedulePestControlSlaReview,
};
