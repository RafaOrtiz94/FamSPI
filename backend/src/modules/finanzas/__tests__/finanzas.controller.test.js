// Verificacion de las reglas de movimiento de inventario financiero:
// validaciones de tipo, cantidad, existencia y stock suficiente.

jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("../../../utils/audit", () => ({ logAction: jest.fn() }));
jest.mock("axios", () => ({ post: jest.fn() }));

const db = require("../../../config/db");
const { listInventory, moveInventory } = require("../finanzas.controller");

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe("listInventory", () => {
  it("devuelve el inventario ordenado", async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1, name: "Item" }] });
    const res = makeRes();
    await listInventory({}, res);
    expect(res.json).toHaveBeenCalledWith([{ id: 1, name: "Item" }]);
  });
});

describe("moveInventory – validaciones", () => {
  const req = (body) => ({ body, user: { id: 9 } });

  it("rechaza un tipo de movimiento invalido", async () => {
    const res = makeRes();
    await moveInventory(req({ inventory_id: 1, type: "xxx", quantity: 5 }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid type" });
  });

  it("rechaza una cantidad no positiva", async () => {
    const res = makeRes();
    await moveInventory(req({ inventory_id: 1, type: "in", quantity: 0 }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid quantity" });
  });

  it("devuelve 404 cuando el inventario no existe", async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // SELECT inventory
    const res = makeRes();
    await moveInventory(req({ inventory_id: 99, type: "out", quantity: 2 }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Inventory not found" });
  });

  it("rechaza una salida con stock insuficiente", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, quantity: 1 }] }); // SELECT inventory
    const res = makeRes();
    await moveInventory(req({ inventory_id: 1, type: "out", quantity: 5 }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Insufficient stock" });
  });
});
