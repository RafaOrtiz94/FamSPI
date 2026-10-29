// Sync puntual de Datos Generales a la hoja BC existente, subtotal de inversiones y formatos de
// moneda / porcentaje. Google Sheets se simula: se comprueba que se escribe y que no se escribe.
const mockValuesGet = jest.fn();
const mockBatchClear = jest.fn().mockResolvedValue({});
const mockValuesBatchUpdate = jest.fn().mockResolvedValue({});
const mockSpreadsheetGet = jest.fn();
const mockSpreadsheetBatchUpdate = jest.fn().mockResolvedValue({});

jest.mock("../../../config/google", () => ({
  jwtClient: {},
  drive: { files: { get: jest.fn(), copy: jest.fn() } },
  sheets: {
    spreadsheets: {
      get: (...args) => mockSpreadsheetGet(...args),
      batchUpdate: (...args) => mockSpreadsheetBatchUpdate(...args),
      values: {
        get: (...args) => mockValuesGet(...args),
        batchClear: (...args) => mockBatchClear(...args),
        batchUpdate: (...args) => mockValuesBatchUpdate(...args),
      },
    },
  },
}));

const {
  syncGeneralFieldsToGoogleSheet, syncInvestmentSubtotal, applyBusinessCaseNumberFormats, loadTemplateDefinition,
} = require("../businessCaseSheetSyncLocal.service");
const { buildGeneralDataFields, toSheetPercentFraction, toSheetAmount } = require("../businessCaseSheetGeneration.service");

const LABELS = {
  TipoDeCliente: "Tipo de cliente",
  EntidadContratante: "Entidad contratante",
  Cliente: "Cliente",
  CodigoProceso: "Código del proceso",
  ObjetoContratacion: "Objeto de contratación",
  ProvinciaCiudad: "Provincia / Ciudad",
  PresupuestoReferencial: "Presupuesto referencial del proceso",
  PorcentajeMaximoCanje: "Porcentaje máximo de canje",
  SmartObjective: "¿Porqué es importante ganar este proceso?",
};
const FIELDS = {
  TipoDeCliente: "Privado", EntidadContratante: "", Cliente: "Laboratorio Demo", CodigoProceso: "", ObjetoContratacion: "Comodato",
  ProvinciaCiudad: "Pichincha, Quito", PresupuestoReferencial: 125000, PorcentajeMaximoCanje: 0.15, SmartObjective: "Ganar la cuenta",
};

const template = () => loadTemplateDefinition();
const cells = () => template().bc.fieldCells;
const rowOf = (cell) => Number(/\d+$/.exec(cell)[0]);
const investmentRows = () => [...template().bc.objectiveRows.values()];

// Columna A de la hoja "real", construida con las filas que la plantilla asigna a cada campo.
const columnA = (overrides = {}) => {
  const fieldCells = cells();
  const rows = Object.keys(FIELDS).map((key) => rowOf(fieldCells[key]));
  const first = Math.min(...rows);
  const last = Math.max(...rows);
  const values = Array.from({ length: last - first + 1 }, () => [""]);
  Object.keys(FIELDS).forEach((key) => { values[rowOf(fieldCells[key]) - first] = [overrides[key] ?? LABELS[key]]; });
  return { data: { values } };
};
const writtenValues = () => Object.fromEntries(
  mockValuesBatchUpdate.mock.calls.flatMap((call) => call[0].requestBody.data).map((item) => [item.range, item.values[0][0]]),
);
const formatRequests = () => mockSpreadsheetBatchUpdate.mock.calls.flatMap((call) => call[0].requestBody.requests.map((r) => r.repeatCell));

beforeEach(() => {
  mockValuesGet.mockReset();
  mockBatchClear.mockClear();
  mockValuesBatchUpdate.mockClear();
  mockSpreadsheetBatchUpdate.mockReset();
  mockSpreadsheetBatchUpdate.mockResolvedValue({});
  mockSpreadsheetGet.mockReset();
  mockSpreadsheetGet.mockResolvedValue({ data: { sheets: [{ properties: { title: "BC", sheetId: 77 } }] } });
});

