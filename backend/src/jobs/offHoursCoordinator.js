const logger = require("../config/logger");
const { isOffHours } = require("../utils/offHoursPolicy");

// ponytail: 12+ jobs con su propio setInterval fuera de horario, aunque cada
// uno individualmente alentado, casi siempre hay alguno despertando el
// compute de Neon dentro de cualquier ventana de 5 min (su timeout de
// autosuspend) -> nunca llega a dormir. Un solo tick compartido revisa cada
// TICK_MS quien ya le toca correr (cada job mantiene su propia cadencia via
// offHoursIntervalMs), dejando huecos reales entre despertadas.
const TICK_MS = 10 * 60 * 1000;

const jobs = new Map(); // name -> { runOnce, offHoursIntervalMs, onError, lastRunAt }
let intervalRef = null;

function registerOffHoursJob({ name, runOnce, offHoursIntervalMs, onError }) {
  jobs.set(name, { runOnce, offHoursIntervalMs, onError, lastRunAt: 0 });
}

async function tick() {
  if (!isOffHours(new Date()).isOffHours) return;
  const now = Date.now();
  for (const [name, job] of jobs) {
    if (now - job.lastRunAt < job.offHoursIntervalMs) continue;
    job.lastRunAt = now;
    try {
      await job.runOnce();
    } catch (error) {
      if (job.onError) {
        job.onError(error);
      } else {
        logger.error(
          { job: name, error: error?.message || String(error) },
          "Error en job fuera de horario (offHoursCoordinator)",
        );
      }
    }
  }
}

function startOffHoursCoordinator() {
  if (intervalRef) return;
  intervalRef = setInterval(() => {
    tick().catch((error) =>
      logger.error({ error: error?.message || String(error) }, "Error en tick del offHoursCoordinator"),
    );
  }, TICK_MS);
}

module.exports = { registerOffHoursJob, startOffHoursCoordinator, tick, TICK_MS };
