// Verificacion del emparejamiento de roles (control de acceso por token) del
// servicio de compras privadas.

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("uuid", () => ({ v4: () => "00000000-0000-4000-8000-000000000000" }));

const service = require("../privatePurchases.service");

describe("privatePurchases – _hasAnyRoleToken", () => {
  it("hace match por token contenido en el rol del usuario", () => {
    expect(service._hasAnyRoleToken({ role: "gerencia_general" }, ["gerencia"])).toBe(true);
    expect(service._hasAnyRoleToken({ scope: "jefe_comercial" }, ["comercial"])).toBe(true);
  });
  it("no hace match para un rol ajeno o usuario sin roles", () => {
    expect(service._hasAnyRoleToken({ role: "tecnico" }, ["gerencia"])).toBe(false);
    expect(service._hasAnyRoleToken({}, ["gerencia"])).toBe(false);
  });
});
