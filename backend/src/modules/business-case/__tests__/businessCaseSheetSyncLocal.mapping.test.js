const XLSX = require("xlsx");
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
    // Fila 153 (material, "ise standard low 10x3ml"): columna precisa de
    // empty_fill_targets_objective para DET/AÑO PROCESO.
    expect(definition.rows.find((row) => row.rowNumber === 153)).toEqual(
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

  // Bug reportado: c303/c503 no detectaba "control" en absoluto (item_type
  // quedaba "calibrador" para todo el bloque). Causa: la pestaña c303/c503
  // trae un unico encabezado fusionado "CONTROLES Y CALIBRADORES" (fila 84);
  // inferItemTypeFromSectionLabel resuelve "calibrador" primero porque el
  // string contiene ambas palabras. Confirmado contra BC real
  // 54762e41-74c9-45fb-80e0-454b9bf040a8: todo producto de control real trae
  // "control" en su propio nombre (precicontrol, "d dimer gen 2 control i ii",
  // "rf control set"...), asi que ahora se usa el nombre de fila para
  // desambiguar dentro de ese bloque en vez de solo la seccion.
  test("distingue control vs calibrador dentro del bloque fusionado c303/c503", () => {
    const definition = loadTemplateDefinition().equipmentSheets.find((sheet) => sheet.name === "c303 c503");
    expect(definition).toBeDefined();

    const byItemId = (id) => definition.rows.find((row) => row.itemId === id);

    // Controles reales (nombre de fila contiene "control"), antes mal
    // clasificados como "calibrador":
    expect(byItemId("3121313122")?.itemType).toBe("control"); // precinorm puc
    expect(byItemId("5050936190")?.itemType).toBe("control"); // d dimer gen 2 control i ii
    expect(byItemId("3005496122")?.itemType).toBe("control"); // rf control set

    // Calibradores reales del mismo bloque siguen como "calibrador":
    expect(byItemId("3121305122")?.itemType).toBe("calibrador"); // cfas proteins u
    expect(byItemId("5852641190")?.itemType).toBe("calibrador"); // preciset lp(a) gen.2
  });

  // Garantia contra regresion: audita TODA la plantilla real (los 17+ tabs
  // de equipo) buscando encabezados de seccion que mencionen mas de una
  // categoria a la vez (control+calibrador, material+reactivo, etc.) --
  // exactamente la clase de bug reportada (BC 54762e41-74c9-45fb-80e0-454b9bf040a8).
  // Si alguien edita la plantilla o agrega un equipo nuevo con un encabezado
  // fusionado no reconocido, este test falla en vez de fallar en silencio en
  // produccion como paso con c303/c503.
  test("no aparecen encabezados de seccion ambiguos sin reconocer en ningun equipo de la plantilla", () => {
    const { templatePath } = loadTemplateDefinition();
    const workbook = XLSX.readFile(templatePath, { raw: false, cellFormula: true });

    const normalizeText = (value) =>
      String(value || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .trim()
        .toLowerCase();

    const CATEGORY_MATCHERS = {
      calibrador: (s) => s.includes("calibrador"),
      control: (s) => s.includes("control"),
      material: (s) => s.includes("consumible") || s.includes("material") || s.includes("insumo"),
      reactivo: (s) => s === "i d" || s === "id" || s.includes("det ano") || s.includes("determinacion"),
    };

    // Unico caso conocido y manejado (ver inferItemTypeByRow): desambigua
    // por nombre de fila. Cualquier otro hallazgo aqui es una regresion.
    const KNOWN_HANDLED = new Set(["c303 c503:83"]);

    const found = [];
    for (const sheetName of workbook.SheetNames) {
      if (sheetName === "BC") continue;
      const ws = workbook.Sheets[sheetName];
      if (!ws["!ref"]) continue;
      const range = XLSX.utils.decode_range(ws["!ref"]);
      for (let r = range.s.r; r <= range.e.r; r += 1) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
        if (!cell?.v) continue;
        const normalized = normalizeText(cell.v);
        const matches = Object.keys(CATEGORY_MATCHERS).filter((key) => CATEGORY_MATCHERS[key](normalized));
        if (matches.length > 1) {
          found.push({ key: `${sheetName}:${r + 1}`, sheetName, row: r + 1, label: cell.v, matches });
        }
      }
    }

    const unhandled = found.filter((entry) => !KNOWN_HANDLED.has(entry.key));
    expect(unhandled).toEqual([]);
  });
});
