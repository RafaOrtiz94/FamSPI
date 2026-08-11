const {
  loadTemplateDefinition,
  buildAnnualQuantityProtectionRanges,
} = require("../businessCaseSheetSyncLocal.service");

describe("business case sheet quantity mapping", () => {
  // Confirmado contra la hoja real: la cantidad anual tiene DOS columnas con
  // dueño distinto (regla de negocio, no de proximidad de fila):
  //   - "DET/AÑO PROCESO" (annualComercial): la llena acp_comercial, aplica a
  //     item_type=reactivo.
  //   - "PRODUCTO CALCULADO" (annualServicio): columna calculada por formula,
  //     la llena jefe_servicio, aplica a control/calibrador/material.
  // El equipo "c303 c503" tiene AMBAS columnas declaradas en distintos
  // bloques de la misma pestaña (fila 8 y fila 84); cada una se resuelve por
  // separado, sin mezclarse.
  test("preserves populated technical rows and resolves both annual columns independently", () => {
    const definition = loadTemplateDefinition().equipmentSheets.find((sheet) => sheet.name === "c303 c503");

    expect(definition).toBeDefined();
    // Fila 85 (bloque tecnico): su propio header "PRODUCTO CALCULADO" esta en
    // la fila 84, columna G (7) -- no el de la fila 8 (bloque de reactivos).
    expect(definition.rows.find((row) => row.rowNumber === 85)?.columns.annualServicio).toBe(7);
    // Fila 148 (reactivo, "ise standard low 10x3ml"): columna precisa de
    // empty_fill_targets_objective para DET/AÑO PROCESO.
    expect(definition.rows.find((row) => row.rowNumber === 148)).toEqual(
      expect.objectContaining({
        itemId: "11183974216",
        columns: expect.objectContaining({ annualComercial: 3 }),
      }),
    );
  });

  // Confirmado directamente contra la hoja real de "b123" (cobas b 123 POC
  // system): el encabezado de fila 8 es E="DET/AÑO/PROCESO", F="PRODUCTO
  // CALCULADO", H="PRODUCTO A ENVIAR". Ambas columnas existen para el mismo
  // bloque de filas (9-16) -- la eleccion de cual usar depende del item_type
  // de cada fila (ver _annualColumnCategory), no de cual columna esta mas
  // cerca (las dos estan igual de cerca, en la misma fila 8).
  test("resolves both DET/AÑO PROCESO and PRODUCTO CALCULADO columns for every b123 row", () => {
    const definition = loadTemplateDefinition().equipmentSheets.find((sheet) => sheet.name === "b123");
    const rows = definition.rows.filter((row) => row.rowNumber >= 9 && row.rowNumber <= 16);

    expect(rows).toHaveLength(8);
    expect(rows.every((row) => row.columns.annualComercial === 5)).toBe(true);
    expect(rows.every((row) => row.columns.annualServicio === 6)).toBe(true);
    expect(rows.map((row) => row.itemId)).toEqual([
      "5169992001",
      "3321207001",
      "3321193001",
      "3321215001",
      "5170478001",
      "5082595001",
      "5689856001",
      "3066762001",
    ]);
  });

  // Regla operativa validada contra hojas reales: reactivos protegen DET/AÑO
  // PROCESO y las subsecciones tecnicas protegen PRODUCTO A ENVIAR/ENTREGAR,
  // porque en c303/c503 PRODUCTO CALCULADO puede estar vacio.
  test("protects only the validated technical subsection delivery cells (servicio -> PRODUCTO A ENVIAR)", () => {
    const template = loadTemplateDefinition();
    const equipmentTabs = [{
      sheet_name: "b123",
      items: [
        { item_id: "5169992001", item_name: "FLUID PACK COOX 200", item_type: "reactivo" },
        { item_id: "3321207001", item_name: "COMBITROL PLUS B LEVEL 2 30 PCS", item_type: "control" },
        { item_id: "5170478001", item_name: "SENSOR CARTRIDGE BG ISE GLU LAC", item_type: "material" },
      ],
    }];

    const ranges = buildAnnualQuantityProtectionRanges({
      template,
      equipmentTabs,
      businessCaseId: "bc-test",
      subsection: "controles",
    });

    expect(ranges).toEqual([
      expect.objectContaining({
        description: expect.stringContaining(":controles:b123:10-10"),
        range: expect.objectContaining({
          sheetTitle: "b123",
          startRowIndex: 9,
          endRowIndex: 10,
          startColumnIndex: 7,
          endColumnIndex: 8,
        }),
      }),
    ]);
  });

  test("protects the reactivos subsection using DET/AÑO PROCESO (columna E), no PRODUCTO CALCULADO", () => {
    const template = loadTemplateDefinition();
    const equipmentTabs = [{
      sheet_name: "b123",
      items: [
        { item_id: "5169992001", item_name: "FLUID PACK COOX 200", item_type: "reactivo" },
      ],
    }];

    const ranges = buildAnnualQuantityProtectionRanges({
      template,
      equipmentTabs,
      businessCaseId: "bc-test",
      subsection: "reactivos",
    });

    expect(ranges).toEqual([
      expect.objectContaining({
        description: expect.stringContaining(":reactivos:b123:9-9"),
        range: expect.objectContaining({
          sheetTitle: "b123",
          startRowIndex: 8,
          endRowIndex: 9,
          startColumnIndex: 4,
          endColumnIndex: 5,
        }),
      }),
    ]);
  });
});
