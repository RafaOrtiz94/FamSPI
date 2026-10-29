const finder = require("../labStatisticsSearch");

const model = () => ({
  equipmentCode: "EQ",
  months: 12,
  environment: { workDaysPerWeek: 6, shifts: 2, hoursPerShift: 8, laboratoryRunsPerDay: 2, controlLevels: 2 },
  reagents: [{
    key: "reactivo::1", itemType: "reactivo", code: "1", name: "R", unit: "kit", deterministicQuantity: 20, processDemand: 60000,
    testsPerPack: 300, onboardDays: 28, calibrationIntervalDays: 30, calibrationDeclared: true, lotChangeDeclared: true,
    replicates: 2, calibratorLevels: 1, qcIntervalHours: 24, qcAfterCalibration: true, qcPerKit: false, sampleVolumeUl: 10,
    calibrators: ["10"], controls: ["20"], fromSheet: true,
  }],
  components: [
    { key: "material::10825468001", itemType: "material", code: "10825468001", name: "Electrodo Na", unit: "electrodo", manualKind: "iseElectrode" },
    { key: "control::20", itemType: "control", code: "20", name: "Q", unit: "presentacion", stabilityDays: 7, containersPerPack: 4 },
  ],
});

describe("busqueda de estadisticas del laboratorio por simulacion", () => {
  test("coincide = dentro de max(1, 15 %) del real", () => {
    expect(finder.coincides(11, 10)).toBe(true);
    expect(finder.coincides(12, 10)).toBe(false);
    expect(finder.coincides(2, 1)).toBe(true);
    expect(finder.scoreAgainstReal(new Map([["control::20", 5], ["material::1", 9], ["reactivo::1", 99]]), new Map([["control::20", 5], ["material::1", 3]])))
      .toEqual({ matches: 1, compared: 2, error: 0.75 });
  });

  test("encuentra las muestras ISE que reproducen los electrodos reales y descarta lo lejano", () => {
    // 12 meses = 360 dias: por tiempo bastan 6 electrodos; 20 reales implican ~180 000 muestras ISE.
    const real = new Map([["material::10825468001", 20]]);
    const result = finder.search(model(), real, { iseSamplesPerYear: [0, 400000], rerunPct: [0, 20], qcFailurePct: [0, 20] }, {
      rounds: 4, perRound: 12, scenarios: 200, finalScenarios: 500,
    });
    expect(result.best.matches).toBe(1);
    expect(result.best.params.iseSamplesPerYear).toBeGreaterThan(150000);
    expect(result.best.params.iseSamplesPerYear).toBeLessThan(205000);
    expect(result.evaluated.filter((entry) => entry.status === "discarded").length).toBeGreaterThan(0);
    // El rango se achica ronda a ronda alrededor de los mejores.
    const width = (h) => h.box.iseSamplesPerYear[1] - h.box.iseSamplesPerYear[0];
    expect(width(result.history[result.history.length - 1])).toBeLessThan(width(result.history[0]));
  });

  test("no vuelve a simular cerca de lo ya descartado", () => {
    const real = new Map([["material::10825468001", 20]]);
    const discarded = [{ iseSamplesPerYear: 0, rerunPct: 0, qcFailurePct: 0 }];
    const result = finder.search(model(), real, { iseSamplesPerYear: [0, 1000], rerunPct: [0, 1], qcFailurePct: [0, 1] }, {
      rounds: 1, perRound: 5, scenarios: 100, finalScenarios: 100, discarded, minSeparation: 0.3,
    });
    result.evaluated.forEach((entry) => {
      expect(finder.__testables.separation(entry.params, discarded[0], { iseSamplesPerYear: [0, 1000], rerunPct: [0, 1], qcFailurePct: [0, 1] })).toBeGreaterThanOrEqual(0.3);
    });
  });
});
