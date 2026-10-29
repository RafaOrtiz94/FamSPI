// Verificacion de la consulta de la pista de auditoria (trazabilidad GxP):
// paginacion, conteo total y forma del resultado.

jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), audit: jest.fn(),
}));

const db = require("../../../config/db");
const { listAudits } = require("../auditoria.service");

beforeEach(() => jest.clearAllMocks());

describe("listAudits", () => {
  it("devuelve filas, total parseado y paginacion; aplica limit/offset", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] }) // data
      .mockResolvedValueOnce({ rows: [{ count: "42" }] }); // count

    const result = await listAudits({ page: 2, limit: 10 });

    expect(result.total).toBe(42);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.rows).toHaveLength(2);

    // la query de datos recibe limit y offset al final de los parametros
    const dataParams = db.query.mock.calls[0][1];
    expect(dataParams).toContain(10); // limit
    expect(dataParams).toContain(10); // offset = (page-1)*limit = 10
  });

  it("consulta la tabla auditoria.logs", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });
    await listAudits({});
    expect(db.query.mock.calls[0][0]).toMatch(/auditoria\.logs/);
  });
});