describe("syncGeneralFieldsToGoogleSheet", () => {
  test("la plantilla tiene celda para todos los campos de Datos Generales", () => {
    const fieldCells = cells();
    Object.keys(FIELDS).forEach((key) => expect(fieldCells[key]).toMatch(/^[A-Z]+\d+$/));
  });

  test("escribe solo las celdas de Datos Generales, incluidos presupuesto y porcentaje de canje", async () => {
    mockValuesGet.mockResolvedValue(columnA());
    const fieldCells = cells();
    const result = await syncGeneralFieldsToGoogleSheet({ sheetId: "sheet-1", fields: FIELDS });

    expect(result).toMatchObject({ sheetId: "sheet-1", updated_ranges: Object.keys(FIELDS).length, backup: null, skipped_fields: [] });
    const byRange = writtenValues();
    expect(Object.keys(byRange).sort()).toEqual(Object.keys(FIELDS).map((key) => `BC!${fieldCells[key]}`).sort());
    expect(byRange[`BC!${fieldCells.PresupuestoReferencial}`]).toBe(125000);
    expect(byRange[`BC!${fieldCells.PorcentajeMaximoCanje}`]).toBe(0.15);
    // El texto se escribe en mayusculas, igual que en la generacion completa de la hoja.
    expect(byRange[`BC!${fieldCells.Cliente}`]).toBe("LABORATORIO DEMO");
    // Un campo vacio en SPI limpia su celda en la hoja.
    expect(mockBatchClear.mock.calls[0][0].requestBody.ranges).toContain(`BC!${fieldCells.EntidadContratante}`);
    expect(byRange[`BC!${fieldCells.EntidadContratante}`]).toBe("");
  });

  test("da formato de moneda al presupuesto y de porcentaje al canje", async () => {
    mockValuesGet.mockResolvedValue(columnA());
    const fieldCells = cells();
    await syncGeneralFieldsToGoogleSheet({ sheetId: "sheet-1", fields: FIELDS });

    const byRow = Object.fromEntries(formatRequests().map((r) => [r.range.startRowIndex + 1, r]));
    const budget = byRow[rowOf(fieldCells.PresupuestoReferencial)];
    const tradeIn = byRow[rowOf(fieldCells.PorcentajeMaximoCanje)];
    expect(budget.cell.userEnteredFormat.numberFormat).toEqual({ type: "CURRENCY", pattern: '"$"#,##0.00' });
    expect(tradeIn.cell.userEnteredFormat.numberFormat).toEqual({ type: "PERCENT", pattern: "0.##%" });
    expect(budget.range).toMatchObject({ sheetId: 77, startColumnIndex: 1, endColumnIndex: 2 });
    expect(budget.fields).toBe("userEnteredFormat.numberFormat");
  });

  test("no escribe nada si una fila de la hoja no corresponde al campo (filas desplazadas)", async () => {
    mockValuesGet.mockResolvedValue(columnA({ PresupuestoReferencial: "Plazo" }));
    await expect(syncGeneralFieldsToGoogleSheet({ sheetId: "sheet-1", fields: FIELDS }))
      .rejects.toMatchObject({ code: "SHEET_TEMPLATE_LAYOUT_MISMATCH", status: 409 });
    expect(mockBatchClear).not.toHaveBeenCalled();
    expect(mockValuesBatchUpdate).not.toHaveBeenCalled();
    expect(mockSpreadsheetBatchUpdate).not.toHaveBeenCalled();
  });

  test("un campo sin celda en la plantilla se omite y se informa", async () => {
    mockValuesGet.mockResolvedValue(columnA());
    const result = await syncGeneralFieldsToGoogleSheet({ sheetId: "sheet-1", fields: { ...FIELDS, CampoInexistente: "x" } });
    expect(result.skipped_fields).toEqual(["CampoInexistente"]);
    expect(result.updated_ranges).toBe(Object.keys(FIELDS).length);
  });

  test("si falla el formato, los datos ya escritos se dan por sincronizados", async () => {
    mockValuesGet.mockResolvedValue(columnA());
    mockSpreadsheetBatchUpdate.mockRejectedValueOnce(new Error("sin permiso de formato"));
    const result = await syncGeneralFieldsToGoogleSheet({ sheetId: "sheet-1", fields: FIELDS });
    expect(result.updated_ranges).toBe(Object.keys(FIELDS).length);
  });
});

