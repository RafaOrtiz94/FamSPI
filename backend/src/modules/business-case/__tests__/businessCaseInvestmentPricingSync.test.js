const fs = require("fs");
const path = require("path");

const sheetGenerationSource = fs.readFileSync(
  path.join(__dirname, "../businessCaseSheetGeneration.service.js"),
  "utf8",
);
const investmentsSource = fs.readFileSync(
  path.join(__dirname, "../investments.service.js"),
  "utf8",
);
const sheetSyncSource = fs.readFileSync(
  path.join(__dirname, "../businessCaseSheetSyncLocal.service.js"),
  "utf8",
);

describe("business case investment pricing sync", () => {
  it("exports process depreciation as Sheet investment price", () => {
    expect(sheetGenerationSource).toContain("calculateProcessDepreciation");
    expect(sheetGenerationSource).toContain("item?.unit_price_financial ?? item?.unit_price");
    expect(sheetGenerationSource).toContain("percentage: item?.depreciation_percentage");
    expect(sheetGenerationSource).toContain("projectedMonths: sheetContext.projected_deadline_months");
    expect(sheetGenerationSource).toContain("precio: processDepreciation === null ? 0 : processDepreciation");
    expect(sheetGenerationSource).toContain("precio_financiero");
    expect(sheetGenerationSource).toContain("precio_operativo");
  });

  it("loads financial investment values for automatic Sheet generation", () => {
    expect(investmentsSource).toMatch(/getCatalogWithSelections[\s\S]*s\.unit_price_financial/);
    expect(investmentsSource).toMatch(/getInvestmentSelections[\s\S]*unit_price_financial/);
    expect(investmentsSource).toMatch(/WHERE c\.is_active = true\s+OR s\.selected = true/);
  });

  it("normalizes Sheet header values and writes SMART objective to its template row", () => {
    expect(sheetGenerationSource).toContain("normalizeClientProcessTypeLabel");
    expect(sheetGenerationSource).toContain("normalizeLisProviderLabel");
    expect(sheetGenerationSource).toContain('"SmartObjective"');
    expect(sheetSyncSource).toContain("normalizeSheetWriteValue");
    expect(sheetSyncSource).toContain("value.toUpperCase()");
    expect(sheetSyncSource).toContain("bestSheetByRecordId");
    expect(sheetSyncSource).toContain("directNameMatch");
    expect(sheetSyncSource).toContain('fieldCells.SmartObjective = pickWritableCell(ws, row, 2, 5)');
    expect(sheetSyncSource).toContain('normalizedLabel.includes("porque es importante ganar este proceso")');
    expect(sheetSyncSource).toContain('const smartObjectiveCell = fieldCells.SmartObjective || "B129"');
    expect(sheetSyncSource).not.toContain('buildValueRange("BC!B124", payload.fields.SmartObjective || "")');
    expect(sheetGenerationSource).not.toMatch(/setFieldIfPresent\(fields,\s*"TipoDeCliente"[\s\S]*generalData\.clientType/);
  });
});
