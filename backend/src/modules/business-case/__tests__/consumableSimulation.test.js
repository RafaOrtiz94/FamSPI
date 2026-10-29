const simulation = require("../consumableSimulation");
const { __testables: serviceTestables } = require("../consumableSimulation.service");

const { createRandom, sampleScenario, runsPerDayFor, containersForDays, percentile } = simulation.__testables;

const model = (overrides = {}) => ({
  equipmentCode: "EQ",
  equipmentName: "Equipo",
  months: 12,
  environment: { workDaysPerWeek: 6, shifts: 2, hoursPerShift: 8, laboratoryRunsPerDay: 2, controlLevels: 2 },
  reagents: [{
    key: "reactivo::1",
    itemType: "reactivo",
    code: "1",
    name: "Reactivo",
    unit: "kit",
    deterministicQuantity: 20,
    processDemand: 6000,
    testsPerPack: 300,
    onboardDays: 28,
    calibrationIntervalDays: 30,
    calibrationDeclared: true,
    lotChangeDeclared: true,
    replicates: 2,
    calibratorLevels: 1,
    qcIntervalHours: 24,
    qcAfterCalibration: true,
    qcPerKit: false,
    sampleVolumeUl: 10,
    calibrators: ["10"],
    controls: ["20"],
  }],
  components: [
    { key: "calibrador::10", itemType: "calibrador", code: "10", name: "Cal", unit: "presentacion", deterministicQuantity: 3, stabilityDays: 5, frozenDays: 30, containerVolumeMl: 1, containersPerPack: 4, singleUse: false },
    { key: "control::20", itemType: "control", code: "20", name: "Ctl", unit: "presentacion", deterministicQuantity: 5, stabilityDays: 7, frozenDays: null, containerVolumeMl: 5, containersPerPack: 4, singleUse: false },
    { key: "material::30", itemType: "material", code: "30", name: "Mat", unit: "envase", deterministicQuantity: 4, stabilityDays: 90, frozenDays: null, containerVolumeMl: null, containersPerPack: null, singleUse: false },
  ],
  ...overrides,
});

