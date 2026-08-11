jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { buildTiActaItemsBlock } = require("../tiAssets.service");

describe("ti-assets – buildTiActaItemsBlock", () => {
  it("numera los items e incluye marca/serie/estado/observaciones cuando existen", () => {
    const out = buildTiActaItemsBlock([
      { name: "Laptop", brand_model: "Dell XPS", serial_imei: "SN123", is_new: true, physical_condition: 9, observations: "OK" },
    ]);
    expect(out).toContain("1. Laptop");
    expect(out).toContain("Marca/Modelo: Dell XPS");
    expect(out).toContain("Serie/IMEI: SN123");
    expect(out).toContain("Estado: Nuevo");
    expect(out).toContain("Condición: 9/10");
    expect(out).toContain("Observaciones: OK");
  });

  it("usa el nombre por defecto y omite campos ausentes", () => {
    const out = buildTiActaItemsBlock([{}]);
    expect(out).toBe("1. Item sin nombre");
  });

  it("devuelve cadena vacia con arreglo vacio", () => {
    expect(buildTiActaItemsBlock([])).toBe("");
  });
});
