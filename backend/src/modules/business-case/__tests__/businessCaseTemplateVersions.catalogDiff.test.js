jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../businessCaseSheetSyncLocal.service", () => {
  const actual = jest.requireActual("../businessCaseSheetSyncLocal.service");
  return { ...actual, loadTemplateDefinition: jest.fn() };
});

const db = require("../../../config/db");
const sheetSync = require("../businessCaseSheetSyncLocal.service");
const { computeCatalogDiff } = require("../businessCaseTemplateVersions.service");

// El catalogo de reactivos/calibradores/controles/materiales por equipo
// (catalog_consumables + catalog_equipment_consumables) vive en
// servicio.equipos, NO en equipment_models -- confirmado via el FK real de
// catalog_equipment_consumables.equipment_id. Si el matching de equipo
// llegara a adivinar mal (ej. dos equipos "XNL 550" con/sin licencias
// contra una sola pestaña ambigua), aplicar el diff borraria/crearia
// vinculos de catalogo equivocados en produccion -- por eso el matching
// exige señal numerica de modelo sin ambiguedad, y deja sin mapear (no
// adivina) cuando hay 0 o 2+ candidatos.
describe("computeCatalogDiff", () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  test("matches una pestaña a su equipo por alias numerico sin ambiguedad y arma el diff added/removed", async () => {
    sheetSync.loadTemplateDefinition.mockReturnValue({
      equipmentSheets: [
        {
          name: "c111",
          aliases: ["c111", "cobas c111", "cobasc111"],
          rows: [
            { itemId: "1", label: "glucosa", rawLabel: "Glucosa", itemType: "reactivo" },
            { itemId: "2", label: "urea", rawLabel: "Urea", itemType: "reactivo" },
          ],
        },
        {
          // Sin ningun alias numerico y sin grupo explicito definido para
          // este nombre -- no hay señal para resolverla sin adivinar.
          name: "Sin Numero De Modelo",
          aliases: ["sinnumerodemodelo"],
          rows: [],
        },
      ],
    });

    db.query.mockImplementation((sql) => {
      if (sql.includes("FROM servicio.equipos")) {
        return Promise.resolve({
          rows: [
            { id: 2, code: "4528778001", name: "cobas c111", manufacturer: "Roche", model: "cobas c111" },
            { id: 25, code: "7744820001-CON", name: "XNL 550 (con licencias)", manufacturer: "Sysmex", model: "XNL 550 (con licencias)" },
            { id: 27, code: "7744820001-SIN", name: "XNL 550 (sin licencias)", manufacturer: "Sysmex", model: "XNL 550 (sin licencias)" },
          ],
        });
      }
      if (sql.includes("catalog_equipment_consumables")) {
        return Promise.resolve({
          rows: [
            { equipment_id: 2, consumable_id: 10, name: "Glucosa", type: "reactivo" },
            { equipment_id: 2, consumable_id: 11, name: "Creatinina", type: "reactivo" },
          ],
        });
      }
      throw new Error(`query inesperada: ${sql}`);
    });

    const diff = await computeCatalogDiff();

    expect(diff.unmatched_sheets).toEqual(["Sin Numero De Modelo"]);
    expect(diff.equipment).toHaveLength(1);
    expect(diff.equipment[0]).toMatchObject({
      equipment_id: 2,
      equipment_name: "cobas c111",
      sheet_name: "c111",
      added: [{ name: "Urea", type: "reactivo" }],
      removed: [{ consumable_id: 11, name: "Creatinina", type: "reactivo" }],
    });
  });

  test("pestaña combo (2 numeros de modelo distintos, ej. cobas Pure = e402+c303): aplica el mismo diff a AMBOS equipos", async () => {
    sheetSync.loadTemplateDefinition.mockReturnValue({
      equipmentSheets: [
        {
          name: "e402 e801",
          aliases: ["e402", "e801", "cobaspure402"],
          // 2 filas con tipos distintos -- la pestaña SI expresa tipo de
          // forma confiable (a diferencia de XP 300/XN-L/etc, que solo
          // traen "reactivo" siempre), asi que el match debe ser type+nombre.
          rows: [
            { itemId: "1", label: "tsh", rawLabel: "TSH Elecsys", itemType: "reactivo" },
            { itemId: "2", label: "ftsh calset", rawLabel: "FTSH CalSet", itemType: "calibrador" },
          ],
        },
      ],
    });
    db.query.mockImplementation((sql) => {
      if (sql.includes("FROM servicio.equipos")) {
        return Promise.resolve({
          rows: [
            { id: 13, code: "9031553001", name: "cobas Pure <402>", manufacturer: "Roche", model: "cobas Pure <402>" },
            { id: 14, code: "8454345001", name: "cobas 8000 <801>", manufacturer: "Roche", model: "cobas 8000 <801>" },
          ],
        });
      }
      if (sql.includes("catalog_equipment_consumables")) return Promise.resolve({ rows: [] });
      throw new Error(`query inesperada: ${sql}`);
    });

    const diff = await computeCatalogDiff();

    expect(diff.unmatched_sheets).toEqual([]);
    expect(diff.equipment).toHaveLength(2);
    const equipmentIds = diff.equipment.map((e) => e.equipment_id).sort();
    expect(equipmentIds).toEqual([13, 14]);
    diff.equipment.forEach((e) => {
      expect(e.added).toEqual([
        { name: "TSH Elecsys", type: "reactivo" },
        { name: "FTSH CalSet", type: "calibrador" },
      ]);
    });
  });

  test("grupo de variantes de licencia (mismo modelo, con/sin licencias): aplica el mismo diff a todas las variantes", async () => {
    // La señal de modelo se toma SOLO del nombre de la pestaña (nunca de
    // celdas internas, ver nota en computeCatalogDiff) -- por eso esta
    // prueba usa una pestaña cuyo NOMBRE ya trae el numero de modelo
    // ("XN 1000"), como la pestaña real. Una pestaña sin numero en su
    // nombre (ej. "XN-L") queda sin mapear a proposito: es una limitacion
    // conocida y aceptada, no un bug -- se resuelve a mano si la pestaña
    // real nunca incluye el numero en su nombre.
    sheetSync.loadTemplateDefinition.mockReturnValue({
      equipmentSheets: [
        {
          name: "XN 1000",
          aliases: ["xn1000"],
          rows: [
            { itemId: "1", label: "cellpack dcl", rawLabel: "CELLPACK DCL", itemType: "reactivo" },
          ],
        },
      ],
    });
    db.query.mockImplementation((sql) => {
      if (sql.includes("FROM servicio.equipos")) {
        return Promise.resolve({
          rows: [
            { id: 21, code: "FAM-XN1000-CON-WG", name: "XN-1000 (con licencias) [WG]", manufacturer: "Sysmex", model: "XN-1000 (con licencias) [WG]" },
            { id: 24, code: "FAM-XN1000-SIN-SINWG", name: "XN-1000 (sin licencias) [sin WG]", manufacturer: "Sysmex", model: "XN-1000 (sin licencias) [sin WG]" },
          ],
        });
      }
      if (sql.includes("catalog_equipment_consumables")) return Promise.resolve({ rows: [] });
      throw new Error(`query inesperada: ${sql}`);
    });

    const diff = await computeCatalogDiff();

    expect(diff.unmatched_sheets).toEqual([]);
    const equipmentIds = diff.equipment.map((e) => e.equipment_id).sort();
    expect(equipmentIds).toEqual([21, 24]);
  });

  test("pestaña 'XN-L' (grupo explicito, sin numero de modelo en el nombre): aplica el mismo diff a las 6 variantes XNL confirmadas por comercial", async () => {
    sheetSync.loadTemplateDefinition.mockReturnValue({
      equipmentSheets: [
        {
          name: "XN-L",
          aliases: ["xnl"],
          rows: [
            { itemId: "1", label: "cellclean auto", rawLabel: "CELLCLEAN AUTO 4 ML X 20", itemType: "material" },
          ],
        },
      ],
    });
    const xnlNames = [
      "XNL 550 (con licencias)", "XNL 550 (sin licencias)",
      "XNL 450 (con licencias)", "XNL 450 (sin licencias)",
      "XNL 350 (con licencias)", "XNL 350 (sin licencias)",
    ];
    db.query.mockImplementation((sql) => {
      if (sql.includes("FROM servicio.equipos")) {
        return Promise.resolve({
          rows: xnlNames.map((name, index) => ({
            id: 100 + index, code: `CODE-${index}`, name, manufacturer: "Sysmex", model: name,
          })),
        });
      }
      if (sql.includes("catalog_equipment_consumables")) return Promise.resolve({ rows: [] });
      throw new Error(`query inesperada: ${sql}`);
    });

    const diff = await computeCatalogDiff();

    expect(diff.unmatched_sheets).toEqual([]);
    expect(diff.equipment).toHaveLength(6);
    diff.equipment.forEach((e) => {
      expect(e.added).toEqual([{ name: "CELLCLEAN AUTO 4 ML X 20", type: "material" }]);
    });
  });

  test("2 equipos genuinamente distintos (no son variantes de licencia) sin señal de modelo clara: no adivina, queda sin mapear", async () => {
    sheetSync.loadTemplateDefinition.mockReturnValue({
      equipmentSheets: [
        { name: "ambiguo 500", aliases: ["ambiguo500", "500"], rows: [] },
      ],
    });
    db.query.mockImplementation((sql) => {
      if (sql.includes("FROM servicio.equipos")) {
        return Promise.resolve({
          rows: [
            { id: 40, code: "AAA-500", name: "Equipo Alfa 500", manufacturer: "X", model: "Alfa 500" },
            { id: 41, code: "BBB-500", name: "Equipo Beta 500", manufacturer: "Y", model: "Beta 500" },
          ],
        });
      }
      if (sql.includes("catalog_equipment_consumables")) return Promise.resolve({ rows: [] });
      throw new Error(`query inesperada: ${sql}`);
    });

    const diff = await computeCatalogDiff();

    expect(diff.unmatched_sheets).toEqual(["ambiguo 500"]);
    expect(diff.equipment).toEqual([]);
  });

  test("trata 'consumible' y 'material' como el mismo tipo al comparar (no reporta cambio falso)", async () => {
    sheetSync.loadTemplateDefinition.mockReturnValue({
      equipmentSheets: [
        {
          name: "c111",
          aliases: ["c111"],
          rows: [
            { itemId: "9", label: "sample cup", rawLabel: "Sample Cup", itemType: "material" },
          ],
        },
      ],
    });
    db.query.mockImplementation((sql) => {
      if (sql.includes("FROM servicio.equipos")) {
        return Promise.resolve({ rows: [{ id: 2, code: "4528778001", name: "cobas c111", manufacturer: "Roche", model: "cobas c111" }] });
      }
      if (sql.includes("catalog_equipment_consumables")) {
        return Promise.resolve({ rows: [{ equipment_id: 2, consumable_id: 55, name: "Sample Cup", type: "consumible" }] });
      }
      throw new Error(`query inesperada: ${sql}`);
    });

    const diff = await computeCatalogDiff();
    expect(diff.equipment).toEqual([]);
    expect(diff.has_changes).toBe(false);
  });

  // Bug real confirmado contra el archivo activo: pestañas como "XP 300"/
  // "XN-L"/"XN 1000"/"t411 h232"/"AVL 9180"/"b123"/"b101" organizan sus
  // filas por parametro clinico y NUNCA traen un encabezado CONTROLES/
  // CALIBRADORES/MATERIALES -- itemType siempre cae al default "reactivo".
  // Comparar por type+nombre ahi generaba falsos "agregar como Reactivo +
  // quitar el Control/Material real" para el MISMO producto ya curado en
  // el catalogo. Debe compararse solo por nombre cuando la pestaña nunca
  // demuestra tener mas de un tipo real.
  test("pestaña sin encabezados de tipo (todo 'reactivo' por defecto): compara solo por nombre, no marca cambio falso de tipo", async () => {
    sheetSync.loadTemplateDefinition.mockReturnValue({
      equipmentSheets: [
        {
          name: "XP 300",
          aliases: ["xp300"],
          rows: [
            { itemId: "1", label: "eight check-3wp xtra", rawLabel: "EIGHT CHECK-3WP XTRA", itemType: "reactivo" },
          ],
        },
      ],
    });
    db.query.mockImplementation((sql) => {
      if (sql.includes("FROM servicio.equipos")) {
        return Promise.resolve({ rows: [{ id: 1, code: "3145611001", name: "XP 300", manufacturer: "Sysmex", model: "XP 300" }] });
      }
      if (sql.includes("catalog_equipment_consumables")) {
        // El catalogo ya tiene este producto pero clasificado como Control
        // (curado a mano) -- la hoja no puede expresar ese tipo.
        return Promise.resolve({ rows: [{ equipment_id: 1, consumable_id: 200, name: "EIGHT CHECK-3WP XTRA", type: "control" }] });
      }
      throw new Error(`query inesperada: ${sql}`);
    });

    const diff = await computeCatalogDiff();

    expect(diff.equipment).toEqual([]);
    expect(diff.has_changes).toBe(false);
  });

  test("pestaña sin encabezados de tipo: un producto genuinamente nuevo se marca con type_uncertain", async () => {
    sheetSync.loadTemplateDefinition.mockReturnValue({
      equipmentSheets: [
        {
          name: "XP 300",
          aliases: ["xp300"],
          rows: [
            { itemId: "1", label: "producto nuevo", rawLabel: "Producto Nuevo", itemType: "reactivo" },
          ],
        },
      ],
    });
    db.query.mockImplementation((sql) => {
      if (sql.includes("FROM servicio.equipos")) {
        return Promise.resolve({ rows: [{ id: 1, code: "3145611001", name: "XP 300", manufacturer: "Sysmex", model: "XP 300" }] });
      }
      if (sql.includes("catalog_equipment_consumables")) return Promise.resolve({ rows: [] });
      throw new Error(`query inesperada: ${sql}`);
    });

    const diff = await computeCatalogDiff();

    expect(diff.equipment).toHaveLength(1);
    expect(diff.equipment[0].added).toEqual([
      { name: "Producto Nuevo", type: "reactivo", type_uncertain: true },
    ]);
  });
});
