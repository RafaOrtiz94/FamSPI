const cron = require("node-cron");
const logger = require("../config/logger");
const qualityService = require("../modules/calidad/ca0106.service");

const DEFAULT_ESCALATION_HOURS = 48;
const DEFAULT_FLOW_NAMES = ["traceability", "communication", "quarantine", "logistics"];

const reviewRecallSlaRecords = async ({ records = [], now = new Date(), escalationHours = DEFAULT_ESCALATION_HOURS, flowNames = DEFAULT_FLOW_NAMES } = {}) => {
  const thresholdMs = escalationHours * 60 * 60 * 1000;
  const overdueRecords = records.filter((record) => {
    const flowName = String(record?.flowName || record?.module || "").toLowerCase();
    const status = String(record?.status || "").toLowerCase();
    const createdAt = record?.createdAt ? new Date(record.createdAt).getTime() : 0;
    const isOpenFlow = flowNames.includes(flowName);
    const isTerminal = status === "closed" || status === "completed";
    return isOpenFlow && !isTerminal && createdAt > 0 && now.getTime() - createdAt > thresholdMs;
  });

  if (overdueRecords.length === 0) {
    logger.info({ escalationHours, flowNames }, "CA-01-06 SLA Scheduler: sin records vencidos.");
    return { escalated: 0, recordsReviewed: records.length };
  }

  for (const record of overdueRecords) {
    try {
      const snapshot = qualityService.buildWorkflowSnapshot(record, record.flowName);
      logger.warn({ flowName: snapshot.flowName, recordId: snapshot.id, status: snapshot.status }, "CA-01-06 SLA: workflow fuera de SLA.");
    } catch (error) {
      logger.error({ error: error?.message, recordId: record?.id }, "CA-01-06 SLA: error.");
    }
  }
  return { escalated: overdueRecords.length, recordsReviewed: records.length };
};

const scheduleRecallSlaReview = (options = {}) => {
  const cronExpression = options.cronExpression || "0 */6 * * *";
  cron.schedule(cronExpression, async () => { await reviewRecallSlaRecords(options); });
  logger.info({ cronExpression, module: "CA-01-06" }, "CA-01-06 SLA Scheduler registrado.");
  return { cronExpression };
};

module.exports = { DEFAULT_ESCALATION_HOURS, DEFAULT_FLOW_NAMES, reviewRecallSlaRecords, scheduleRecallSlaReview };