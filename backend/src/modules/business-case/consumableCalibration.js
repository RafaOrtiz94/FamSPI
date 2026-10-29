/**
 * Calibracion de la simulacion contra cantidades reales (rechazo por distancia). Archivo puro.
 *
 * Para cada Business Case con cantidades reales (PRODUCTO A ENTREGAR del Sheet o validaciones de
 * jefe_servicio) se corren muchos escenarios con el rango supuesto de cada variable, se mide que
 * tan lejos queda cada uno de lo real y se descartan los que ni se acercaron: solo se guardan los
 * mas cercanos. Incluye las variables que llena jefe_servicio (repeticiones, controles fuera de
 * rango, muestras ISE): si el laboratorio no las declaro, se sortean en todo su rango y la
 * calibracion aprende cuales valores reproducen lo real.
 *
 * Para predecir otro Business Case se sortea solo entre esos escenarios aceptados (de procesos
 * parecidos, nunca del mismo), con lo que el laboratorio si haya declarado encima.
 */

const { __testables: simulation } = require("./consumableSimulation");

const DEFAULT_SCENARIOS = 50000;
const DEFAULT_KEEP_FRACTION = 0.01;
const MIN_KEEP = 100;
const MAX_KEEP = 500;
// Variables que se guardan de cada escenario aceptado (las que explican el consumo).
const KEPT_VARIABLES = Object.freeze([
  "annualGrowth", "seasonality", "rerunRate", "deadVolumeLoss", "qcTestsInDemand", "reagentOnboard", "qcSchedule",
  "qcFailureRate", "recalibrationOnFailure", "calibrationIntervalFactor", "lotsPerYear", "aliquotFreeze",
  "deliveryEveryMonths", "iseSamplesRatio", "planningShare",
]);
const CONTINUOUS = Object.freeze({
  annualGrowth: [-0.05, 0.15], seasonality: [0, 0.15], rerunRate: [0, 0.5], deadVolumeLoss: [0, 0.05],
  qcFailureRate: [0, 0.5], recalibrationOnFailure: [0, 1], calibrationIntervalFactor: [0.3, 1], iseSamplesRatio: [0, 1],
});

const round = (value, digits = 4) => Number(Number(value).toFixed(digits));

/**
 * Distancia de un escenario a lo real: error absoluto relativo sobre los productos que el modelo
 * simula y que tienen cantidad real. 0 = identico; 1 = tanto error como cantidad real.
 */
function scenarioDistance(totalsByKey, realByKey) {
  let error = 0;
  let real = 0;
  realByKey.forEach((quantity, key) => {
    if (!totalsByKey.has(key)) return;
    error += Math.abs(totalsByKey.get(key) - quantity);
    real += quantity;
  });
  return real > 0 ? error / real : null;
}

/**
 * Corre `scenarios` escenarios con el rango supuesto y conserva los mas cercanos a lo real.
 * @param model modelo de simulacion del equipo (buildSimulationModel)
 * @param realByKey Map "tipo::codigo" -> cantidad real (sin reactivos: salen del Sheet)
 */