describe("consumableSimulation", () => {
  test("el generador con semilla es reproducible", () => {
    const a = createRandom(7); const b = createRandom(7);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    expect(createRandom(8).next()).not.toBe(createRandom(7).next());
  });

  test("los escenarios sortean dentro de los rangos declarados", () => {
    const random = createRandom(3);
    for (let index = 0; index < 500; index += 1) {
      const scenario = sampleScenario(random, { workDaysPerWeek: 6 });
      expect(scenario.annualGrowth).toBeGreaterThanOrEqual(-0.05);
      expect(scenario.annualGrowth).toBeLessThanOrEqual(0.15);
      expect(scenario.calibrationIntervalFactor).toBeGreaterThanOrEqual(0.5);
      expect([1, 2, 3]).toContain(scenario.deliveryEveryMonths);
      expect([5, 6, 7]).toContain(scenario.workDaysPerWeek);
      expect(scenario.lotsPerYear).toBeGreaterThanOrEqual(1);
      expect(scenario.lotsPerYear).toBeLessThanOrEqual(6);
    }
  });

  test("corridas de control por dia segun el esquema sorteado", () => {
    const reagent = { qcIntervalHours: 24 };
    const environment = { shifts: 3, hoursPerShift: 8, laboratoryRunsPerDay: 2 };
    expect(runsPerDayFor(reagent, environment, { qcSchedule: "document" })).toBe(1);
    expect(runsPerDayFor(reagent, environment, { qcSchedule: "laboratory" })).toBe(2);
    expect(runsPerDayFor(reagent, environment, { qcSchedule: "per_shift" })).toBe(3);
    expect(runsPerDayFor({ qcIntervalHours: null }, {}, { qcSchedule: "document" })).toBeNull();
  });

  test("utilidades: envases por calendario y percentiles", () => {
    expect(containersForDays([0, 2, 6, 7], 5)).toBe(2);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentile([], 50)).toBeNull();
  });

  test("minimo 5000 escenarios, mismo resultado con la misma semilla y percentiles ordenados", () => {
    const first = simulation.runSimulation(model(), { scenarios: 10, seed: 42 });
    const second = simulation.runSimulation(model(), { scenarios: 5000, seed: 42 });
    expect(first.scenarios).toBe(5000);
    expect(first.products).toEqual(second.products);
    expect(first.products.map((product) => product.key)).toEqual(["reactivo::1", "calibrador::10", "control::20", "material::30"]);
    first.products.forEach((product) => {
      expect(product.p10).toBeLessThanOrEqual(product.p50);
      expect(product.p50).toBeLessThanOrEqual(product.p90);
      expect(product.p90).toBeLessThanOrEqual(product.p95);
      expect(product.recommended).toBe(product.p90);
      const quarters = product.deliveriesByQuarter;
      expect(quarters).toHaveLength(4);
      expect(quarters[0]).toMatchObject({ fromMonth: 1, toMonth: 3 });
    });
    const reagent = first.products[0];
    // 6000 pruebas en 300 por kit = 20 kits sin variacion; las repeticiones y perdidas suben el P50.
    expect(reagent.p50).toBeGreaterThanOrEqual(20);
    expect(reagent.p10).toBeGreaterThanOrEqual(15);
    expect(first.sampledVariables.deliveryEveryMonths).toBeDefined();
  });

  test("perfil y distancia entre clientes", () => {
    const profile = simulation.buildProfile(model());
    expect(profile).toMatchObject({ equipmentCode: "EQ", months: 12, monthlyDemand: 500, reagentCount: 1, workDaysPerWeek: 6, shifts: 2, controlLevels: 2 });
    expect(simulation.profileDistance(profile, profile)).toBe(0);
    const bigger = { ...profile, monthlyDemand: 5000 };
    const longer = { ...profile, months: 60 };
    expect(simulation.profileDistance(profile, bigger)).toBeGreaterThan(simulation.profileDistance(profile, { ...profile, monthlyDemand: 600 }));
    expect(simulation.profileDistance(profile, longer)).toBeCloseTo(0.8, 4);
  });

  test("cobertura contra cantidades validadas", () => {
    const products = [
      { key: "control::20", p10: 4, p50: 5, p90: 8 },
      { key: "calibrador::10", p10: 2, p50: 3, p90: 4 },
    ];
    const coverage = serviceTestables.measureCoverage(products, [
      { equipment_id: 3, item_type: "control", supplier_code: "20", validated_qty: 6 },
      { equipment_id: 3, item_type: "calibrador", supplier_code: "10", validated_qty: 9 },
      { equipment_id: 4, item_type: "control", supplier_code: "20", validated_qty: 1 },
    ], 3);
    expect(coverage).toMatchObject({ validatedCount: 2, withinP10P90: 1, p50: { cases: 2 }, p90: { cases: 2 } });
  });
});

describe("prediccion automatica con el historico", () => {
  const { predictFromHistory, seedFromFingerprint } = serviceTestables;

  test("con escenarios calibrados contra procesos reales, la prediccion es su mediana", () => {
    expect(predictFromHistory({ p50: 10, p90: 14, calibrated: true }))
      .toEqual({ quantity: 10, upper: 14, basis: "calibrated_scenarios", calibratedWith: 0, factor: null });
  });

  test("sin calibracion, la mediana de la simulacion; sin simulacion, la formula o el P90", () => {
    expect(predictFromHistory({ p50: 9, p90: 150, formulaQuantity: 15 })).toMatchObject({ quantity: 9, basis: "simulation_p50" });
    expect(predictFromHistory({ p50: null, p90: null, formulaQuantity: 15 })).toMatchObject({ quantity: 15, basis: "validated_formula" });
    expect(predictFromHistory({ p50: null, p90: null, formulaQuantity: null })).toMatchObject({ quantity: null, basis: "simulation_p90" });
  });

  test("la semilla sale de la huella: misma entrada, mismo resultado", () => {
    expect(seedFromFingerprint("00ff00aa11")).toBe(seedFromFingerprint("00ff00aa99"));
    expect(seedFromFingerprint("00ff00aa")).not.toBe(seedFromFingerprint("00ff00ab"));
    expect(seedFromFingerprint(null)).toBe(20261014);
  });
});

