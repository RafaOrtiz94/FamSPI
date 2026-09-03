jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { normalizeNumber } = require("../opportunities.service");

describe("opportunities – normalizeNumber", () => {
  it("convierte numeros validos", () => {
    expect(normalizeNumber("12.5")).toBe(12.5);
    expect(normalizeNumber(3)).toBe(3);
  });
  it("usa el fallback (0 por defecto) ante valores invalidos", () => {
    expect(normalizeNumber("abc")).toBe(0);
    expect(normalizeNumber(null)).toBe(0);
    expect(normalizeNumber(undefined, 99)).toBe(99);
  });
});
