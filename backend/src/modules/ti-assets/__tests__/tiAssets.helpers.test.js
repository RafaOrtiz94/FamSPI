jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const {
  buildFutureMaintenanceCandidates,
  buildTiActaItemsBlock,
  getMaintenanceHolidaysForYear,
  resolveMaintenanceBaseDate,
  resolveMaintenanceBusinessDate,
  resolveMaintenanceDueDate,
} = require("../tiAssets.service");

describe("ti-assets - candidatos del cronograma futuro", () => {
  it("genera fechas habiles, conserva el mes y elimina candidatos duplicados", () => {
    const result = buildFutureMaintenanceCandidates([
      { id: 7, maintenance_frequency_months: 12, purchase_date: "2025-03-01" },
      { id: 7, maintenance_frequency_months: 12, purchase_date: "2025-03-01" },
    ], { currentYear: 2026, horizonYears: 1 });

    expect(result.candidates).toEqual([
      { asset_id: 7, year: 2026, planned_date: "2026-03-02", max_due_date: "2026-03-17" },
      { asset_id: 7, year: 2027, planned_date: "2027-03-01", max_due_date: "2027-03-16" },
    ]);
  });
});

describe("ti-assets – buildTiActaItemsBlock", () => {
  it("numera los items e incluye marca/serie/estado/observaciones cuando existen", () => {
    const out = buildTiActaItemsBlock([
      { name: "Laptop", brand_model: "Dell XPS", serial_imei: "SN123", is_new: true, physical_condition: 9, observations: "OK" },
    ]);
    expect(out).toContain("1. Laptop");
    expect(out).toContain("Marca/Modelo: Dell XPS");
    expect(out).toContain("Serie/IMEI: SN123");
    expect(out).toContain("Estado: Nuevo");
    expect(out).toContain("Condición: 9/10");
    expect(out).toContain("Observaciones: OK");
  });

  it("usa el nombre por defecto y omite campos ausentes", () => {
    const out = buildTiActaItemsBlock([{}]);
    expect(out).toBe("1. Item sin nombre");
  });

  it("devuelve cadena vacia con arreglo vacio", () => {
    expect(buildTiActaItemsBlock([])).toBe("");
  });
});

describe("ti-assets - fecha base del cronograma", () => {
  it("prioriza la fecha de compra", () => {
    const result = resolveMaintenanceBaseDate({
      purchase_date: "2025-02-10",
      created_at: "2026-01-01T12:00:00Z",
    });
    expect(result.source).toBe("purchase_date");
    expect(result.date.toISOString().slice(0, 10)).toBe("2025-02-10");
  });

  it("usa la fecha de registro para activos historicos sin fecha de compra", () => {
    const result = resolveMaintenanceBaseDate({
      purchase_date: null,
      created_at: "2026-03-15T12:00:00Z",
    });
    expect(result.source).toBe("created_at");
    expect(result.date.toISOString().slice(0, 10)).toBe("2026-03-15");
  });
});

describe("ti-assets - calendario habil de mantenimientos", () => {
  it("incluye feriados nacionales calculados y descansos extraordinarios", () => {
    const holidays = getMaintenanceHolidaysForYear(2026);
    expect(holidays).toEqual(expect.arrayContaining([
      "2026-01-01",
      "2026-02-16",
      "2026-02-17",
      "2026-04-03",
      "2026-05-01",
      "2026-05-25",
      "2026-11-20",
      "2026-12-25",
    ]));
  });

  it("permite agregar futuros feriados extraordinarios por configuracion", () => {
    const previous = process.env.TI_MAINTENANCE_EXTRA_HOLIDAYS;
    process.env.TI_MAINTENANCE_EXTRA_HOLIDAYS = "2030-06-14, fecha-invalida";
    try {
      expect(getMaintenanceHolidaysForYear(2030)).toContain("2030-06-14");
      expect(getMaintenanceHolidaysForYear(2029)).not.toContain("2030-06-14");
    } finally {
      if (previous === undefined) delete process.env.TI_MAINTENANCE_EXTRA_HOLIDAYS;
      else process.env.TI_MAINTENANCE_EXTRA_HOLIDAYS = previous;
    }
  });

  it("mueve fines de semana y feriados hacia adelante dentro del mismo mes", () => {
    expect(resolveMaintenanceBusinessDate("2026-03-21").toISOString().slice(0, 10)).toBe("2026-03-23");
    expect(resolveMaintenanceBusinessDate("2026-04-03").toISOString().slice(0, 10)).toBe("2026-04-06");
  });

  it("retrocede si avanzar sacaria el mantenimiento del mes", () => {
    expect(resolveMaintenanceBusinessDate("2028-12-31").toISOString().slice(0, 10)).toBe("2028-12-29");
  });

  it("desplaza la fecha maxima al siguiente dia habil", () => {
    expect(resolveMaintenanceDueDate("2026-10-30").toISOString().slice(0, 10)).toBe("2026-11-16");
  });
});
