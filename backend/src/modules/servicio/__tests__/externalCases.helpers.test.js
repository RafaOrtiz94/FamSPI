jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { buildCaseCode } = require("../externalCases.service");

describe("servicio (external cases) – buildCaseCode", () => {
  it("genera el codigo con prefijo EXT y padding a 6 digitos", () => {
    expect(buildCaseCode(42)).toBe("EXT-000042");
    expect(buildCaseCode(1)).toBe("EXT-000001");
  });
  it("maneja id ausente sin lanzar", () => {
    expect(buildCaseCode(undefined)).toBe("EXT-000000");
  });
});
