const logger = require("../config/logger");
const { isOffHours } = require("../utils/offHoursPolicy");
const { registerOffHoursJob } = require("./offHoursCoordinator");
const simulationService = require("../modules/business-case/consumableSimulation.service");

// Simula solos los Business Case cuyas estadisticas del cliente son nuevas o cambiaron.
const DEFAULT_INTERVAL_MS = Number(process.env.BC_CONSUMABLE_SIMULATION_INTERVAL_MS || 15 * 60 * 1000);
const BATCH_LIMIT = Number(process.env.BC_CONSUMABLE_SIMULATION_BATCH || 10);

async function runOnce() {
  const summary = await simulationService.runPending({ limit: BATCH_LIMIT });
  if (summary.pending) logger.info(summary, "[BC][SIMULATION] Simulaciones automaticas procesadas");
  return summary;
}

function startBusinessCaseConsumableSimulationJob() {
  const interval = Number.isFinite(DEFAULT_INTERVAL_MS) ? DEFAULT_INTERVAL_MS : 15 * 60 * 1000;
  setInterval(() => {
    if (isOffHours(new Date()).isOffHours) return; // manejado por offHoursCoordinator
    runOnce().catch((error) => {
      logger.error({ error: error.message }, "[BC][SIMULATION] Job interval failure");
    });
  }, interval);
  logger.info({ intervalMs: interval }, "[BC][SIMULATION] Job de simulacion automatica iniciado");
  registerOffHoursJob({
    name: "bc_consumable_simulations",
    runOnce,
    offHoursIntervalMs: interval * 6,
  });
}

module.exports = { runOnce, startBusinessCaseConsumableSimulationJob };
