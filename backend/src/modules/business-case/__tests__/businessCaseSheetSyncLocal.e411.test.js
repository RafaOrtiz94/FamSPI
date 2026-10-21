const { loadTemplateDefinition, buildSheetPayloads } = require("../businessCaseSheetSyncLocal.service");

describe("business case e411 sheet mapping", () => {
  test("infers e411 item types from template section headers", () => {
    const definition = loadTemplateDefinition().equipmentSheets.find((sheet) => sheet.name === "e411");

    expect(definition).toBeDefined();
    expect(definition.rows.find((row) => row.rowNumber === 9)).toEqual(
      expect.objectContaining({ itemId: "8946710190", itemType: "reactivo" }),
    );
    expect(definition.rows.find((row) => row.rowNumber === 105)).toEqual(
      expect.objectContaining({ itemId: "8959820190", itemType: "calibrador" }),
    );
    expect(definition.rows.find((row) => row.rowNumber === 170)).toEqual(
      expect.objectContaining({ itemId: "9216928190", itemType: "control" }),
    );
    expect(definition.rows.find((row) => row.rowNumber === 220)).toEqual(
      expect.objectContaining({ itemId: "4444191001", itemType: "material" }),
    );
  });

  test("does not associate cobas e411 disk with the t411 tab", () => {
    const equipmentTabs = buildSheetPayloads({
      template: loadTemplateDefinition(),
      equipmentRecords: [{ id: 12, name: "cobas e411 disk" }],
      payload: { fields: {}, sync_items: [], sheet_context: {} },
    });

    expect(equipmentTabs.map((tab) => tab.sheet_name)).toEqual(["e411"]);
  });

  // Bug real confirmado en produccion (buildEquipmentSheetMappingReport):
  // "b101" traia un "123" perdido en una celda interna que hacia score 100
  // contra "cobas b 123 POC system", generando su Sheet real con AMBAS
  // pestañas y mezclando el catalogo de dos equipos distintos.
  test("no asocia 'cobas b 123 POC system' con la pestaña b101", () => {
    const equipmentTabs = buildSheetPayloads({
      template: loadTemplateDefinition(),
      equipmentRecords: [{ id: 6, name: "cobas b 123 POC system" }],
      payload: { fields: {}, sync_items: [], sheet_context: {} },
    });

    expect(equipmentTabs.map((tab) => tab.sheet_name)).toEqual(["b123"]);
  });

  // Bug real: "cobas 6500" no tenia ningun numero de modelo compartido de
  // forma literal con la pestaña "u6500" (nomenclatura tecnica del
  // fabricante) y caia en el fallback generico, que antes de la correccion
  // ni siquiera resolvia una pestaña util.
  test("asocia 'cobas 6500' con la pestaña u6500 via el alias tecnico curado", () => {
    const equipmentTabs = buildSheetPayloads({
      template: loadTemplateDefinition(),
      equipmentRecords: [{ id: 20, name: "cobas 6500" }],
      payload: { fields: {}, sync_items: [], sheet_context: {} },
    });

    expect(equipmentTabs.map((tab) => tab.sheet_name)).toEqual(["u6500"]);
  });

  // Bug real: "cobas U 411 analyser w barcode" comparte el numero "411" con
  // las pestañas "e411"/"t411 h232" (dato irrelevante, es un analizador de
  // orina sin relacion) pero antes de la correccion el fallback final
  // ignoraba el conflicto de familia detectado y adivinaba "e411" de
  // todos modos. Sin pestaña real para este equipo en la plantilla, debe
  // quedar sin mapear -- no adivinar es mejor que mezclar catalogos.
  test("no adivina pestaña para 'cobas U 411 analyser w barcode' (comparte numero por coincidencia, no relacion real)", () => {
    const equipmentTabs = buildSheetPayloads({
      template: loadTemplateDefinition(),
      equipmentRecords: [{ id: 19, name: "cobas U 411 analyser w barcode" }],
      payload: { fields: {}, sync_items: [], sheet_context: {} },
    });

    expect(equipmentTabs).toEqual([]);
  });
});
