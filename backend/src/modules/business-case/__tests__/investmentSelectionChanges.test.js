jest.mock("../../../config/db", () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

const db = require("../../../config/db");
const {
  detectInvestmentSelectionChanges,
  describeInvestmentSelectionChange,
  markInvestmentPriceReviewPending,
} = require("../investments.service");

describe("precio pendiente de revisar", () => {
  beforeEach(() => db.query.mockReset().mockResolvedValue({ rows: [] }));

  test("describe cada tipo de cambio", () => {
    expect(describeInvestmentSelectionChange({ type: "added", quantity: 4 })).toBe("Agregada - cantidad 4");
    expect(describeInvestmentSelectionChange({ type: "updated", previous_quantity: 2, quantity: 5 })).toBe("Cantidad editada - de 2 a 5");
    expect(describeInvestmentSelectionChange({ type: "removed", previous_quantity: 1 })).toBe("Retirada - tenia 1");
  });

  test("marca agregadas y editadas, no las retiradas", async () => {
    const marked = await markInvestmentPriceReviewPending("bc-1", [
      { catalog_id: 1, type: "updated", previous_quantity: 2, quantity: 5 },
      { catalog_id: 3, type: "removed", previous_quantity: 1, quantity: 0 },
      { catalog_id: 9, type: "added", previous_quantity: 0, quantity: 4 },
    ]);

    expect(marked).toBe(2);
    expect(db.query.mock.calls.map(([sql, params]) => [/price_review_pending_at = now\(\)/.test(sql), params])).toEqual([
      [true, ["bc-1", 1, "Cantidad editada - de 2 a 5"]],
      [true, ["bc-1", 9, "Agregada - cantidad 4"]],
    ]);
  });
});

describe("detectInvestmentSelectionChanges", () => {
  const previous = [
    { catalog_id: 1, selected: true, quantity: "2" },
    { catalog_id: 2, selected: true, quantity: "3" },
    { catalog_id: 3, selected: true, quantity: "1" },
    { catalog_id: 4, selected: false, quantity: "0" },
  ];

  test("detecta agregadas, editadas y retiradas, e ignora las que no cambian de cantidad", () => {
    const changes = detectInvestmentSelectionChanges(previous, [
      { catalog_id: 1, quantity: "5" }, // editada
      { catalog_id: 2, quantity: "3", notes: "solo cambio la nota" }, // sin cambio de cantidad
      { catalog_id: 3, quantity: "0" }, // retirada
      { catalog_id: 4, quantity: "1" }, // estaba deseleccionada => agregada
      { catalog_id: 9, quantity: "4" }, // nueva
    ]);

    expect(changes).toEqual([
      { catalog_id: 1, type: "updated", previous_quantity: 2, quantity: 5 },
      { catalog_id: 3, type: "removed", previous_quantity: 1, quantity: 0 },
      { catalog_id: 4, type: "added", previous_quantity: 0, quantity: 1 },
      { catalog_id: 9, type: "added", previous_quantity: 0, quantity: 4 },
    ]);
  });

  test("sin cambios de cantidad no devuelve nada", () => {
    expect(detectInvestmentSelectionChanges(previous, [{ catalog_id: 2, quantity: 3 }])).toEqual([]);
    expect(detectInvestmentSelectionChanges([], [{ catalog_id: 7, quantity: null }])).toEqual([]);
  });
});
