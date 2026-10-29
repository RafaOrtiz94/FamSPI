jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));

const { __testables } = require("../bcLabProductParameters.service");

const {
  systemKeysForEquipment,
  resolveSystemSpec,
  manufacturerValues,
  effectiveValues,
  sanitizeOverrides,
} = __testables;

describe("bcLabProductParameters.service", () => {
  test("prioriza el bloque especifico del analizador y cae en 'todos'", () => {
    expect(systemKeysForEquipment("cobas Pure <303>")).toEqual(["cobas c 303", "todos", "cobas c systems"]);
    expect(systemKeysForEquipment("cobas e411 disk")).toEqual(["todos"]);
    expect(systemKeysForEquipment("cobas c111")).toEqual(["cobas c 111", "todos"]);

    const specs = { "cobas c systems": { onboard_days: 56 }, "COBAS INTEGRA systems": { onboard_days: 99 } };
    expect(resolveSystemSpec(specs, "cobas 4000 c311")).toEqual({ key: "cobas c systems", onboard_days: 56 });
    expect(resolveSystemSpec(specs, "cobas e411 disk")).toEqual({ key: null });
  });

  test("toma del documento el intervalo de recalibracion mas corto", () => {
    const spec = {
      stability_open_days: "84",
      stability_onboard_days: null,
      single_use: false,
      system_specs: {
        todos: {
          onboard_days: 42,
          calibration: { events: ["reagent_lot_change"], same_lot_interval_days: 56, onboard_kit_interval_days: 7 },
          qc: { interval_hours: 24, per_kit: true },
        },
      },
      parameters: { linked_products: { calibradores: ["7030207190"], controles: ["11776452122"] } },
    };
    const values = manufacturerValues(spec, "cobas e411 disk");
    expect(values).toMatchObject({
      systemKey: "todos",
      onboardDays: 42,
      openDays: 84,
      calibrationIntervalDays: 7,
      qcIntervalHours: 24,
      qcPerKit: true,
      linkedCalibrators: ["7030207190"],
    });
  });

  test("el ajuste del laboratorio reemplaza al fabricante solo en los campos informados", () => {
    const manufacturer = { calibrationIntervalDays: 28, qcIntervalHours: 24, onboardDays: 56, openDays: null };
    expect(effectiveValues(manufacturer, { qc_interval_hours: 12 })).toEqual({
      calibrationIntervalDays: 28,
      qcIntervalHours: 12,
      onboardDays: 56,
      openDays: null,
    });
    expect(effectiveValues(null, {})).toEqual({
      calibrationIntervalDays: null, qcIntervalHours: null, onboardDays: null, openDays: null,
    });
  });

  test("descarta valores no positivos y campos desconocidos", () => {
    expect(sanitizeOverrides({
      calibration_interval_days: "14",
      qc_interval_hours: 0,
      onboard_days: -3,
      open_days: "",
      note: "  laboratorio calibra cada 2 semanas  ",
      foo: 1,
    })).toEqual({ calibration_interval_days: 14, note: "laboratorio calibra cada 2 semanas" });
  });
});
