jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("../businessCaseSheetSyncLocal.service", () => ({
  loadTemplateDefinition: jest.fn(() => ({ equipmentSheets: [] })),
  buildSheetPayloads: jest.fn(() => [{ sheet_name: "b123", equipment_ids: [6], items: [] }]),
  pullAnnualQuantitiesFromGoogleSheet: jest.fn(async () => [
    // Sheet tiene cantidad para un item que NO existe todavia en bc_consumption_items
    { item_key: "cons:6:500", annual_qty: 42 },
  ]),
  pullReferenceQuantitiesFromGoogleSheet: jest.fn(async () => []),
  pullMaximumQuantitiesFromGoogleSheet: jest.fn(async () => []),
}));

const db = require("../../../config/db");
const sheetSync = require("../businessCaseSheetSyncLocal.service");

describe("scratch: sync crea items nuevos desde el Sheet (no solo actualiza)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sheetSync.pullAnnualQuantitiesFromGoogleSheet.mockResolvedValue([
      // Sheet tiene cantidad para un item que NO existe todavia en bc_consumption_items
      { item_key: "cons:6:500", annual_qty: 42 },
    ]);
    sheetSync.pullReferenceQuantitiesFromGoogleSheet.mockResolvedValue([]);
    sheetSync.pullMaximumQuantitiesFromGoogleSheet.mockResolvedValue([]);
  });

  test("bc_consumption_items vacia + catalogo con match -> crea el item con annual_qty del Sheet", async () => {
    let syncedItems = null;

    db.query.mockImplementation((sql, params) => {
      const text = typeof sql === "string" ? sql : "";
      if (text.includes("FROM v_business_cases WHERE business_case_id")) {
        return Promise.resolve({ rows: [{ uses_modern_system: true, bc_system_type: "modern" }] });
      }
      if (text.includes("modern_bc_metadata") && text.includes("FROM equipment_purchase_requests")) {
        return Promise.resolve({ rows: [{ modern_bc_metadata: { bc_sheet_generation: { last: { sheet_id: "SHEET123" } } }, extra: {} }] });
      }
      if (text.includes("FROM bc_consumption_items") && text.includes("WHERE business_case_id")) {
        return Promise.resolve({ rows: [] }); // tabla vacia, como en el BC real
      }
      if (text.includes("FROM bc_consumption_excluded")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("FROM bc_equipment_selection")) {
        return Promise.resolve({ rows: [{ equipment_id: 6 }] });
      }
      if (text.includes("FROM v_equipment_full_catalog")) {
        return Promise.resolve({ rows: [{ equipment_id: 6, equipment_name: "cobas b 123 POC system" }] });
      }
      if (text.includes("FROM catalog_equipment_consumables")) {
        return Promise.resolve({
          rows: [{ equipment_id: 6, catalog_id: 500, name: "COMBITROL PLUS B LEVEL 1 30 PCS", item_type: "control", supplier_code: "3321193001" }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const client = {
      query: jest.fn((sql, params) => {
        const text = typeof sql === "string" ? sql : "";
        if (text.includes("INSERT INTO bc_consumption_items")) {
          syncedItems = JSON.parse(params[1]);
        }
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn(),
    };
    db.getClient = jest.fn(async () => client);

    // recalculateBusinessCase se llama despues -- solo importa que no explote
    const service = require("../businessCase.service");
    jest.spyOn(service, "recalculateBusinessCase").mockResolvedValue(null).mockName("recalculateBusinessCase");

    const result = await service.syncConsumptionQuantitiesFromSheet("bc-real-test");

    console.log("RESULT:", { updated: result.updated, created: result.created });
    console.log("PERSISTED ITEM:", syncedItems?.[0]);

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(syncedItems).toHaveLength(1);
    expect(syncedItems[0]).toEqual(
      expect.objectContaining({
        item_key: "cons:6:500",
        item_id: "3321193001",
        name: "COMBITROL PLUS B LEVEL 1 30 PCS",
        item_type: "control",
        annual_qty: 42,
        equipment_id: 6,
      }),
    );
  });

  test("crea item tecnico cuando solo llega planned_qty desde Producto a Enviar", async () => {
    let syncedItems = null;

    sheetSync.pullAnnualQuantitiesFromGoogleSheet.mockResolvedValue([]);
    sheetSync.pullMaximumQuantitiesFromGoogleSheet.mockResolvedValue([
      { item_key: "cons:6:501", planned_qty: 12 },
    ]);

    db.query.mockImplementation((sql) => {
      const text = typeof sql === "string" ? sql : "";
      if (text.includes("FROM v_business_cases WHERE business_case_id")) {
        return Promise.resolve({ rows: [{ uses_modern_system: true, bc_system_type: "modern" }] });
      }
      if (text.includes("modern_bc_metadata") && text.includes("FROM equipment_purchase_requests")) {
        return Promise.resolve({ rows: [{ modern_bc_metadata: { bc_sheet_generation: { last: { sheet_id: "SHEET123" } } }, extra: {} }] });
      }
      if (text.includes("FROM bc_consumption_items") && text.includes("WHERE business_case_id")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("FROM bc_consumption_excluded")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("FROM bc_equipment_selection")) {
        return Promise.resolve({ rows: [{ equipment_id: 6 }] });
      }
      if (text.includes("FROM v_equipment_full_catalog")) {
        return Promise.resolve({ rows: [{ equipment_id: 6, equipment_name: "cobas b 123 POC system" }] });
      }
      if (text.includes("FROM catalog_equipment_consumables")) {
        return Promise.resolve({
          rows: [{ equipment_id: 6, catalog_id: 501, name: "PRECICONTROL TEST", item_type: "control", supplier_code: "CTRL001" }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const client = {
      query: jest.fn((sql, params) => {
        const text = typeof sql === "string" ? sql : "";
        if (text.includes("INSERT INTO bc_consumption_items")) {
          syncedItems = JSON.parse(params[1]);
        }
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn(),
    };
    db.getClient = jest.fn(async () => client);

    const service = require("../businessCase.service");
    jest.spyOn(service, "recalculateBusinessCase").mockResolvedValue(null).mockName("recalculateBusinessCase");

    const result = await service.syncConsumptionQuantitiesFromSheet("bc-real-test");

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(syncedItems).toHaveLength(1);
    expect(syncedItems[0]).toEqual(
      expect.objectContaining({
        item_key: "cons:6:501",
        item_id: "CTRL001",
        name: "PRECICONTROL TEST",
        item_type: "control",
        annual_qty: 0,
        planned_qty: 12,
        equipment_id: 6,
      }),
    );
  });

  test("incluye equipos adicionales guardados en extra.equipment_details aunque bc_equipment_selection tenga solo uno", async () => {
    let catalogEquipmentIds = null;
    let syncedItems = null;

    sheetSync.buildSheetPayloads.mockImplementation(({ payload }) => [
      {
        sheet_name: "c303 c503",
        equipment_ids: [9],
        equipment_names: ["cobas Pure <303>"],
        items: (payload.sync_items || []).filter((item) => Number(item.equipment_id) === 9),
      },
      {
        sheet_name: "e411",
        equipment_ids: [12],
        equipment_names: ["cobas e411 disk"],
        items: (payload.sync_items || []).filter((item) => Number(item.equipment_id) === 12),
      },
    ]);
    sheetSync.pullAnnualQuantitiesFromGoogleSheet.mockResolvedValue([
      { item_key: "cons:9:561", annual_qty: 100 },
      { item_key: "cons:12:900", annual_qty: 200 },
    ]);
    sheetSync.pullReferenceQuantitiesFromGoogleSheet.mockResolvedValue([]);
    sheetSync.pullMaximumQuantitiesFromGoogleSheet.mockResolvedValue([]);

    db.query.mockImplementation((sql, params) => {
      const text = typeof sql === "string" ? sql : "";
      if (text.includes("FROM v_business_cases WHERE business_case_id")) {
        return Promise.resolve({ rows: [{ uses_modern_system: true, bc_system_type: "modern" }] });
      }
      if (text.includes("modern_bc_metadata") && text.includes("FROM equipment_purchase_requests")) {
        return Promise.resolve({
          rows: [{
            modern_bc_metadata: { bc_sheet_generation: { last: { sheet_id: "SHEET123" } } },
            extra: {
              equipment_details: [
                { primary_id: 9, primary_name: "cobas Pure <303>" },
                { primary_id: 12, primary_name: "cobas e411 disk" },
              ],
            },
          }],
        });
      }
      if (text.includes("FROM bc_consumption_items") && text.includes("WHERE business_case_id")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("FROM bc_consumption_excluded")) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes("FROM bc_equipment_selection")) {
        return Promise.resolve({ rows: [{ equipment_id: 9 }] });
      }
      if (text.includes("FROM v_equipment_full_catalog")) {
        return Promise.resolve({
          rows: [
            { equipment_id: 9, equipment_name: "cobas Pure <303>" },
            { equipment_id: 12, equipment_name: "cobas e411 disk" },
          ],
        });
      }
      if (text.includes("FROM catalog_equipment_consumables")) {
        catalogEquipmentIds = params[0];
        return Promise.resolve({
          rows: [
            { equipment_id: 9, catalog_id: 561, name: "ALT", item_type: "reactivo", supplier_code: "8104697190" },
            { equipment_id: 12, catalog_id: 900, name: "ACTH ELECSYS COBAS E", item_type: "reactivo", supplier_code: "8946710190" },
          ],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const client = {
      query: jest.fn((sql, params) => {
        const text = typeof sql === "string" ? sql : "";
        if (text.includes("INSERT INTO bc_consumption_items")) {
          syncedItems = JSON.parse(params[1]);
        }
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn(),
    };
    db.getClient = jest.fn(async () => client);

    const service = require("../businessCase.service");
    jest.spyOn(service, "recalculateBusinessCase").mockResolvedValue(null).mockName("recalculateBusinessCase");

    const result = await service.syncConsumptionQuantitiesFromSheet("bc-multi-equipment");

    expect(catalogEquipmentIds).toEqual(expect.arrayContaining([9, 12]));
    expect(result.created).toBe(2);
    expect(syncedItems.map((item) => item.equipment_id).sort((left, right) => left - right)).toEqual([9, 12]);
    expect(syncedItems.find((item) => item.equipment_id === 12)).toEqual(
      expect.objectContaining({
        item_key: "cons:12:900",
        item_id: "8946710190",
        item_type: "reactivo",
        annual_qty: 200,
      }),
    );
  });
});
