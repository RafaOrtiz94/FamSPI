jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const db = require("../../../config/db");
const investments = require("../investments.service");

// Sin carrito ni dueno por item: la proteccion contra pisar el trabajo de
// otro es que la cantidad nunca puede bajar, solo subir -- EXCEPTO para
// quien agrego esa inversion originalmente (owner_email), que si puede
// disminuirla o dejarla en 0.
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

  it("rejects a lower quantity from someone other than the owner, even with an edit-enabled role", async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, quantity: 5, owner_email: "comercial@fam-project.com" }],
    });

    await expect(
      investments.upsertInvestmentSelection(
        "bc-1",
        { catalog_id: 42, quantity: 2, characteristics: "x" },
        { role: "jefe_logistica", email: "logistica@fam-project.com" },
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "INVESTMENT_QUANTITY_CANNOT_DECREASE",
    });

    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it("allows the owner (whoever added the investment) to decrease the quantity, even down to 0", async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, quantity: 5, owner_email: "comercial@fam-project.com" }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 1, catalog_id: 42, quantity: 0, selected: false }] });

    const result = await investments.upsertInvestmentSelection(
      "bc-1",
      { catalog_id: 42, quantity: 0, characteristics: "x" },
      { role: "comercial", email: "Comercial@Fam-Project.com" }, // case-insensitive on purpose
    );

    expect(result.quantity).toBe(0);
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});
