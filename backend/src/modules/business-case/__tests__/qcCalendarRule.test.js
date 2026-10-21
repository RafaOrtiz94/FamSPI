const { predictByQcCalendar } = require("../qcCalendarRule");

// Entorno real del BC dbe65add (cobas U 411, Damas del Cuerpo Consular): 6 dias, 1 turno, 1 control, 1 nivel, 48 meses.
const U411_ENVIRONMENT = { work_days_per_week: 6, shifts_per_day: 1, quality_controls_per_shift: "1.00", control_levels: 1 };

describe("regla de calendario de QC (equipo sin referencias)", () => {
  test("controles: una tira por nivel en cada corrida de control", () => {
    const result = predictByQcCalendar({ itemType: "control", unitsPerPack: 50, months: 48, environment: U411_ENVIRONMENT });
    // 6 × 208 semanas = 1248 tiras ÷ 50 = 25 cajas
    expect(result).toMatchObject({ quantity: 25, basis: "qc_calendar" });
    expect(result.detail).toContain("1248 usos");
  });

  test("calibradores: una calibracion por semana del proceso", () => {
    // 48 meses = 1460 dias ÷ 7 = 209 calibraciones ÷ 50 = 5 cajas
    expect(predictByQcCalendar({ itemType: "calibrador", unitsPerPack: 50, months: 48, environment: {} }))
      .toMatchObject({ quantity: 5, basis: "qc_calendar" });
  });

  test("sin presentacion, sin duracion o sin calendario de QC no inventa", () => {
    expect(predictByQcCalendar({ itemType: "control", unitsPerPack: null, months: 48, environment: U411_ENVIRONMENT })).toBeNull();
    expect(predictByQcCalendar({ itemType: "calibrador", unitsPerPack: 50, months: 0, environment: {} })).toBeNull();
    expect(predictByQcCalendar({ itemType: "control", unitsPerPack: 50, months: 48, environment: {} })).toBeNull();
    expect(predictByQcCalendar({ itemType: "material", unitsPerPack: 10, months: 48, environment: U411_ENVIRONMENT })).toBeNull();
  });
});
