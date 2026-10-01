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
  it("exports residual unit value as Sheet investment price", () => {
    expect(sheetGenerationSource).toContain("investmentsService.calculateFinancialDepreciation");
    expect(sheetGenerationSource).toContain("item?.unit_price_financial ?? item?.unit_price");
    expect(sheetGenerationSource).toContain("percentage: item?.depreciation_percentage");
    expect(sheetGenerationSource).toContain("projectedMonths: sheetContext.projected_deadline_months");
    expect(sheetGenerationSource).toContain("precio: residualUnitPrice === null ? 0 : residualUnitPrice");
    expect(sheetGenerationSource).toContain("precio_financiero");
    expect(sheetGenerationSource).toContain("precio_operativo");
  });

  it("writes residual price in E and quantity x price total in F", () => {
    const { buildInvestmentRanges } = require("../businessCaseSheetSyncLocal.service");
    const template = {
      bc: {
        objectiveRows: new Map([["servidor", 71], ["lis", 64], ["etiquetas", 99]]),
        investmentRowDefaults: new Map([
          [64, { B: "", D: 0, E: "", F: "$ -" }],
          [99, { B: "Rollo x2000 uds", D: 0, E: "$ 6,29", F: "$ -" }],
        ]),
      },
    };
    const { updates, clears } = buildInvestmentRanges(
      template,
      {
        Servidor: { nombre: "Servidor", cantidad: 3, precio: 850.5 },
        "Equipo nuevo": { nombre: "Equipo nuevo", cantidad: 2, precio: 100 },
      },
      // 99 fue llenada por SPI antes y se deselecciono; 64 nunca se uso.
      { currentRows: new Map([[64, { D: "0" }], [99, { D: "4" }], [71, { D: "1" }]]) },
    );
    const cell = (range) => updates.find((u) => u.range === range)?.values[0][0];
    expect(cell("BC!E71")).toBe(850.5);
    expect(cell("BC!F71")).toBe(2551.5);
    expect(cell("BC!B71")).toBeUndefined(); // sin caracteristicas no pisa la plantilla
    expect(cell("BC!F64")).toBeUndefined(); // fila nunca usada: no se toca
    expect(cell("BC!B99")).toBe("Rollo x2000 uds"); // restaurada tal cual plantilla
    expect(cell("BC!E99")).toBe("$ 6,29");
    expect(cell("BC!D99")).toBe(0);
    expect(cell("BC!E131")).toBe(100);
    expect(cell("BC!F131")).toBe(200);
    expect(clears.every((range) => /^BC!A131:F205$/.test(range))).toBe(true);
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
    expect(sheetSyncSource).toContain("matchedSheetsByRecordId");
    expect(sheetSyncSource).toContain("directNameMatch");
    expect(sheetSyncSource).toContain('fieldCells.SmartObjective = pickWritableCell(ws, row, 2, 5)');
    expect(sheetSyncSource).toContain('normalizedLabel.includes("porque es importante ganar este proceso")');
    expect(sheetSyncSource).toContain('const smartObjectiveCell = fieldCells.SmartObjective || "B129"');
    expect(sheetSyncSource).not.toContain('buildValueRange("BC!B124", payload.fields.SmartObjective || "")');
    expect(sheetGenerationSource).not.toMatch(/setFieldIfPresent\(fields,\s*"TipoDeCliente"[\s\S]*generalData\.clientType/);
  });
});
