jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { normalizeTipo, toUTCDate, dateToISO, addMonthsUtc } = require("../mantenimientos.service");

describe("mantenimientos – normalizeTipo", () => {
  it("reconoce variantes de correctivo y todo lo demas como preventivo", () => {
    expect(normalizeTipo("correctivo")).toBe("Correctivo");
    expect(normalizeTipo("Corr")).toBe("Correctivo");
    expect(normalizeTipo("preventivo")).toBe("Preventivo");
    expect(normalizeTipo("otro")).toBe("Preventivo");
  });
});

describe("mantenimientos – toUTCDate / dateToISO", () => {
  it("normaliza una fecha ISO (YYYY-MM-DD) a medianoche UTC", () => {
    const d = toUTCDate("2026-07-15");
    expect(dateToISO(d)).toBe("2026-07-15");
  });
  it("usa la fecha actual como fallback si el valor es invalido", () => {
    const d = toUTCDate("no-es-fecha");
    expect(d instanceof Date).toBe(true);
    expect(Number.isNaN(d.getTime())).toBe(false);
  });
});

describe("mantenimientos – addMonthsUtc", () => {
  it("suma meses en UTC sin mutar la fecha original", () => {
    const base = toUTCDate("2026-01-15");
    const next = addMonthsUtc(base, 6);
    expect(dateToISO(next)).toBe("2026-07-15");
    expect(dateToISO(base)).toBe("2026-01-15");
  });
});
