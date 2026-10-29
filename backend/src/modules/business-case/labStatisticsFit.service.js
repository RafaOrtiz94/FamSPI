/**
 * Ajuste por simulacion de las estadisticas del laboratorio de un Business Case con cantidades
 * reales (ver labStatisticsSearch.js). El resultado se guarda como estadistica 'simulation_fit':
 * el motor la usa mientras jefe_servicio no llene la suya, que siempre manda.
 */

const crypto = require("crypto");
const db = require("../../config/db");
const logger = require("../../config/logger");
const simulation = require("./consumableSimulation");
const calibration = require("./consumableCalibration");
const { __testables: calibrationTestables } = require("./consumableCalibration.service");
const { PARAMETERS } = require("./labStatisticsSearch");

const SEARCH_OPTIONS = Object.freeze({ rounds: 8, perRound: 40, scenarios: 2000, finalScenarios: 20000 });

const fingerprintOf = (real) => crypto.createHash("md5")
  .update([...real].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join(","))
  .digest("hex");

function searchAsync(model, real, bounds, options) {
  const { Worker } = require("worker_threads");
  return new Promise((resolve, reject) => {
    const worker = new Worker(require("path").join(__dirname, "consumableSimulation.worker.js"), {
      workerData: { task: "fitLabStatistics", model, real: [...real], bounds, options },
    });
    worker.once("message", (message) => {
      if (message?.ok) resolve(message.result);
      else reject(new Error(message?.message || "La busqueda fallo"));
      worker.terminate().catch(() => {});
    });
    worker.once("error", reject);
  });
}

// Escenarios para el resto de variables: los aceptados de este mismo proceso (ajuste a su real) y,
// si aun no esta calibrado, los de los demas.
async function posteriorFor(businessCaseId, model) {
  const { rows } = await db.query(
    `SELECT business_case_id::text AS id, profile, accepted FROM bc_scenario_calibrations
      WHERE equipment_id > 0 AND jsonb_array_length(accepted) > 0`,
  );
  const own = rows.filter((row) => row.id === businessCaseId);
  return calibration.buildPool(own.length ? own : rows, simulation.buildProfile(model), simulation.profileDistance);
}

async function fitForBusinessCase(businessCaseId, { user = null } = {}) {
  const pricingLab = require("./businessCasePricingLab.service");
  const preview = await pricingLab.buildPreview(businessCaseId);
  const results = [];
  for (const entry of preview.equipment || []) {
    const model = entry.ruleEngine?.simulationModel;
    if (!model) continue;
    const real = await calibrationTestables.loadReal(businessCaseId, model.equipmentId, model.months);
    if (!real.size) continue;
    const realFingerprint = fingerprintOf(real);
    const { rows: discardedRows } = await db.query(
      `SELECT params FROM bc_lab_statistics_search
        WHERE business_case_id = $1 AND equipment_id = $2 AND real_fingerprint = $3 AND status = 'discarded'`,
      [businessCaseId, model.equipmentId, realFingerprint],
    );
    const annualTests = (model.reagents.reduce((sum, reagent) => sum + reagent.processDemand, 0) * 12) / model.months;
    const bounds = { iseSamplesPerYear: [0, Math.max(1000, Math.round(annualTests * 2))], rerunPct: [0, 20], qcFailurePct: [0, 20] };
    const result = await searchAsync(model, real, bounds, {
      ...SEARCH_OPTIONS,
      posterior: await posteriorFor(businessCaseId, model),
      discarded: discardedRows.map((row) => row.params),
    });
    for (const candidate of result.evaluated) {
      await db.query(
        `INSERT INTO bc_lab_statistics_search (business_case_id, equipment_id, real_fingerprint, round, params, matches, error, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [businessCaseId, model.equipmentId, realFingerprint, candidate.round, JSON.stringify(candidate.params), candidate.matches, candidate.error, candidate.status],
      );
    }
    if (result.best) {
      const details = {
        matches: result.best.matches, compared: result.best.compared, error: result.best.error,
        evaluated: result.evaluated.length, previouslyDiscarded: discardedRows.length, equipmentId: model.equipmentId,
      };
      const isIse = /ISE/i.test(String(model.equipmentName || ""));
      for (const parameter of PARAMETERS) {
        if (parameter.statKey === "ise_tests_per_year" && !isIse) continue;
        // Lo que lleno jefe_servicio no se pisa.
        await db.query(
          `INSERT INTO bc_lab_statistics (business_case_id, stat_key, value, filled_by, filled_at, source, details)
           VALUES ($1, $2, $3, $4, NOW(), 'simulation_fit', $5)
           ON CONFLICT (business_case_id, stat_key) DO UPDATE
             SET value = EXCLUDED.value, filled_by = EXCLUDED.filled_by, filled_at = NOW(), source = 'simulation_fit', details = EXCLUDED.details
           WHERE bc_lab_statistics.source = 'simulation_fit'`,
          [businessCaseId, parameter.statKey, result.best.params[parameter.key], user?.email || "simulacion", JSON.stringify(details)],
        );
      }
    }
    logger.info({ businessCaseId, equipmentId: model.equipmentId, best: result.best, evaluated: result.evaluated.length }, "[BC][LAB_STATS_FIT] Estadisticas ajustadas por simulacion");
    results.push({ equipmentId: model.equipmentId, ...result });
  }
  return results;
}

module.exports = { fitForBusinessCase, SEARCH_OPTIONS };
