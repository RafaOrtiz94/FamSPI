jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));
jest.mock("../../../utils/drive", () => ({ downloadFileBuffer: jest.fn() }));

const db = require("../../../config/db");
const { downloadFileBuffer } = require("../../../utils/drive");
const {
  generateAssetTechSpecPdf,
  buildTemplateNarrative,
  buildNarrativeInput,
  characteristicsToText,
  isEmbeddableImage,
  loadAssetFacts,
} = require("../tiAssets.spec");

// PNG 1x1 valido.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const ASSET = {
  id: 42,
  name: "Laptop",
  asset_code: "TI-000042",
  brand: "Dell",
  model: "Latitude 5440",
  serial_number: "ABC123",
  status: "assigned",
  characteristics: "Procesador: Intel Core i5-1335U, RAM: 16 GB",
  purchase_date: "2026-01-10",
  purchase_value: "950.00",
  assigned_to_user_id: 7,
  initial_condition_photo_1_drive_file_id: "foto-1",
  initial_condition_photo_2_drive_file_id: "foto-2",
};

describe("tiAssets ficha tecnica", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalToken = process.env.ANTHROPIC_AUTH_TOKEN;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    db.query.mockReset();
    downloadFileBuffer.mockReset();
  });

  afterAll(() => {
    if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey;
    if (originalToken !== undefined) process.env.ANTHROPIC_AUTH_TOKEN = originalToken;
  });

  it("genera el PDF con fotos JPEG/PNG y omite las de otro formato", async () => {
    db.query.mockResolvedValueOnce({ rows: [ASSET] });
    downloadFileBuffer
      .mockResolvedValueOnce(PNG)
      .mockResolvedValueOnce(Buffer.from("RIFF....WEBP")); // no incrustable

    const result = await generateAssetTechSpecPdf(42);

    expect(result.pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(result.photosIncluded).toBe(1);
    expect(result.filename).toBe("Ficha-Tecnica-Dell-Latitude-5440-ABC123.pdf");
  });

  it("no expone informacion interna a la redaccion", async () => {
    db.query.mockResolvedValueOnce({ rows: [ASSET] });
    const facts = await loadAssetFacts(42);
    const input = JSON.stringify(buildNarrativeInput(facts));
    expect(input).not.toMatch(/TI-000042|950|2026-01-10|assigned|ABC123/);
    expect(facts.product.map(([label]) => label)).toEqual(["Tipo de equipo", "Marca", "Modelo", "Número de serie"]);
  });

  it("responde 404 si el activo no existe", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(generateAssetTechSpecPdf(999)).rejects.toMatchObject({ status: 404 });
  });

  it("la plantilla usa las caracteristicas registradas", () => {
    const narrative = buildTemplateNarrative({
      asset: ASSET,
      characteristicsText: characteristicsToText(ASSET.characteristics),
    });
    const specs = Object.fromEntries(narrative.especificaciones.map((s) => [s.componente, s.valor]));
    expect(specs["Procesador"]).toBe("Intel Core i5-1335U");
    expect(specs["RAM"]).toBe("16 GB");
  });

  it("detecta formatos de imagen incrustables", () => {
    expect(isEmbeddableImage(PNG)).toBe(true);
    expect(isEmbeddableImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isEmbeddableImage(Buffer.from("RIFF....WEBP"))).toBe(false);
  });

  it("convierte characteristics JSONB vacio u objeto a texto", () => {
    expect(characteristicsToText({})).toBe("");
    expect(characteristicsToText({ RAM: "8 GB", Disco: "" })).toBe("RAM: 8 GB");
  });
});
