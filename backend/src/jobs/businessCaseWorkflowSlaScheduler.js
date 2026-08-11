const logger = require("../config/logger");
const { runReminderSweep } = require("../modules/business-case/businessCaseWorkflowSla.service");

const DEFAULT_INTERVAL_MINUTES = Math.max(
  1,
  Number(process.env.BC_WORKFLOW_SLA_INTERVAL_MINUTES || 5),
);
const SHOULD_RUN_ON_START = String(process.env.JOBS_RUN_ON_START || "false").trim().toLowerCase() === "true";

let interval = null;
let running = false;

async function runOnce() {
  if (running) return { skipped: true, reason: "already_running" };
  running = true;
  try {
    return await runReminderSweep();
  } finally {
    running = false;
  }
}

function startBusinessCaseWorkflowSlaJob() {
  if (interval) return;
  const everyMs = DEFAULT_INTERVAL_MINUTES * 60 * 1000;
  logger.info(
    { interval_ms: everyMs },
    "Business Case workflow SLA reminder job configurado",
  );
  if (SHOULD_RUN_ON_START) {
    runOnce().catch((error) => logger.error({ error }, "Error inicial en recordatorios SLA de Business Case"));
  }
  interval = setInterval(() => {
    runOnce().catch((error) => logger.error({ error }, "Error en recordatorios SLA de Business Case"));
  }, everyMs);
}

module.exports = {
  runOnce,
  startBusinessCaseWorkflowSlaJob,
};
