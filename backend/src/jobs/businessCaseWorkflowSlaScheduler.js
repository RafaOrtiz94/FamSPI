const logger = require("../config/logger");
const { runReminderSweep } = require("../modules/business-case/businessCaseWorkflowSla.service");
const { isOffHours } = require("../utils/offHoursPolicy");
const { registerOffHoursJob } = require("./offHoursCoordinator");

// 6min: > timeout de autosuspend de Neon (~5min), deja huecos reales en horario laboral.
const DEFAULT_INTERVAL_MINUTES = Math.max(
  1,
  Number(process.env.BC_WORKFLOW_SLA_INTERVAL_MINUTES || 6),
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
    if (isOffHours(new Date()).isOffHours) return; // manejado por offHoursCoordinator
    runOnce().catch((error) => logger.error({ error }, "Error en recordatorios SLA de Business Case"));
  }, everyMs);
  registerOffHoursJob({
    name: "bc_workflow_sla",
    runOnce,
    offHoursIntervalMs: everyMs * 6,
    onError: (error) => logger.error({ error: error?.message || String(error) }, "Error en recordatorios SLA de Business Case (fuera de horario)"),
  });
}

module.exports = {
  runOnce,
  startBusinessCaseWorkflowSlaJob,
};
