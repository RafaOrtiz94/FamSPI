// Verificacion del catalogo de modulos y la resolucion de modulo por ruta
// (control de acceso por modulo — segregacion de funciones).

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const { getCatalog, resolveModuleKeyByPath } = require("../moduleAccess.service");

describe("moduleAccess – catalogo de modulos", () => {
  it("expone un catalogo no vacio con clave y prefijos por modulo", () => {
    const catalog = getCatalog();
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThan(0);
    for (const m of catalog) {
      expect(typeof m.key).toBe("string");
      expect(m.key.length).toBeGreaterThan(0);
      expect(Array.isArray(m.path_prefixes)).toBe(true);
    }
  });
});

describe("moduleAccess – resolveModuleKeyByPath", () => {
  it("resuelve la clave de modulo por su prefijo de ruta (match mas largo)", () => {
    const withPrefix = getCatalog().find((m) => (m.path_prefixes || []).length > 0);
    expect(withPrefix).toBeTruthy();
    const prefix = withPrefix.path_prefixes[0];
    expect(resolveModuleKeyByPath(prefix)).toBe(withPrefix.key);
    expect(resolveModuleKeyByPath(prefix + "/detalle/123")).toBe(withPrefix.key);
  });

  it("devuelve null para una ruta que no pertenece a ningun modulo", () => {
    expect(resolveModuleKeyByPath("ruta-inexistente-sin-slash-" + Date.now())).toBeNull();
  });
});
