/**
 * Simulacion de escenarios (Monte Carlo) del consumo de reactivos, calibradores, controles y
 * materiales durante el proceso. Archivo puro y reproducible (generador con semilla).
 *
 * Parte del modelo que arma consumableRules.service (lo que dicen las fichas y la estadistica del
 * cliente) y en cada escenario sortea lo que puede pasar en el laboratorio:
 *   - demanda: error de la estadistica, crecimiento anual, estacionalidad y ruido mensual;
 *   - repeticiones de pruebas y perdida por volumen muerto del kit;
 *   - si la demanda registrada ya trae las pruebas de control y calibracion;
 *   - kit guardado a bordo todo el tiempo (vence por estabilidad) o refrigerado;
 *   - dias de trabajo por semana, corridas de control por dia (ficha, laboratorio o por turno);
 *   - controles fuera de rango (corridas repetidas y recalibraciones);
 *   - calibrar antes de lo que pide la ficha, y cambios de lote de reactivo;
 *   - alicuotar y congelar calibradores y controles cuando la ficha lo permite;
 *   - cada cuantos meses se entrega (cada entrega se redondea a presentaciones completas).
 * El resultado por producto es una distribucion (media, P10, P50, P90, P95) y un perfil de
 * entregas en el tiempo. La cantidad recomendada es el P90: cubre 9 de cada 10 escenarios.
 */

const DAYS_PER_MONTH = 30;
const MIN_SCENARIOS = 5000;
const MAX_SCENARIOS = 200000;
const RECOMMENDED_PERCENTILE = 90;
const MUST_ALIQUOT_BELOW_DAYS = 7;

// Rango de cada variable del escenario. Son supuestos explicitos, no datos medidos: se muestran
// en pantalla y se afinan cuando haya casos validados.
const SCENARIO_VARIABLES = Object.freeze([
  { key: "demandError", label: "Error de la estadistica del cliente", range: "lognormal, desviacion 12 %" },
  { key: "annualGrowth", label: "Crecimiento anual de la demanda", range: "-5 % a +15 %" },
  { key: "seasonality", label: "Estacionalidad (amplitud)", range: "0 a 15 %" },
  { key: "monthlyNoise", label: "Variacion mes a mes", range: "lognormal, desviacion 8 %" },
  { key: "rerunRate", label: "Pruebas repetidas", range: "1 % a 6 %" },
  { key: "deadVolumeLoss", label: "Perdida por volumen muerto del kit", range: "0 a 5 %" },
  { key: "qcTestsInDemand", label: "La demanda ya incluye pruebas de control y calibracion", range: "50 % de los escenarios" },
  { key: "reagentOnboard", label: "Kit a bordo todo el tiempo (vence por estabilidad)", range: "30 % de los escenarios" },
  { key: "workDaysPerWeek", label: "Dias de trabajo por semana", range: "lo declarado por el laboratorio, ±1 dia en 20 %" },
  { key: "qcSchedule", label: "Corridas de control por dia", range: "ficha 50 %, laboratorio 30 %, una por turno 20 %" },
  { key: "qcFailureRate", label: "Controles fuera de rango", range: "1 % a 4 % de las corridas" },
  { key: "recalibrationOnFailure", label: "Recalibracion tras control fuera de rango", range: "20 % a 50 % de los fallos" },
  { key: "calibrationIntervalFactor", label: "Calibrar antes de lo que pide la ficha", range: "50 % a 100 % del intervalo" },
  { key: "lotsPerYear", label: "Lotes de reactivo por año", range: "1 a 6" },
  { key: "aliquotFreeze", label: "Alicuotar y congelar si la ficha lo permite", range: "60 % de los escenarios" },
  { key: "deliveryEveryMonths", label: "Entrega cada", range: "1, 2 o 3 meses" },
  { key: "iseSamplesRatio", label: "Muestras ISE por prueba de reactivo (si el laboratorio no lo declara)", range: "2 % a 60 %" },
  { key: "planningShare", label: "Fraccion de lo calculado que se planifica (control, calibrador, material)", range: "1 sin calibrar; aprendida de lo realmente entregado al calibrar (5 % a 600 %)" },
]);

