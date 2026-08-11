jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { normalizeDetalleValue } = require("../inventario.service");

describe("inventario – normalizeDetalleValue", () => {
  it("serializa objetos a JSON", () => {
    expect(normalizeDetalleValue({ a: 1, b: "x" })).toBe('{"a":1,"b":"x"}');
    expect(normalizeDetalleValue([1, 2])).toBe("[1,2]");
  });
  it("devuelve null para null/undefined", () => {
    expect(normalizeDetalleValue(null)).toBeNull();
    expect(normalizeDetalleValue(undefined)).toBeNull();
  });
});
