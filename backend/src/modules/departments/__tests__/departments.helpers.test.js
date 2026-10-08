jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { normalizeDepartmentStatus } = require("../departments.controller");

describe("departments – normalizeDepartmentStatus", () => {
  it("normaliza variantes de inactivo a 'inactive'", () => {
    for (const v of ["inactive", "inactivo", "disabled", "false", "0", "INACTIVO"]) {
      expect(normalizeDepartmentStatus(v)).toBe("inactive");
    }
  });
  it("cualquier otro valor (incluido vacio) se considera 'active'", () => {
    expect(normalizeDepartmentStatus("activo")).toBe("active");
    expect(normalizeDepartmentStatus("")).toBe("active");
    expect(normalizeDepartmentStatus(null)).toBe("active");
  });
});
