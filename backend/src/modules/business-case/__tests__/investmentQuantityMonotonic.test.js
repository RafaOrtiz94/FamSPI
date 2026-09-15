jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const db = require("../../../config/db");
const investments = require("../investments.service");

// Sin carrito ni dueno por item: la unica proteccion contra pisar el
// trabajo de otro es que la cantidad nunca puede bajar, solo subir.
describe("investment selection quantity is monotonic (never decreases)", () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  it("rejects a lower quantity than the one already saved", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, quantity: 5 }] }); // existing row

    await expect(
      investments.upsertInvestmentSelection(
        "bc-1",
        { catalog_id: 42, quantity: 3, characteristics: "x" },
        { role: "jefe_logistica", email: "logistica@fam-project.com" },
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "INVESTMENT_QUANTITY_CANNOT_DECREASE",
    });

    expect(db.query).toHaveBeenCalledTimes(1); // never reached the INSERT
  });

  it("allows a higher quantity than the one already saved", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, quantity: 5 }] }) // existing row
      .mockResolvedValueOnce({ rows: [{ id: 1, catalog_id: 42, quantity: 10, selected: true }] }); // upsert result

    const result = await investments.upsertInvestmentSelection(
      "bc-1",
      { catalog_id: 42, quantity: 10, characteristics: "x" },
      { role: "jefe_logistica", email: "logistica@fam-project.com" },
    );

    expect(result.quantity).toBe(10);
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});
