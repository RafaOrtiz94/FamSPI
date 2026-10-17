/**
 * Busqueda por simulacion de las estadisticas del laboratorio (muestras ISE por año, % de
 * repeticiones, % de controles fuera de rango) que dan mas coincidencias con lo real de un
 * Business Case. Archivo puro.
 *
 * Por rondas (entropia cruzada): se sortean candidatos dentro del rango vigente, cada uno se simula
 * y se cuenta cuantos productos coinciden con lo real. Se conserva el mejor 25 % (elite) y el resto
 * se descarta: queda registrado y ningun candidato nuevo cae cerca de un descartado (no se vuelve a
 * simular lo que ni se acerco). El rango siguiente es el de la elite, con un pequeño margen.
 *
 * Coincide = |prediccion - real| <= max(1, 15 % del real), el mismo criterio de las mediciones.
 */

const { __testables: simulation } = require("./consumableSimulation");

const COINCIDENCE_SHARE = 0.15;
const PARAMETERS = Object.freeze([
  { key: "iseSamplesPerYear", label: "Muestras ISE por año", statKey: "ise_tests_per_year", integer: true },
  { key: "rerunPct", label: "Muestras que se repiten (%)", statKey: "rerun_rate_pct" },
  { key: "qcFailurePct", label: "Controles fuera de rango (%)", statKey: "qc_failure_rate_pct" },
]);

const round = (value, digits = 4) => Number(Number(value).toFixed(digits));
const coincides = (predicted, real) => Math.abs(predicted - real) <= Math.max(1, COINCIDENCE_SHARE * real);

/** Puro. Coincidencias y error de una prediccion por producto contra lo real (sin reactivos). */
function scoreAgainstReal(predictedByKey, realByKey) {
  const keys = new Set([...realByKey.keys(), ...[...predictedByKey.keys()].filter((key) => predictedByKey.get(key) > 0)]);
  let matches = 0;
  let compared = 0;
  let error = 0;
  let real = 0;
  keys.forEach((key) => {
    if (key.startsWith("reactivo::")) return;
    const h = realByKey.get(key) || 0;
    const p = predictedByKey.get(key) || 0;
    if (!(h > 0) && !(p > 0)) return;
    compared += 1;
    if (coincides(p, h)) matches += 1;
    error += Math.abs(p - h);
    real += h;
  });
  return { matches, compared, error: real > 0 ? round(error / real) : null };
}

/**
 * Prediccion (mediana) del modelo con unas estadisticas del laboratorio dadas. Las demas variables
 * se sortean entre los escenarios aceptados (`posterior`) o en su rango supuesto.
 */
function predictWith(model, params, { scenarios, seed, posterior }) {
  const months = model.months;
  const environment = {
    ...(model.environment || {}),
    rerunRate: params.rerunPct / 100,
    qcFailureRate: params.qcFailurePct / 100,
    iseTests: params.iseSamplesPerYear > 0 ? (params.iseSamplesPerYear * months) / 12 : null,
  };
  const run = require("./consumableSimulation").runSimulation({ ...model, environment }, { scenarios, seed, posterior });
  return new Map(run.products.map((product) => [product.key, product.manualQuantity ?? product.p50 ?? product.formulaQuantity ?? 0]));
}

// Distancia normalizada entre dos candidatos (0 = mismo punto, 1 = extremos del rango inicial).
function separation(a, b, bounds) {
  return Math.max(...PARAMETERS.map(({ key }) => {
    const [min, max] = bounds[key];
    return Math.abs(a[key] - b[key]) / ((max - min) || 1);
  }));
}

/**
 * @param model modelo de simulacion del equipo
 * @param realByKey Map "tipo::codigo" -> cantidad real
 * @param bounds { iseSamplesPerYear: [min, max], rerunPct: [min, max], qcFailurePct: [min, max] }
 * @param discarded candidatos descartados en busquedas anteriores (no se vuelven a simular)
 */
function search(model, realByKey, bounds, {
  rounds = 8, perRound = 40, eliteShare = 0.25, scenarios = 2000, seed = 20261016, posterior = null,
  discarded = [], minSeparation = 0.02, finalScenarios = 20000,
} = {}) {
  const started = Date.now();
  const random = simulation.createRandom(seed);
  const evaluated = [];
  const discardedPoints = [...discarded];
  let box = Object.fromEntries(PARAMETERS.map(({ key }) => [key, [...bounds[key]]]));
  const history = [];
  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    const candidates = [];
    let attempts = 0;
    while (candidates.length < perRound && attempts < perRound * 50) {
      attempts += 1;
      const candidate = Object.fromEntries(PARAMETERS.map(({ key, integer }) => {
        const value = random.uniform(box[key][0], box[key][1]);
        return [key, integer ? Math.round(value) : round(value, 3)];
      }));
      // Lo que ya se descarto (o ya se evaluo) no se vuelve a simular.
      const tooClose = (list) => list.some((point) => separation(point, candidate, bounds) < minSeparation);
      if (tooClose(discardedPoints) || tooClose(evaluated.map((entry) => entry.params)) || tooClose(candidates)) continue;
      candidates.push(candidate);
    }
    if (!candidates.length) break;
    const scored = candidates.map((params) => ({
      params,
      ...scoreAgainstReal(predictWith(model, params, { scenarios, seed: seed + roundIndex, posterior }), realByKey),
      round: roundIndex + 1,
    }));
    const pool = [...evaluated.filter((entry) => entry.status === "elite"), ...scored]
      .sort((a, b) => b.matches - a.matches || a.error - b.error);
    const eliteCount = Math.max(2, Math.round(perRound * eliteShare));
    const elite = new Set(pool.slice(0, eliteCount));
    pool.forEach((entry) => {
      entry.status = elite.has(entry) ? "elite" : "discarded";
      if (entry.status === "discarded") discardedPoints.push(entry.params);
    });
    scored.forEach((entry) => evaluated.push(entry));
    const eliteList = [...elite];
    box = Object.fromEntries(PARAMETERS.map(({ key, integer }) => {
      const values = eliteList.map((entry) => entry.params[key]);
      const [initialMin, initialMax] = bounds[key];
      const margin = ((initialMax - initialMin) * 0.02);
      const min = Math.max(initialMin, Math.min(...values) - margin);
      const max = Math.min(initialMax, Math.max(...values) + margin);
      return [key, integer ? [Math.floor(min), Math.ceil(max)] : [round(min, 3), round(max, 3)]];
    }));
    history.push({
      round: roundIndex + 1,
      candidates: scored.length,
      bestMatches: eliteList[0].matches,
      bestError: eliteList[0].error,
      discarded: scored.filter((entry) => entry.status === "discarded").length,
      box,
    });
  }
  const ranked = evaluated.filter((entry) => entry.status === "elite").sort((a, b) => b.matches - a.matches || a.error - b.error);
  const best = ranked[0] || null;
  // El mejor se confirma con mas escenarios (las rondas usan pocos para descartar rapido).
  const confirmed = best
    ? scoreAgainstReal(predictWith(model, best.params, { scenarios: finalScenarios, seed: seed + 999, posterior }), realByKey)
    : null;
  return {
    best: best ? { params: best.params, ...confirmed } : null,
    history,
    evaluated: evaluated.map(({ params, matches, error, status, round: r }) => ({ params, matches, error, status, round: r })),
    durationMs: Date.now() - started,
  };
}

module.exports = { PARAMETERS, COINCIDENCE_SHARE, search, scoreAgainstReal, coincides, __testables: { separation, predictWith } };
