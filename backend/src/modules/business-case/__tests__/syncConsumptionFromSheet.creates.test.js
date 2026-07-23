jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("../businessCaseSheetSyncLocal.service", () => ({
  loadTemplateDefinition: jest.fn(() => ({ equipmentSheets: [] })),
  buildSheetPayloads: jest.fn(() => [{ sheet_name: "b123", equipment_ids: [6], items: [] }]),
  pullAnnualQuantitiesFromGoogleSheet: jest.fn(async () => [
    // Sheet tiene cantidad para un item que NO existe todavia en bc_consumption_items
    { item_key: "cons:6:500", annual_qty: 42 },
  ]),
}));

const db = require("../../../config/db");

describe("scratch: sync crea items nuevos desde el Sheet (no solo actualiza)", () => {
  test("bc_consumption_items vacia + catalogo con match -> crea el item con annual_qty del Sheet", async () => {
    let syncedItems = null;

    db.query.mockImplementation((sql, params) => {
      const text = typeof sql === "string" ? sql : "";
      if (text.includes("FROM v_business_cases WHERE business_case_id")) {
        return Promise.resolve({ rows: [{ uses_modern_system: true, bc_system_type: "modern" }] });
      }
      if (text.includes("modern_bc_metadata FROM equipment_purchase_requests")) {
        return Promise.resolve({ rows: [{ modern_bc_metadata: { bc_sheet_generation: { last: { sheet_id: "SHEET123" } } } }] });
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
});