function calibrate(model, realByKey, { scenarios = DEFAULT_SCENARIOS, keepFraction = DEFAULT_KEEP_FRACTION, seed = 20261015, explorePlanning = true, maxKeep = MAX_KEEP } = {}) {
  const started = Date.now();
  const random = simulation.createRandom(seed);
  const months = model.months;
  const simulated = new Set(model.components.map((component) => component.key));
  const comparable = new Map([...realByKey].filter(([key]) => simulated.has(key)));
  if (!comparable.size) return { status: "no_comparable_products", scenarios: 0, accepted: [] };
  const declaredWorkDays = Math.min(Math.max(Number(model.environment?.workDaysPerWeek) || 7, 1), 7);
  const keep = Math.min(Math.max(Math.round(scenarios * keepFraction), MIN_KEEP), maxKeep);
  // Solo se conservan los mejores (se recorta cada tanto): 200 000 escenarios no caben en memoria.
  let best = [];
  // Umbral = la peor distancia que sigue entre los mejores tras el ultimo recorte.
  let threshold = Infinity;
  let evaluated = 0;
  const distances = [];
  for (let index = 0; index < scenarios; index += 1) {
    const scenario = simulation.sampleScenario(random, model.environment || {}, { explorePlanning });
    const cumulative = simulation.simulateScenario(model, scenario, random);
    const totals = new Map();
    comparable.forEach((_, key) => {
      const series = cumulative.get(key);
      if (series) totals.set(key, series[months - 1]);
    });
    const distance = scenarioDistance(totals, comparable);
    if (distance === null) continue;
    evaluated += 1;
    if (index % 10 === 0) distances.push(distance);
    if (distance >= threshold) continue;
    const kept = Object.fromEntries(KEPT_VARIABLES.map((key) => [key, scenario[key]]));
    kept.workDaysDelta = scenario.workDaysPerWeek - declaredWorkDays;
    best.push({ distance, scenario: kept });
    if (best.length >= keep * 4) {
      best = best.sort((a, b) => a.distance - b.distance).slice(0, keep);
      threshold = best[best.length - 1].distance;
    }
  }
  best.sort((a, b) => a.distance - b.distance);
  const accepted = best.slice(0, keep).map((entry) => ({ distance: round(entry.distance), scenario: entry.scenario }));
  const median = (list) => (list.length ? list[Math.floor(list.length / 2)].distance : null);
  distances.sort((a, b) => a - b);
  return {
    status: "calibrated",
    scenarios: evaluated,
    comparableProducts: comparable.size,
    accepted,
    bestDistance: accepted.length ? accepted[0].distance : null,
    acceptedMedianDistance: round(median(accepted)),
    // Mediana de una muestra (1 de cada 10 escenarios), sin calibrar.
    priorMedianDistance: distances.length ? round(distances[Math.floor(distances.length / 2)]) : null,
    durationMs: Date.now() - started,
  };
}

/**
 * Sorteador de escenarios a partir de los aceptados de otros procesos ({ scenario, weight }).
 * Toma uno por peso, lo mueve un poco (±5 % en lo continuo, dentro de su rango) y aplica encima lo
 * que este laboratorio declaro (repeticiones, controles fuera de rango) y sus dias de trabajo.
 */
function posteriorSampler(pool, environment = {}) {
  const entries = pool.filter((entry) => entry?.scenario && entry.weight > 0);
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const declaredWorkDays = Math.min(Math.max(Number(environment.workDaysPerWeek) || 7, 1), 7);
  return (random) => {
    let target = random.next() * total;
    let picked = entries[entries.length - 1];
    for (const entry of entries) {
      target -= entry.weight;
      if (target <= 0) { picked = entry; break; }
    }
    const base = simulation.sampleScenario(random, environment);
    const scenario = { ...base, ...picked.scenario };
    if (picked.scenario.planningShare) {
      scenario.planningShare = Object.fromEntries(Object.entries(picked.scenario.planningShare)
        .map(([type, value]) => [type, Math.min(6, Math.max(0.05, value * random.uniform(0.95, 1.05)))]));
    }
    Object.entries(CONTINUOUS).forEach(([key, [min, max]]) => {
      if (typeof scenario[key] !== "number") return;
      scenario[key] = Math.min(max, Math.max(min, scenario[key] * random.uniform(0.95, 1.05)));
    });
    scenario.workDaysPerWeek = Math.min(7, Math.max(1, declaredWorkDays + (picked.scenario.workDaysDelta || 0)));
    // Lo que el laboratorio declara manda sobre lo aprendido.
    if (Number.isFinite(environment.rerunRate)) scenario.rerunRate = base.rerunRate;
    if (Number.isFinite(environment.qcFailureRate)) scenario.qcFailureRate = base.qcFailureRate;
    delete scenario.workDaysDelta;
    return scenario;
  };
}

/** Pool para un Business Case: escenarios aceptados de otros, pesados por parecido y por cercania. */
function buildPool(calibrations, ownProfile, profileDistance) {
  const pool = [];
  calibrations.forEach((calibration) => {
    const similarity = ownProfile && calibration.profile ? 1 / (profileDistance(ownProfile, calibration.profile) + 0.1) : 1;
    const accepted = calibration.accepted || [];
    accepted.forEach((entry) => {
      // Cada proceso pesa lo mismo sin importar cuantos escenarios guardo.
      pool.push({ scenario: entry.scenario, weight: (similarity / accepted.length) / (entry.distance + 0.05) });
    });
  });
  return pool;
}

module.exports = {
  DEFAULT_SCENARIOS,
  KEPT_VARIABLES,
  calibrate,
  posteriorSampler,
  buildPool,
  scenarioDistance,
};
