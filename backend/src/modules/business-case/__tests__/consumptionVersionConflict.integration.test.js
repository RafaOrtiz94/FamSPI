const db = require("../../../config/db");

jest.mock("../../../config/db", () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

const businessCaseService = require("../businessCase.service");

const BUSINESS_CASE_ID = "11111111-1111-4111-8111-111111111111";

describe("Business Case consumption version conflicts (integration)", () => {
  const state = {
    items: [
      {
        item_key: "cons:10:500",
        item_id: "500",
        name: "Reactivo Demo",
        item_type: "reactivo",
        source: "catalog",
        catalog_id: 500,
        annual_qty: 120,
        equipment_id: 10,
        equipment_name: "Cobas X",
      },
    ],
    excluded: ["cons:10:999"],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    db.getClient.mockImplementation(() => {
      throw new Error("getClient no debe ser llamado en tests de conflicto de versión");
    });

    db.query.mockImplementation(async (text) => {
      const sql = String(text || "").replace(/\s+/g, " ").trim().toLowerCase();

      if (sql.includes("from v_business_cases")) {
        return { rows: [{ uses_modern_system: true, bc_system_type: "modern" }] };
      }

      if (sql.includes("from equipment_purchase_requests")) {
        return { rows: [{ uses_modern_system: true, bc_system_type: "modern" }] };
      }

      if (sql.includes("from bc_consumption_items")) {
        return { rows: state.items };
      }

      if (sql.includes("from bc_consumption_excluded")) {
        return { rows: state.excluded.map((item_key) => ({ item_key })) };
      }

      throw new Error(`Query no esperada en test: ${sql}`);
    });
  });

  it("retorna 409 cuando saveConsumptionItems recibe versión stale", async () => {
    const current = await businessCaseService.getConsumptionItems(BUSINESS_CASE_ID);

    await expect(
      businessCaseService.saveConsumptionItems(
        BUSINESS_CASE_ID,
        current.items,
        current.excluded,
        { expectedVersion: "stale-version" },
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONSUMPTION_VERSION_CONFLICT",
    });
  });

  it("acepta guardado cuando la versión coincide", async () => {
    const current = await businessCaseService.getConsumptionItems(BUSINESS_CASE_ID);

    const saved = await businessCaseService.saveConsumptionItems(
      BUSINESS_CASE_ID,
      current.items,
      current.excluded,
      { expectedVersion: current.version },
    );

    expect(saved.version).toBe(current.version);
    expect(saved.items).toHaveLength(1);
    expect(saved.excluded).toEqual(["cons:10:999"]);
  });

  it("retorna 409 en patchConsumptionItem con versión stale", async () => {
    await expect(
      businessCaseService.patchConsumptionItem(
        BUSINESS_CASE_ID,
        "cons:10:500",
        {
          annualQty: 200,
          row: {
            name: "Reactivo Demo",
            type: "reactivo",
            source: "catalog",
          },
          exclude: false,
        },
        { expectedVersion: "stale-version" },
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONSUMPTION_VERSION_CONFLICT",
    });
  });
});
