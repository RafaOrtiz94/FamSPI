jest.mock("../../../config/db", () => ({
  query: jest.fn(),
}));

const db = require("../../../config/db");
const managementService = require("../management.service");

describe("management.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a global total for paginated request lists", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: "13" }] })
      .mockResolvedValueOnce({ rows: [{ id: 8, status: "pendiente" }] });

    const result = await managementService.listRequests({
      page: 2,
      pageSize: 10,
      status: "pendiente",
      area: "calidad",
    });

    expect(db.query.mock.calls[0][0]).toContain("COUNT(*) AS total");
    expect(db.query.mock.calls[0][1]).toEqual(["pendiente", "calidad"]);
    expect(db.query.mock.calls[1][1]).toEqual(["pendiente", "calidad", 10, 10]);
    expect(result).toEqual({
      rows: [{ id: 8, status: "pendiente" }],
      total: 13,
    });
  });

  it("guards JSON request_id casts before comparing trace ids", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await managementService.getTrace("42");

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toContain("(datos_nuevos->>'request_id') ~ '^[0-9]+$'");
    expect(db.query.mock.calls[0][0]).toContain("(datos_anteriores->>'request_id') ~ '^[0-9]+$'");
    expect(db.query.mock.calls[0][1]).toEqual([42]);
  });

  it("returns an empty trace for invalid ids without hitting the database", async () => {
    const result = await managementService.getTrace("no-es-numero");

    expect(result).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });
});