describe("Sub total de inversiones adicionales", () => {
  test("escribe la suma de la columna Total en la fila rotulada Sub total", async () => {
    const rows = investmentRows();
    const first = Math.min(...rows);
    const last = Math.max(...rows);
    // En la hoja real la etiqueta esta en la columna E y la celda F trae el texto fijo "$ -".
    mockValuesGet.mockResolvedValue({ data: { values: [["", "", "", "", "Sub total", "$ -"]] } });

    const result = await syncInvestmentSubtotal("sheet-1", template());

    expect(mockValuesGet.mock.calls[0][0].range).toBe(`BC!A${last + 1}:F${last + 8}`);
    expect(result).toEqual({ row: last + 1, cell: `F${last + 1}`, formula: `=SUM(F${first}:F${last})+SUM(F131:F205)` });
    expect(writtenValues()[`BC!F${last + 1}`]).toBe(`=SUM(F${first}:F${last})+SUM(F131:F205)`);
  });

  test("encuentra la etiqueta aunque este unas filas mas abajo o con otra capitalizacion", async () => {
    const last = Math.max(...investmentRows());
    mockValuesGet.mockResolvedValue({ data: { values: [[], [], ["SUB TOTAL"]] } });
    const result = await syncInvestmentSubtotal("sheet-1", template());
    expect(result.row).toBe(last + 3);
  });

  test("si la hoja no tiene fila Sub total no escribe nada", async () => {
    mockValuesGet.mockResolvedValue({ data: { values: [["Otra cosa"], ["Total general"]] } });
    expect(await syncInvestmentSubtotal("sheet-1", template())).toBeNull();
    expect(mockValuesBatchUpdate).not.toHaveBeenCalled();
  });
});

describe("applyBusinessCaseNumberFormats", () => {
  test("ignora celdas invalidas y no llama a Google si no queda nada que formatear", async () => {
    expect(await applyBusinessCaseNumberFormats("sheet-1", [{ cell: null, type: "CURRENCY", pattern: "x" }, { cell: "B49" }])).toBe(0);
    expect(mockSpreadsheetBatchUpdate).not.toHaveBeenCalled();
  });

  test("convierte la celda a indices de fila y columna", async () => {
    await applyBusinessCaseNumberFormats("sheet-1", [{ cell: "F122", type: "CURRENCY", pattern: '"$"#,##0.00' }]);
    expect(formatRequests()[0].range).toEqual({ sheetId: 77, startRowIndex: 121, endRowIndex: 122, startColumnIndex: 5, endColumnIndex: 6 });
  });
});

describe("valores de Datos Generales para la hoja", () => {
  test("el porcentaje va como fraccion: la celda lo muestra con %", () => {
    expect(toSheetPercentFraction(15)).toBe(0.15);
    expect(toSheetPercentFraction("12.5")).toBe(0.125);
    expect(toSheetPercentFraction("12,5")).toBe(0.125);
    expect(toSheetPercentFraction("20%")).toBe(0.2);
    expect(toSheetPercentFraction(0)).toBe(0);
  });

  test("el monto va como numero: la celda lo muestra con $", () => {
    expect(toSheetAmount("125000")).toBe(125000);
    expect(toSheetAmount("$ 125000.50")).toBe(125000.5);
    expect(toSheetAmount(699341.98)).toBe(699341.98);
  });

  test("sin dato no se inventa un valor", () => {
    expect(toSheetPercentFraction(null)).toBeNull();
    expect(toSheetPercentFraction("")).toBe("");
    expect(toSheetAmount(null)).toBeNull();
  });

  test("buildGeneralDataFields entrega presupuesto y porcentaje listos para la hoja", () => {
    const fields = buildGeneralDataFields({
      client_name: "Cliente",
      modern_bc_metadata: { referential_budget: "125000", max_trade_in_percent: 15 },
    });
    expect(fields.PresupuestoReferencial).toBe(125000);
    expect(fields.PorcentajeMaximoCanje).toBe(0.15);
  });
});
