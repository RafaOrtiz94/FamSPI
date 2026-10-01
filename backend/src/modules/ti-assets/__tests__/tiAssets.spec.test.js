jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));

const db = require("../../../config/db");
const { generateAssetTechSpecPdf, buildTemplateNarrative, characteristicsToText } = require("../tiAssets.spec");

const ASSET = {
  id: 42,
  name: "Laptop",
  asset_code: "TI-000042",
  brand: "Dell",
  model: "Latitude 5440",
  serial_number: "ABC123",
  status: "assigned",
  characteristics: "Procesador: Intel Core i5-1335U, RAM: 16 GB, Disco: 512 GB SSD",
  maintenance_frequency_months: 12,
  assigned_to_name: "Colaborador Uno",
  assigned_at: "2026-05-01",
  physical_condition_score: 9,
  functional_condition_score: 10,
};

describe("tiAssets tech spec", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalToken = process.env.ANTHROPIC_AUTH_TOKEN;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    db.query.mockReset();
  });

  afterAll(() => {
    if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey;
    if (originalToken !== undefined) process.env.ANTHROPIC_AUTH_TOKEN = originalToken;
  });

  it("genera el PDF con redaccion de plantilla cuando no hay credenciales de IA", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [ASSET] })
      .mockResolvedValueOnce({ rows: [{ name: "Cargador", brand: "Dell", is_new: true }] });

    const result = await generateAssetTechSpecPdf(42, { generatedByName: "TI" });

    expect(result.aiGenerated).toBe(false);
    expect(result.filename).toBe("Especificacion-Tecnica-TI-000042.pdf");
    expect(result.pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("responde 404 si el activo no existe", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(generateAssetTechSpecPdf(999)).rejects.toMatchObject({ status: 404 });
  });

  it("la plantilla solo usa caracteristicas registradas", () => {
    const narrative = buildTemplateNarrative({
      asset: ASSET,
      characteristicsText: characteristicsToText(ASSET.characteristics),
      accessories: [],
    });
    const specs = Object.fromEntries(narrative.especificaciones.map((s) => [s.componente, s.valor]));
    expect(specs["Procesador"]).toBe("Intel Core i5-1335U");
    expect(specs["RAM"]).toBe("16 GB");
    expect(specs["Número de serie"]).toBe("ABC123");
    expect(narrative.datos_no_registrados).toContain("Fecha de compra");
  });

  it("convierte characteristics JSONB vacio u objeto a texto", () => {
    expect(characteristicsToText({})).toBe("");
    expect(characteristicsToText({ RAM: "8 GB", Disco: "" })).toBe("RAM: 8 GB");
  });
});
