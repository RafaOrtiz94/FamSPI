// Verificacion del validador de UUID del modulo work-management
// (identificadores de proyectos/tableros/items).

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { isUuid } = require("../workManagement.service");

describe("isUuid", () => {
  it("acepta un UUID v4 valido", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });
  it("rechaza cadenas que no son UUID", () => {
    expect(isUuid("123")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid("550e8400e29b41d4a716446655440000")).toBe(false);
  });
});
