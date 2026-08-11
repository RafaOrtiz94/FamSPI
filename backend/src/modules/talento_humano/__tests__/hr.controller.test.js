// Verificacion de la validacion de datos de empleado del modulo de talento
// humano (control de integridad de datos de personal).

jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("../../../utils/audit", () => ({ logAction: jest.fn() }));
jest.mock("../../../utils/mailer", () => ({ sendApprovalEmail: jest.fn() }));

const db = require("../../../config/db");
const { createEmployee, listEmployees } = require("../hr.controller");

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe("hr.controller.createEmployee", () => {
  it("rechaza un payload sin campos obligatorios (cedula)", async () => {
    const req = { body: { nombre: "Ana", cargo: "Analista", fecha_ingreso: "2026-01-01" }, user: { id: 1 } };
    const res = makeRes();
    await createEmployee(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("crea el empleado cuando el payload es valido", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, nombre: "Ana", estado: "activo" }] }) // INSERT
      .mockResolvedValueOnce({ rows: [] }); // SELECT gerencia emails
    const req = {
      body: { nombre: "Ana", cedula: "0102030405", cargo: "Analista", fecha_ingreso: "2026-01-01" },
      user: { id: 1 },
    };
    const res = makeRes();
    await createEmployee(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ nombre: "Ana" }));
  });
});

describe("hr.controller.listEmployees", () => {
  it("devuelve la lista de empleados", async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });
    const req = {};
    const res = makeRes();
    await listEmployees(req, res);
    expect(res.json).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }]);
  });
});
