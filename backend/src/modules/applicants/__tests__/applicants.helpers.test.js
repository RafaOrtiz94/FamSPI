// Verificacion de helpers puros del modulo applicants (aspirantes):
// calculo de edad y normalizacion de telefono.

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { calculateAge, normalizePhone } = require("../applicants.service");

describe("calculateAge", () => {
  it("devuelve cadena vacia para fecha ausente o invalida", () => {
    expect(calculateAge(null)).toBe("");
    expect(calculateAge("no-es-fecha")).toBe("");
  });
  it("calcula una edad plausible para una fecha pasada", () => {
    const age = calculateAge("2000-01-01");
    expect(Number(age)).toBeGreaterThanOrEqual(24);
  });
});

describe("normalizePhone", () => {
  it("deja solo digitos", () => {
    expect(normalizePhone("+593 (99) 123-4567")).toBe("593991234567");
    expect(normalizePhone(null)).toBe("");
  });
});
