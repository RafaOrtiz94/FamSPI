const { API_MODULE_REGISTRY } = require("../apiModuleRegistry");
const { getCatalog } = jest.requireActual("../../../modules/module-access/moduleAccess.service");

jest.mock("../../../config/db", () => ({ query: jest.fn() }));

describe("registro ruta API -> modulo", () => {
  it("solo declara modulos que existen en el catalogo", () => {
    const known = new Set(getCatalog().map((module) => module.key));
    const unknown = Object.values(API_MODULE_REGISTRY).flat().filter((key) => !known.has(key));
    expect(unknown).toEqual([]);
  });

  it("los prefijos no terminan en barra", () => {
    expect(Object.keys(API_MODULE_REGISTRY).filter((prefix) => !prefix.startsWith("/") || prefix.endsWith("/"))).toEqual([]);
  });
});
