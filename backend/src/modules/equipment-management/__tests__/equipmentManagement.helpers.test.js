jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { toIntOrNull, toTextOrNull } = require("../equipmentManagement.service");

describe("equipment-management – conversores", () => {
  it("toIntOrNull convierte enteros y devuelve null ante vacio/invalido", () => {
    expect(toIntOrNull("42")).toBe(42);
    expect(toIntOrNull(7)).toBe(7);
    expect(toIntOrNull("")).toBeNull();
    expect(toIntOrNull(null)).toBeNull();
    expect(toIntOrNull("abc")).toBeNull();
  });
  it("toTextOrNull recorta y devuelve null ante vacio", () => {
    expect(toTextOrNull("  hola  ")).toBe("hola");
    expect(toTextOrNull("   ")).toBeNull();
    expect(toTextOrNull(null)).toBeNull();
  });
});
