jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const db = require("../../../config/db");
const investments = require("../investments.service");

// La cantidad puede subir o bajar libremente, incluido 0 (se retiro la
// restriccion de "solo aumentar" a pedido explicito de negocio, 2026-09-22).
describe("investment selection quantity can go up or down, including 0", () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  it("allows lowering a quantity that was already saved", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, catalog_id: 42, quantity: 3, selected: true }] }); // upsert result

    const result = await investments.upsertInvestmentSelection(
      "bc-1",
      { catalog_id: 42, quantity: 3, characteristics: "x" },
      { role: "jefe_logistica", email: "logistica@fam-project.com" },
    );

    expect(result.quantity).toBe(3);
    expect(db.query).toHaveBeenCalledTimes(1); // sin lookup previo, upsert directo
  });

  it("allows setting the quantity to 0", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, catalog_id: 42, quantity: 0, selected: false }] });

    const result = await investments.upsertInvestmentSelection(
      "bc-1",
      { catalog_id: 42, quantity: 0, characteristics: null },
      { role: "jefe_logistica", email: "logistica@fam-project.com" },
    );

    expect(result.quantity).toBe(0);
    expect(result.selected).toBe(false);
  });

  it("allows a higher quantity than the one already saved", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, catalog_id: 42, quantity: 10, selected: true }] });

    const result = await investments.upsertInvestmentSelection(
      "bc-1",
      { catalog_id: 42, quantity: 10, characteristics: "x" },
      { role: "jefe_logistica", email: "logistica@fam-project.com" },
    );

    expect(result.quantity).toBe(10);
  });
});
