// Verificacion de los controles de acceso a viaticos (segregacion de
// funciones): quien es usuario de finanzas y quien puede acceder al modulo.

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { isFinanceUser, canAccessViaticos } = require("../viaticos.service");

describe("isFinanceUser", () => {
  it("reconoce un rol de finanzas (en role o scope, y por lista separada por comas)", () => {
    expect(isFinanceUser({ role: "finanzas" })).toBe(true);
    expect(isFinanceUser({ scope: "jefe_financiero" })).toBe(true);
    expect(isFinanceUser({ roles: "tecnico, gerencia_general" })).toBe(true);
  });

  it("no reconoce a un rol ajeno a finanzas ni a un usuario sin roles", () => {
    expect(isFinanceUser({ role: "tecnico" })).toBe(false);
    expect(isFinanceUser({})).toBe(false);
  });
});

describe("canAccessViaticos", () => {
  it("permite acceso a finanzas y a admin", () => {
    expect(canAccessViaticos({ role: "finanzas" })).toBe(true);
    expect(canAccessViaticos({ role: "admin" })).toBe(true);
  });

  it("niega acceso a un usuario sin roles", () => {
    expect(canAccessViaticos({})).toBe(false);
  });
});
