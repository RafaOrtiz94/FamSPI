jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../businessCaseSheetSyncLocal.service", () => {
  const actual = jest.requireActual("../businessCaseSheetSyncLocal.service");
  return { ...actual, loadTemplateDefinition: jest.fn() };
});

const db = require("../../../config/db");
const sheetSync = require("../businessCaseSheetSyncLocal.service");
const { computeInvestmentCatalogDiff } = require("../businessCaseTemplateVersions.service");

// bc_investment_catalog vive aparte del xlsx (createInvestmentCatalogItem la
// trata como catalogo fijo) -- este diff compara el bloque "INVERSIONES
// ADICIONALES" de la hoja BC contra esa tabla para detectar altas/bajas.
describe("computeInvestmentCatalogDiff", () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  const mockTemplate = (labels) => {
    sheetSync.loadTemplateDefinition.mockReturnValue({
      bc: { investmentLabels: new Map(labels.map((label) => [label.toLowerCase(), label])) },
      equipmentSheets: [],
    });
  };

  test("detecta una inversion nueva en la hoja y una que ya no esta (removida de forma suave)", async () => {
    mockTemplate(["UPS equipo", "Servidor", "USB"]);
    db.query.mockResolvedValue({
      rows: [
        { id: 5, code: "ups_equipo", name: "Ups equipo", is_active: true },
        { id: 14, code: "servidor", name: "Servidor", is_active: true },
        { id: 62, code: "agua_destilada_por_galon", name: "Agua destilada por galón", is_active: true },
        { id: 132, code: "otros", name: "Otros", is_active: true },
      ],
    });

    const diff = await computeInvestmentCatalogDiff();

    expect(diff.added).toEqual([{ name: "USB" }]);
    expect(diff.removed).toEqual([{ id: 62, name: "Agua destilada por galón" }]);
    expect(diff.has_changes).toBe(true);
  });

  test("nunca propone quitar el item de respaldo 'Otros' aunque no aparezca en la hoja", async () => {
    mockTemplate(["Servidor"]);
    db.query.mockResolvedValue({
      rows: [
        { id: 14, code: "servidor", name: "Servidor", is_active: true },
        { id: 132, code: "otros", name: "Otros", is_active: true },
      ],
    });

    const diff = await computeInvestmentCatalogDiff();

    expect(diff.removed).toEqual([]);
    expect(diff.has_changes).toBe(false);
  });

  test("sin cambios cuando coincide ignorando mayusculas/acentos", async () => {
    mockTemplate(["Póliza de seguro de equipos"]);
    db.query.mockResolvedValue({
      rows: [
        { id: 4, code: "poliza_de_seguro_de_equipos", name: "Póliza de seguro de equipos", is_active: true },
      ],
    });

    const diff = await computeInvestmentCatalogDiff();

    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.has_changes).toBe(false);
  });

  test("un item inactivo en BD no cuenta como existente -- reaparece como 'agregar' si vuelve a la hoja", async () => {
    mockTemplate(["Congelador"]);
    db.query.mockResolvedValue({
      rows: [
        { id: 127, code: "congelador", name: "Congelador", is_active: false },
      ],
    });

    const diff = await computeInvestmentCatalogDiff();

    expect(diff.added).toEqual([{ name: "Congelador" }]);
  });
});
