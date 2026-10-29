jest.mock("../../../config/db", () => ({ query: jest.fn() }));

const { __testables, REFERENCE_MIN_PROCESSES } = require("../labStatistics.service");

const { buildReference, describeStatistics, normalizeInput } = __testables;
const ISE = [{ equipment_name: "cobas Pro <503+801> ISE", equipment_code: "PRO" }];
const profile = (monthlyDemand) => ({ monthlyDemand, months: 12, reagentCount: 20, workDaysPerWeek: 7, shifts: 2 });

describe("labStatistics", () => {
  test("los datos son opcionales; lo llenado manda", () => {
    const [ise, rerun] = describeStatistics({ equipment: ISE, ownValues: new Map([["rerun_rate_pct", { value: "4" }]]), referenceRows: [], ownProfile: null });
    expect(ise).toMatchObject({ key: "ise_tests_per_year", required: false, effectiveValue: null });
    expect(rerun).toMatchObject({ value: 4, required: false, effectiveValue: 4, effectiveSource: "laboratory" });
  });

  test("ISE solo aparece si el Business Case tiene un equipo ISE", () => {
    const keys = describeStatistics({ equipment: [{ equipment_name: "cobas e 411" }], ownValues: new Map(), referenceRows: [], ownProfile: null }).map((entry) => entry.key);
    expect(keys).toEqual(["rerun_rate_pct", "qc_failure_rate_pct"]);
  });

  test(`con ${REFERENCE_MIN_PROCESSES} procesos parecidos usa la referencia`, () => {
    const rows = [1, 2, 3].map((index) => ({ stat_key: "qc_failure_rate_pct", value: String(index * 2), profile: profile(1000) }));
    const [, , qc] = describeStatistics({ equipment: ISE, ownValues: new Map(), referenceRows: rows, ownProfile: profile(1000) });
    expect(qc).toMatchObject({ required: false, effectiveValue: 4, effectiveSource: "reference", reference: { processes: 3, sufficient: true } });
    const two = describeStatistics({ equipment: ISE, ownValues: new Map(), referenceRows: rows.slice(0, 2), ownProfile: profile(1000) })[2];
    expect(two).toMatchObject({ required: false, effectiveValue: null, reference: { processes: 2, sufficient: false } });
  });

  test("muestras ISE de otro laboratorio se escalan por la demanda mensual", () => {
    const definition = { key: "ise_tests_per_year", integer: true, scaleByDemand: true };
    const reference = buildReference(definition, [{ stat_key: "ise_tests_per_year", value: 60000, profile: profile(2000) }], profile(1000));
    expect(reference).toEqual({ processes: 1, value: 30000 });
  });

  test("valida lo que llega de pantalla", () => {
    expect(normalizeInput({ rerun_rate_pct: "3.5", ise_tests_per_year: "1200.4", qc_failure_rate_pct: null }))
      .toEqual([{ key: "rerun_rate_pct", value: 3.5 }, { key: "ise_tests_per_year", value: 1200 }, { key: "qc_failure_rate_pct", value: null }]);
    expect(() => normalizeInput({ rerun_rate_pct: 80 })).toThrow(/entre 0 y 50/);
    expect(() => normalizeInput({ otro: 1 })).toThrow(/desconocido/);
  });
});