// Generador con semilla (mulberry32): el mismo modelo y semilla dan el mismo resultado.
function createRandom(seed) {
  let state = (Number(seed) >>> 0) || 1;
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    const u = Math.max(next(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return {
    next,
    uniform: (min, max) => min + (max - min) * next(),
    chance: (probability) => next() < probability,
    integer: (min, max) => min + Math.floor(next() * (max - min + 1)),
    // Media 1: multiplica sin sesgar el promedio.
    lognormal: (sigma) => Math.exp(sigma * normal() - (sigma * sigma) / 2),
    poisson: (lambda) => {
      if (!(lambda > 0)) return 0;
      if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal()));
      const limit = Math.exp(-lambda);
      let k = 0;
      let p = next();
      while (p > limit) { k += 1; p *= next(); }
      return k;
    },
  };
}

const aroundOr = (random, value, min, max) => (Number.isFinite(value) && value >= 0
  ? random.uniform(value * 0.8, value * 1.2)
  : random.uniform(min, max));

// Fraccion planificada por tipo: 1 salvo al calibrar, donde se explora en escala logaritmica.
const logUniform = (random, min, max) => Math.exp(random.uniform(Math.log(min), Math.log(max)));

function sampleScenario(random, environment = {}, { explorePlanning = false } = {}) {
  const declaredWorkDays = Math.min(Math.max(Number(environment.workDaysPerWeek) || 7, 1), 7);
  let workDaysPerWeek = declaredWorkDays;
  if (random.chance(0.2)) workDaysPerWeek = Math.min(7, Math.max(1, declaredWorkDays + (random.chance(0.5) ? 1 : -1)));
  const qcRoll = random.next();
  let qcSchedule = "per_shift";
  if (qcRoll < 0.5) qcSchedule = "document";
  else if (qcRoll < 0.8) qcSchedule = "laboratory";
  return {
    demandError: random.lognormal(0.12),
    annualGrowth: random.uniform(-0.05, 0.15),
    seasonality: random.uniform(0, 0.15),
    seasonPhase: random.uniform(0, 12),
    monthlyNoise: 0.08,
    // Con la estadistica del laboratorio se sortea alrededor del dato (±20 %); sin ella, el rango tipico.
    rerunRate: aroundOr(random, environment.rerunRate, 0.01, 0.06),
    deadVolumeLoss: random.uniform(0, 0.05),
    qcTestsInDemand: random.chance(0.5),
    reagentOnboard: random.chance(0.3),
    workDaysPerWeek,
    qcSchedule,
    qcFailureRate: aroundOr(random, environment.qcFailureRate, 0.01, 0.04),
    recalibrationOnFailure: random.uniform(0.2, 0.5),
    calibrationIntervalFactor: random.uniform(0.5, 1),
    lotsPerYear: random.integer(1, 6),
    aliquotFreeze: random.chance(0.6),
    deliveryEveryMonths: [1, 2, 3][random.integer(0, 2)],
    iseSamplesRatio: random.uniform(0.02, 0.6),
    planningShare: explorePlanning
      ? { control: logUniform(random, 0.05, 6), calibrador: logUniform(random, 0.05, 6), material: logUniform(random, 0.05, 6) }
      : { control: 1, calibrador: 1, material: 1 },
  };
}

// Corridas de control por dia de trabajo segun el esquema sorteado. null = no hay base.
function runsPerDayFor(reagent, environment, scenario) {
  const shifts = Number(environment.shifts) || null;
  const hours = Math.min((shifts || 0) * (Number(environment.hoursPerShift) || 0), 24) || 24;
  const fromDocument = reagent.qcIntervalHours
    ? (reagent.qcIntervalHours >= 24 ? 24 / reagent.qcIntervalHours : Math.ceil(hours / reagent.qcIntervalHours))
    : null;
  if (scenario.qcSchedule === "laboratory" && environment.laboratoryRunsPerDay) return environment.laboratoryRunsPerDay;
  if (scenario.qcSchedule === "per_shift" && shifts && fromDocument) return Math.max(fromDocument, shifts);
  return fromDocument || environment.laboratoryRunsPerDay || null;
}

// Envases que cubren un calendario de usos (mismo criterio que la regla del documento).
function containersForDays(days, stabilityDays) {
  const window = Math.max(stabilityDays || 0, 1);
  let containers = 0;
  let coveredUntil = -Infinity;
  days.forEach((day) => {
    if (day < coveredUntil) return;
    containers += 1;
    coveredUntil = day + window;
  });
  return containers;
}

