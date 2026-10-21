const { parseLiveEquipmentTab, readLiveTabsForUnmappedEquipment } = require("../businessCaseSheetLiveTabs");
const syncLocal = require("../businessCaseSheetSyncLocal.service");

// Pestaña "u411" real del BC dbe65add (Damas del Cuerpo Consular, 2026-10-19).
const U411_VALUES = [
  ["CLIENTE", "DAMAS DEL CUERPO CONSULAR"],
  ["FECHA", "12/10/2026"],
  ["MODALIDAD", "", "DETERMINACIÓN/ DETERMINACIÓN EFECTIVA/COMODATO TODO COBRADO"],
  ["PLAZO", "48", "MESES"],
  ["PROYECCIÓN", "", "MESES"],
  ["EQUIPO", "", "cobas u411"],
  [],
  ["I.D", "REACTIVO", "DET/KIT", "ESTABILIDAD", "DET/AÑO/PROCESO", "PRODUCTO CALCULADO", "MINIMOS POR ESTABILIDAD", "PRODUCTO A ENVIAR"],
  ["9587624190", "COMBUR10 TEST M U 411 VISUAL 100 STR", "100", "", "11742", "117.42", "", "118"],
  ["11379194160", "Calibration strip UA", "50", "", "", "", "", "1"],
  ["11379194263", "Control-Test M (50 Strips)", "50", "", "", "", "", "6"],
];

describe("pestaña en vivo de un equipo sin plantilla", () => {
  test("lee la pestaña u411 real: los tres productos, con el tipo corregido por nombre", () => {
    expect(parseLiveEquipmentTab(U411_VALUES)).toEqual([
      { itemId: "9587624190", name: "COMBUR10 TEST M U 411 VISUAL 100 STR", itemType: "reactivo", annualQty: 11742, plannedQty: 118, referenceQty: 117.42, unitsPerPack: 100, rowNumber: 9 },
      { itemId: "11379194160", name: "Calibration strip UA", itemType: "calibrador", annualQty: null, plannedQty: 1, referenceQty: null, unitsPerPack: 50, rowNumber: 10 },
      { itemId: "11379194263", name: "Control-Test M (50 Strips)", itemType: "control", annualQty: null, plannedQty: 6, referenceQty: null, unitsPerPack: 50, rowNumber: 11 },
    ]);
  });

  test("respeta las secciones y salta las filas sin codigo", () => {
    const items = parseLiveEquipmentTab([
      ["I.D", "REACTIVO", "DET/KIT", "ESTABILIDAD", "DET/AÑO/PROCESO", "PRODUCTO CALCULADO", "MINIMOS", "PRODUCTO A ENTREGAR"],
      ["123456789", "Reactivo X", "100", "", "500", "5", "", "6"],
      ["CONSUMIBLES"],
      ["", "Total"],
      ["987654321", "Waste box", "", "", "", "", "", "2"],
    ]);
    expect(items.map((item) => [item.itemId, item.itemType, item.plannedQty])).toEqual([["123456789", "reactivo", 6], ["987654321", "material", 2]]);
  });

  test("sin fila de encabezados no inventa productos", () => {
    expect(parseLiveEquipmentTab([["CLIENTE", "X"], ["123456789", "algo"]])).toEqual([]);
  });

  test("solo lee los equipos sin pestaña en la plantilla, emparejando por nombre de pestaña", async () => {
    const sheetsApi = {
      spreadsheets: {
        get: jest.fn(async () => ({ data: { sheets: [{ properties: { title: "BC" } }, { properties: { title: "u411" } }, { properties: { title: "c311" } }] } })),
        values: { get: jest.fn(async () => ({ data: { values: U411_VALUES } })) },
      },
    };
    const items = await readLiveTabsForUnmappedEquipment({
      sheetsApi,
      sheetId: "sheet-1",
      equipmentRecords: [{ id: 19, name: "cobas U 411 analyser w barcode" }, { id: 7, name: "cobas c 311" }],
      mappedEquipmentIds: [7],
      helpers: syncLocal,
    });
    expect(sheetsApi.spreadsheets.values.get).toHaveBeenCalledWith(expect.objectContaining({ range: "'u411'!A1:L300" }));
    expect(items.map((item) => item.item_key)).toEqual([
      "sheet:19:9587624190:reactivo", "sheet:19:11379194160:calibrador", "sheet:19:11379194263:control",
    ]);
    expect(items[1]).toMatchObject({ planned_qty: 1, units_per_pack: 50, source: "sheet_live_tab", equipment_name: "cobas U 411 analyser w barcode" });
  });
});
