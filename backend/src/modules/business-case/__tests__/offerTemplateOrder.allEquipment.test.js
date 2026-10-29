// Garantia de orden de la oferta para TODOS los equipos de la tabla base.
//
// La sincronizacion de precios lee la oferta por posicion de fila: si una
// seccion no sigue el orden del Sheet del BC, los precios caen en el producto
// equivocado. Este test recorre cada pestana real de la plantilla y simula lo
// que entrega el catalogo en produccion:
//   - items en orden de BD (invertido respecto a la hoja),
//   - codigos repetidos en la hoja (variantes c303/c503) que llegan sin codigo,
//   - nombres con puntuacion distinta a la etiqueta normalizada de la hoja,
//   - filas de encabezado sin codigo ni tipo,
//   - tipo del catalogo distinto al de la hoja (XN-L/XP 300/b123 tipan todo
//     como "reactivo"; el catalogo trae control/material con el mismo codigo).
// Si se agrega un equipo nuevo a la plantilla, queda cubierto automaticamente.
jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock("../../../config/google", () => ({ drive: {}, sheets: {} }));
jest.mock("../businessCaseDriveFolder.service", () => ({ ensureBusinessCaseDriveFolderById: jest.fn() }));
jest.mock("../businessCaseSheetGeneration.service", () => ({ recordDocumentVersion: jest.fn() }));
jest.mock("../../notifications/notificationManager", () => ({ sendNotification: jest.fn() }));

const { loadTemplateDefinition } = require("../businessCaseSheetSyncLocal.service");
const service = require("../businessCaseOffer.service");

// El cobas Pure <303> (id 9) es el unico con bloque combinado controles+calibradores.
const PURE_303 = { equipment_id: 9, equipment_name: "cobas Pure <303>" };

const OTHER_TYPE = { reactivo: "control", control: "material", calibrador: "control", material: "reactivo" };

function buildCatalogItemsForTab(tab, tabIndex, { catalogTypeDiffers = false } = {}) {
  const equipment = tab.name.trim() === "c303 c503"
    ? PURE_303
    : { equipment_id: 9000 + tabIndex, equipment_name: tab.name.trim() };
  const productRows = tab.rows.filter((row) => row.itemId || row.itemType);
  const seenIds = new Set();
  const items = productRows.map((row, index) => {
    const id = String(row.itemId || "").trim();
    const repeatedId = Boolean(id) && seenIds.has(id);
    if (id) seenIds.add(id);
    const templateType = row.itemType || "material";
    return {
      ...equipment,
      item_key: `t${tabIndex}:${row.rowNumber}`,
      item_id: repeatedId ? null : id || null,
      code: repeatedId ? null : id || null,
      name: row.rawLabel || row.label,
      // Solo los items con codigo pueden diferir de tipo: sin codigo, el tipo es lo unico que los distingue.
      item_type: catalogTypeDiffers && id && !repeatedId ? OTHER_TYPE[templateType] || templateType : templateType,
      source: "catalog",
      source_order: productRows.length - index,
    };
  });
  return items.reverse();
}

const rowOfItemKey = (itemKey) => Number(String(itemKey).split(":")[1]);
const isAscending = (rows) => rows.every((row, index) => index === 0 || row > rows[index - 1]);

const tabs = loadTemplateDefinition().equipmentSheets;

describe("orden de la oferta = orden de filas de la tabla base, para todos los equipos", () => {
  test("la plantilla tiene pestanas de equipo", () => {
    expect(tabs.length).toBeGreaterThan(0);
  });

  const cases = tabs.flatMap((tab, index) => [
    [`${tab.name.trim()} (tipo de la hoja)`, tab, index, false],
    [`${tab.name.trim()} (tipo del catalogo distinto)`, tab, index, true],
  ]);

  test.each(cases)("%s", async (_name, tab, tabIndex, catalogTypeDiffers) => {
    const items = buildCatalogItemsForTab(tab, tabIndex, { catalogTypeDiffers });

    const { matchedItemKeys } = service.__testables.buildOfferItemTemplateOrder(items);
    const unmatched = items.filter((item) => !matchedItemKeys.has(item.item_key)).map((item) => item.name);
    expect(unmatched).toEqual([]);

    const payload = await service.__testables.buildOfferTemplatePayload(
      { client_name: "Cliente Demo", bc_purchase_type: "public" },
      items,
      { email: "test@demo.com" },
    );
    const sections = payload.sections || {};
    const offeredKeys = [];
    Object.entries(sections).forEach(([sectionKey, rows]) => {
      const sheetRows = (rows || []).map((row) => rowOfItemKey(row.itemKey));
      offeredKeys.push(...(rows || []).map((row) => row.itemKey));
      expect({ section: sectionKey, ascending: isAscending(sheetRows) }).toEqual({ section: sectionKey, ascending: true });
    });
    // Ningun producto de la hoja se pierde ni se duplica.
    expect(offeredKeys.sort()).toEqual(items.map((item) => item.item_key).sort());
  });
});