const monthOf = (day) => Math.min(Math.floor(day / DAYS_PER_MONTH), Infinity);

// Misma regla que consumableEquipmentManual, con las muestras ISE del escenario.
function manualQuantityFor(kind, processDays, iseTests) {
  if (kind === "iseElectrode") return Math.ceil(Math.max(processDays / 60, iseTests / 9000) - 1e-9);
  if (kind === "iseDiluent") return Math.ceil(Math.ceil(Math.max(processDays / 42, (iseTests * 0.45) / 2000) - 1e-9) / 2 - 1e-9);
  return 0;
}

// Un escenario completo. Devuelve, por producto, lo necesario acumulado mes a mes.
function simulateScenario(model, scenario, random) {
  const months = model.months;
  const processDays = months * DAYS_PER_MONTH;
  const environment = model.environment || {};
  const workFraction = scenario.workDaysPerWeek / 7;
  const controlLevels = Number(environment.controlLevels) || 1;
  const cumulative = new Map();
  const componentUse = new Map();
  const useOf = (code) => {
    if (!componentUse.has(code)) componentUse.set(code, { days: [], runs: 0, volumeUl: 0, events: 0 });
    return componentUse.get(code);
  };
  const lotChanges = Math.max(Math.ceil((scenario.lotsPerYear * months) / 12) - 1, 0);

  model.reagents.forEach((reagent) => {
    const runsPerDay = runsPerDayFor(reagent, environment, scenario);
    const workDaysPerMonth = DAYS_PER_MONTH * workFraction;
    const routineRunsPerMonth = runsPerDay ? workDaysPerMonth * runsPerDay : 0;
    const totalRoutineRuns = routineRunsPerMonth * months;
    const failures = random.poisson(totalRoutineRuns * scenario.qcFailureRate);

    // Calendario de calibraciones del reactivo: inicio, intervalo (acortado), cambios de lote y
    // recalibraciones por control fuera de rango.
    const calibrationDays = [];
    if (reagent.calibrationDeclared) {
      calibrationDays.push(0);
      const interval = reagent.calibrationIntervalDays ? reagent.calibrationIntervalDays * scenario.calibrationIntervalFactor : null;
      if (interval) for (let day = interval; day < processDays; day += interval) calibrationDays.push(Math.floor(day));
      if (reagent.lotChangeDeclared) {
        for (let lot = 1; lot <= lotChanges; lot += 1) calibrationDays.push(Math.floor((lot * processDays) / (lotChanges + 1)));
      }
      const recalibrations = random.poisson(failures * scenario.recalibrationOnFailure);
      for (let index = 0; index < recalibrations; index += 1) calibrationDays.push(Math.floor(random.uniform(0, processDays)));
      calibrationDays.sort((a, b) => a - b);
    }
    const calibrationsByMonth = new Array(months).fill(0);
    calibrationDays.forEach((day) => { calibrationsByMonth[Math.min(monthOf(day), months - 1)] += 1; });

    const testsPerPack = reagent.testsPerPack;
    const monthlyBase = reagent.processDemand / months;
    const cumulativeKits = new Array(months);
    let tests = 0;
    let kits = 0;
    let runsTotal = 0;
    for (let month = 0; month < months; month += 1) {
      const trend = (1 + scenario.annualGrowth) ** ((month + 0.5) / 12);
      const season = 1 + scenario.seasonality * Math.sin((2 * Math.PI * (month + scenario.seasonPhase)) / 12);
      // Con estadistica real del cliente no se sortea el error de la estadistica (solo tendencia,
      // estacionalidad y variacion mensual).
      const demandError = reagent.fromSheet ? 1 : scenario.demandError;
      const patient = monthlyBase * demandError * trend * season * random.lognormal(scenario.monthlyNoise);
      let runs = routineRunsPerMonth * (1 + scenario.qcFailureRate);
      if (reagent.qcAfterCalibration) runs += calibrationsByMonth[month];
      const kitsBefore = kits;
      const qualityTests = scenario.qcTestsInDemand
        ? 0
        : runs * controlLevels + calibrationsByMonth[month] * reagent.replicates * (reagent.calibratorLevels || 1);
      tests += (patient * (1 + scenario.rerunRate) + qualityTests) / (1 - scenario.deadVolumeLoss);
      kits = Math.ceil(tests / testsPerPack - 1e-9);
      if (scenario.reagentOnboard && reagent.onboardDays) {
        kits = Math.max(kits, Math.ceil(((month + 1) * DAYS_PER_MONTH) / reagent.onboardDays - 1e-9));
      }
      if (reagent.qcPerKit) runs += kits - kitsBefore;
      runsTotal += runs;
      cumulativeKits[month] = kits;
    }
    cumulative.set(reagent.key, cumulativeKits);

    reagent.calibrators.forEach((code) => {
      const use = useOf(code);
      calibrationDays.forEach((day) => use.days.push(day));
      use.events += calibrationDays.length;
      if (reagent.sampleVolumeUl) use.volumeUl += calibrationDays.length * reagent.replicates * reagent.sampleVolumeUl;
    });
    reagent.controls.forEach((code) => {
      const use = useOf(code);
      use.runs = Math.max(use.runs, runsTotal);
      if (reagent.sampleVolumeUl) use.volumeUl += runsTotal * reagent.sampleVolumeUl;
    });
  });

  // Muestras ISE del proceso: las declaradas por el laboratorio o, sin dato, una fraccion de la demanda.
  const reagentDemand = model.reagents.reduce((sum, reagent) => sum + (reagent.processDemand || 0), 0);
  const iseTests = Number(environment.iseTests) > 0 ? Number(environment.iseTests) : reagentDemand * (scenario.iseSamplesRatio || 0);

  model.components.forEach((component) => {
    const use = componentUse.get(component.code) || null;
    // Partes del equipo que dependen de las muestras ISE (manual del equipo, ver consumableEquipmentManual).
    if (component.manualKind) {
      const quantity = manualQuantityFor(component.manualKind, processDays, iseTests);
      cumulative.set(component.key, Array.from({ length: months }, (_, month) => Math.ceil((quantity * (month + 1)) / months - 1e-9)));
      return;
    }
    // Controles: si abierto dura menos de una semana y la ficha permite congelar, el laboratorio
    // alicuota siempre; nadie abre un vial por corrida (sin esto el P90 se disparaba, ej. 928 contra P50
    // 15). Solo controles: en calibradores (se usan por calibracion) forzarlo empeoraba la prediccion
    // (Hospital General Latacunga: error 49 % -> 58 %).
    const mustAliquot = component.itemType === "control" && component.frozenDays
      && (component.stabilityDays || 0) < MUST_ALIQUOT_BELOW_DAYS;
    const frozen = (scenario.aliquotFreeze || mustAliquot) && component.frozenDays && component.frozenDays > (component.stabilityDays || 0);
    const stabilityDays = frozen ? component.frozenDays : component.stabilityDays;
    let containers = null;
    if (component.itemType === "material" || !use) {
      containers = stabilityDays >= 1 ? Math.ceil(processDays / stabilityDays - 1e-9) : null;
    } else if (component.itemType === "calibrador") {
      const days = [...use.days].sort((a, b) => a - b);
      containers = component.singleUse ? use.events : containersForDays(days, stabilityDays);
    } else {
      const runs = Math.round(use.runs);
      if (component.singleUse || !(stabilityDays >= 1)) containers = runs;
      else containers = Math.min(runs, Math.ceil(processDays / stabilityDays - 1e-9));
    }
    if (containers === null) return;
    if (use && component.containerVolumeMl && !component.singleUse) {
      containers = Math.max(containers, Math.ceil(use.volumeUl / 1000 / component.containerVolumeMl - 1e-9));
    }
    const share = scenario.planningShare?.[component.itemType] ?? 1;
    if (share !== 1 && containers > 0) containers = Math.max(1, Math.ceil(containers * share - 1e-9));
    // Entregas: lo que se necesita se reparte en el tiempo y cada entrega va en presentaciones completas.
    const perPack = component.containersPerPack || 1;
    const cumulativePacks = new Array(months);
    let delivered = 0;
    for (let month = 0; month < months; month += 1) {
      const isDelivery = month % scenario.deliveryEveryMonths === 0;
      if (isDelivery) {
        const coverUntil = Math.min(month + scenario.deliveryEveryMonths, months);
        const neededContainers = Math.ceil((containers * coverUntil) / months - 1e-9);
        const neededPacks = Math.ceil(neededContainers / perPack - 1e-9);
        delivered = Math.max(delivered, neededPacks);
      }
      cumulativePacks[month] = delivered;
    }
    cumulative.set(component.key, cumulativePacks);
  });
  return cumulative;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

/**
 * Corre los escenarios y resume por producto.
 * @returns {{ scenarios, seed, durationMs, variables, products, sampledVariables }}
 */
function runSimulation(model, { scenarios = MIN_SCENARIOS, seed = 20261014, posterior = null } = {}) {
  const count = Math.min(Math.max(Math.round(Number(scenarios) || MIN_SCENARIOS), MIN_SCENARIOS), MAX_SCENARIOS);
  // Con escenarios aceptados de procesos reales, se sortea entre ellos en vez del rango supuesto.
  const draw = posterior?.length
    ? require("./consumableCalibration").posteriorSampler(posterior, model.environment)
    : (random, environment) => sampleScenario(random, environment);
  const started = Date.now();
  const random = createRandom(seed);
  const products = [...model.reagents, ...model.components];
  const months = model.months;
  const totals = new Map(products.map((product) => [product.key, new Float64Array(count)]));
  const monthlySums = new Map(products.map((product) => [product.key, new Float64Array(months)]));
  const variableSums = {};
  let deliveryCounts = { 1: 0, 2: 0, 3: 0 };

  for (let index = 0; index < count; index += 1) {
    const scenario = draw(random, model.environment);
    deliveryCounts[scenario.deliveryEveryMonths] += 1;
    Object.entries(scenario).forEach(([key, value]) => {
      if (typeof value === "number") variableSums[key] = (variableSums[key] || 0) + value;
      if (typeof value === "boolean") variableSums[key] = (variableSums[key] || 0) + (value ? 1 : 0);
    });
    const cumulative = simulateScenario(model, scenario, random);
    cumulative.forEach((series, key) => {
      totals.get(key)[index] = series[months - 1];
      const sums = monthlySums.get(key);
      for (let month = 0; month < months; month += 1) sums[month] += series[month];
    });
  }

  const summaries = products.map((product) => {
    const values = Array.from(totals.get(product.key)).sort((a, b) => a - b);
    const simulated = monthlySums.get(product.key).some((value) => value > 0) || values.some((value) => value > 0);
    if (!simulated && !(product.deterministicQuantity > 0) && !(product.formulaQuantity > 0) && !(product.manualQuantity > 0) && !(product.historyQuantity > 0) && !product.reference) return null;
    // Sin datos para simular (ficha incompleta) pero con formula validada: sin rango, solo la formula.
    if (!simulated) {
      return {
        key: product.key, itemType: product.itemType, supplierCode: product.code, name: product.name, unit: product.unit,
        deterministicQuantity: product.deterministicQuantity ?? null, formulaQuantity: product.formulaQuantity ?? null,
        manualQuantity: product.manualQuantity ?? null,
        historyQuantity: product.historyQuantity ?? null,
        reference: product.reference ?? null,
        fromSheet: product.fromSheet === true,
        calibrated: Boolean(posterior?.length),
        mean: null, min: null, p10: null, p50: null, p90: null, p95: null, max: null,
        recommended: product.manualQuantity ?? product.formulaQuantity ?? product.deterministicQuantity ?? null,
        notSimulated: true,
        deliveriesByQuarter: [],
      };
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / count;
    const p90 = percentile(values, RECOMMENDED_PERCENTILE);
    // Perfil de entregas: forma media acumulada, llevada al P90.
    const meanCumulative = Array.from(monthlySums.get(product.key)).map((sum) => sum / count);
    const finalMean = meanCumulative[months - 1] || 0;
    const byQuarter = [];
    for (let start = 0; start < months; start += 3) {
      const end = Math.min(start + 3, months) - 1;
      const before = start > 0 ? meanCumulative[start - 1] : 0;
      const share = finalMean > 0 ? (meanCumulative[end] - before) / finalMean : 0;
      byQuarter.push({ fromMonth: start + 1, toMonth: end + 1, mean: Number((share * mean).toFixed(2)), p90: Math.ceil(share * p90 - 1e-9) });
    }
    return {
      key: product.key,
      itemType: product.itemType,
      supplierCode: product.code,
      name: product.name,
      unit: product.unit,
      deterministicQuantity: product.deterministicQuantity ?? null,
      formulaQuantity: product.formulaQuantity ?? null,
      historyQuantity: product.historyQuantity ?? null,
      reference: product.reference ?? null,
      fromSheet: product.fromSheet === true,
      calibrated: Boolean(posterior?.length),
      mean: Number(mean.toFixed(2)),
      min: values[0],
      p10: percentile(values, 10),
      p50: percentile(values, 50),
      p90,
      p95: percentile(values, 95),
      max: values[values.length - 1],
      recommended: p90,
      deliveriesByQuarter: byQuarter,
    };
  }).filter(Boolean);

  const sampledVariables = {};
  Object.entries(variableSums).forEach(([key, sum]) => { sampledVariables[key] = Number((sum / count).toFixed(4)); });
  sampledVariables.deliveryEveryMonths = Object.fromEntries(Object.entries(deliveryCounts).map(([key, value]) => [key, Number((value / count).toFixed(3))]));

  return {
    scenarios: count,
    seed,
    calibrated: Boolean(posterior?.length),
    recommendedPercentile: RECOMMENDED_PERCENTILE,
    durationMs: Date.now() - started,
    variables: SCENARIO_VARIABLES,
    sampledVariables,
    products: summaries,
  };
}

/**
 * Perfil estadistico del cliente para buscar clientes parecidos (mismo equipo).
 */
function buildProfile(model) {
  const monthlyDemand = model.reagents.reduce((sum, reagent) => sum + reagent.processDemand, 0) / (model.months || 1);
  return {
    equipmentCode: model.equipmentCode || null,
    months: model.months,
    monthlyDemand: Number(monthlyDemand.toFixed(2)),
    reagentCount: model.reagents.length,
    workDaysPerWeek: Number(model.environment?.workDaysPerWeek) || null,
    shifts: Number(model.environment?.shifts) || null,
    controlLevels: Number(model.environment?.controlLevels) || null,
  };
}

// Distancia entre perfiles: demanda en escala logaritmica, plazo, cantidad de pruebas y jornada.
function profileDistance(a, b) {
  const logDemand = Math.abs(Math.log((a.monthlyDemand || 1) / (b.monthlyDemand || 1)));
  const months = Math.abs((a.months || 0) - (b.months || 0)) / 60;
  const reagents = Math.abs((a.reagentCount || 0) - (b.reagentCount || 0)) / Math.max(a.reagentCount || 1, b.reagentCount || 1, 1);
  const workDays = Math.abs((a.workDaysPerWeek || 7) - (b.workDaysPerWeek || 7)) / 7;
  const shifts = Math.abs((a.shifts || 1) - (b.shifts || 1)) / 3;
  return Number((logDemand + months + reagents + workDays + shifts).toFixed(4));
}

/**
 * Igual que runSimulation pero en un hilo aparte (worker_threads), para no bloquear el backend
 * mientras corren miles de escenarios. El resultado es identico (mismo modelo y semilla).
 */
function runSimulationAsync(model, options = {}) {
  const { Worker } = require("worker_threads");
  return new Promise((resolve, reject) => {
    const worker = new Worker(require("path").join(__dirname, "consumableSimulation.worker.js"), {
      workerData: { model, options },
    });
    let settled = false;
    worker.once("message", (message) => {
      settled = true;
      if (message?.ok) resolve(message.result);
      else reject(new Error(message?.message || "La simulacion fallo"));
      worker.terminate().catch(() => {});
    });
    worker.once("error", (error) => { if (!settled) { settled = true; reject(error); } });
    worker.once("exit", (code) => {
      if (!settled) { settled = true; reject(new Error(`La simulacion termino sin resultado (codigo ${code})`)); }
    });
  });
}

module.exports = {
  runSimulationAsync,
  MIN_SCENARIOS,
  MAX_SCENARIOS,
  SCENARIO_VARIABLES,
  runSimulation,
  buildProfile,
  profileDistance,
  __testables: { createRandom, sampleScenario, simulateScenario, runsPerDayFor, containersForDays, percentile, manualQuantityFor },
};