describe("simulacion en hilo aparte", () => {
  test("da el mismo resultado que en el hilo principal", async () => {
    const options = { scenarios: 5000, seed: 7 };
    const inWorker = await simulation.runSimulationAsync(model(), options);
    const inline = simulation.runSimulation(model(), options);
    expect(inWorker.products).toEqual(inline.products);
    expect(inWorker.scenarios).toBe(5000);
    // Arranca un hilo y corre 2 x 5000 escenarios: con la maquina cargada supera los 5 s por defecto.
  }, 60000);
});

describe("prediccion final por tipo de producto", () => {
  test("reactivo con DET/AÑO del Sheet: la cantidad de su demanda, sin prediccion", () => {
    expect(serviceTestables.predictFromHistory({ fromSheet: true, deterministicQuantity: 12, p50: 13, p90: 16 }, []))
      .toEqual({ quantity: 12, basis: "sheet_demand", calibratedWith: 0, factor: null });
  });
});

describe("partes del equipo en la prediccion", () => {
  test("parte del equipo con intervalo del manual: se cuenta, no se predice", () => {
    expect(serviceTestables.predictFromHistory({ itemType: "material", manualQuantity: 8, p50: null, p90: null }, [{ p50: 4, validated: 9, distance: 0 }]))
      .toEqual({ quantity: 8, basis: "equipment_manual", calibratedWith: 0, factor: null });
  });

  test("la simulacion conserva la cantidad del manual sin rango", () => {
    const result = simulation.runSimulation({
      ...model(),
      components: [{ key: "material::4813707001", itemType: "material", code: "4813707001", name: "Lamp", unit: "lampara", deterministicQuantity: 15, formulaQuantity: null, manualQuantity: 15 }],
    }, { scenarios: 5000, seed: 1 });
    expect(result.products.find((p) => p.key === "material::4813707001")).toMatchObject({ manualQuantity: 15, recommended: 15, notSimulated: true });
  });
});

describe("alicuotar cuando el control dura poco abierto", () => {
  test("si abierto dura menos de 7 dias y se puede congelar, nunca se abre un vial por corrida", () => {
    const base = model();
    const control = { ...base.components[1], stabilityDays: 0.2, frozenDays: 30, containerVolumeMl: null };
    const result = simulation.runSimulation({ ...base, components: [control] }, { scenarios: 5000, seed: 5 });
    const product = result.products.find((p) => p.key === "control::20");
    // 12 meses / 30 dias congelado = 12 envases -> 3 presentaciones; sin la regla el P90 seria cientos.
    expect(product.p90).toBeLessThanOrEqual(5);
  });
});

describe("estadisticas del laboratorio en los escenarios", () => {
  test("con el dato del laboratorio se sortea alrededor de el (±20 %)", () => {
    const random = simulation.__testables.createRandom(7);
    for (let i = 0; i < 200; i += 1) {
      const scenario = simulation.__testables.sampleScenario(random, { rerunRate: 0.1, qcFailureRate: 0 });
      expect(scenario.rerunRate).toBeGreaterThanOrEqual(0.08);
      expect(scenario.rerunRate).toBeLessThanOrEqual(0.12);
      expect(scenario.qcFailureRate).toBe(0);
    }
    const free = simulation.__testables.sampleScenario(random, {});
    expect(free.rerunRate).toBeGreaterThanOrEqual(0.01);
    expect(free.rerunRate).toBeLessThanOrEqual(0.06);
  });
});
