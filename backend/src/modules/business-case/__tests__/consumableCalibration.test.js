const simulation = require("../consumableSimulation");
const calibration = require("../consumableCalibration");

const model = () => ({
  equipmentCode: "EQ",
  months: 12,
  environment: { workDaysPerWeek: 6, shifts: 2, hoursPerShift: 8, laboratoryRunsPerDay: 2, controlLevels: 2 },
  reagents: [{
    key: "reactivo::1", itemType: "reactivo", code: "1", name: "R", unit: "kit", deterministicQuantity: 20, processDemand: 6000,
    testsPerPack: 300, onboardDays: 28, calibrationIntervalDays: 30, calibrationDeclared: true, lotChangeDeclared: true,
    replicates: 2, calibratorLevels: 1, qcIntervalHours: 24, qcAfterCalibration: true, qcPerKit: false, sampleVolumeUl: 10,
    calibrators: ["10"], controls: ["20"], fromSheet: true,
  }],
  components: [
    { key: "calibrador::10", itemType: "calibrador", code: "10", name: "C", unit: "presentacion", stabilityDays: 7, containersPerPack: 4 },
    { key: "control::20", itemType: "control", code: "20", name: "Q", unit: "presentacion", stabilityDays: 7, containersPerPack: 4 },
  ],
});

describe("calibracion de la simulacion contra lo real", () => {
  test("distancia: error absoluto relativo sobre los productos con cantidad real", () => {
    expect(calibration.scenarioDistance(new Map([["a", 12], ["b", 1]]), new Map([["a", 10], ["b", 2], ["c", 5]]))).toBeCloseTo(3 / 12);
  });

  test("descarta los escenarios lejanos: los aceptados estan mucho mas cerca que el resto", () => {
    const result = calibration.calibrate(model(), new Map([["calibrador::10", 2], ["control::20", 3]]), { scenarios: 20000, seed: 5 });
    expect(result.status).toBe("calibrated");
    expect(result.accepted.length).toBeGreaterThanOrEqual(100);
    expect(result.acceptedMedianDistance).toBeLessThan(result.priorMedianDistance);
    // Para acercarse a 3 controles (la ficha pediria muchos mas) aprende una fraccion planificada baja.
    const shares = result.accepted.map((entry) => entry.scenario.planningShare.control).sort((a, b) => a - b);
    expect(shares[Math.floor(shares.length / 2)]).toBeLessThan(0.5);
  });

  test("sin productos comparables no calibra", () => {
    expect(calibration.calibrate(model(), new Map([["material::99", 4]]), { scenarios: 5000 })).toMatchObject({ status: "no_comparable_products" });
  });

  test("al predecir sortea entre los aceptados y respeta lo que declaro el laboratorio", () => {
    const pool = [{ weight: 1, scenario: { rerunRate: 0.4, qcFailureRate: 0.3, planningShare: { control: 0.2, calibrador: 1, material: 1 }, workDaysDelta: -1 } }];
    const random = simulation.__testables.createRandom(3);
    const sampler = calibration.posteriorSampler(pool, { workDaysPerWeek: 6, rerunRate: 0.02 });
    const scenario = sampler(random);
    expect(scenario.planningShare.control).toBeGreaterThan(0.18);
    expect(scenario.planningShare.control).toBeLessThan(0.22);
    expect(scenario.qcFailureRate).toBeGreaterThan(0.28);
    expect(scenario.rerunRate).toBeLessThan(0.03);
    expect(scenario.workDaysPerWeek).toBe(5);
  });

  test("la prediccion con escenarios calibrados acerca el resultado a lo real", () => {
    const real = new Map([["calibrador::10", 2], ["control::20", 3]]);
    const { accepted } = calibration.calibrate(model(), real, { scenarios: 20000, seed: 5 });
    const pool = calibration.buildPool([{ profile: null, accepted }], null, simulation.profileDistance);
    const calibrated = simulation.runSimulation(model(), { scenarios: 5000, seed: 9, posterior: pool });
    const prior = simulation.runSimulation(model(), { scenarios: 5000, seed: 9 });
    const control = (run) => run.products.find((product) => product.key === "control::20");
    expect(calibrated.calibrated).toBe(true);
    expect(Math.abs(control(calibrated).p50 - 3)).toBeLessThan(Math.abs(control(prior).p50 - 3));
  });
});

describe("seleccion de los mejores escenarios", () => {
  test("los aceptados son exactamente los mas cercanos de todos los evaluados", () => {
    const real = new Map([["calibrador::10", 2], ["control::20", 3]]);
    const result = calibration.calibrate(model(), real, { scenarios: 20000, seed: 5, keepFraction: 0.005 });
    // Con 20000 escenarios y 100 aceptados, la mediana aceptada esta por debajo del mejor 5 % previo.
    expect(result.accepted).toHaveLength(100);
    const distances = result.accepted.map((entry) => entry.distance);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
    expect(result.acceptedMedianDistance).toBeLessThan(result.priorMedianDistance * 0.5);
  });
});
