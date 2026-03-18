jest.mock("../../../config/db", () => ({
  query: jest.fn(),
}));
jest.mock("../../../config/logger", () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));
jest.mock("../../../utils/audit", () => ({
  logAction: jest.fn(),
}));
jest.mock("../../../utils/mailer", () => ({
  sendMail: jest.fn(),
}));
jest.mock("../../requests/requests.service", () => ({
  updateRequestStatus: jest.fn(),
}));

const db = require("../../../config/db");
const approvalsService = require("../approvals.service");

describe("approvals.service listPending", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("applies explicit approver visibility while preserving legacy unassigned requests", async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 14,
            status: "pendiente",
            created_at: "2026-03-18T10:00:00.000Z",
            requester_name: "Ada Lovelace",
            type_code: "F.ST-20",
            type_title: "Legacy title",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: "1" }] });

    const result = await approvalsService.listPending(2, 5, {
      id: 77,
      role: "jefe_tecnico",
    });

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[0][0]).toContain("pa.approver_id = $2");
    expect(db.query.mock.calls[0][0]).toContain("OR NOT EXISTS");
    expect(db.query.mock.calls[0][1]).toEqual([
      ["approved", "aprobado", "rechazado", "rejected", "cancelado", "cancelled"],
      77,
      5,
      5,
    ]);
    expect(db.query.mock.calls[1][1]).toEqual([
      ["approved", "aprobado", "rechazado", "rejected", "cancelado", "cancelled"],
      77,
    ]);
    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      id: 14,
      requester_name: "Ada Lovelace",
      type_code: "F.ST-20",
    });
    expect(result.rows[0].type_title).toBe("Solicitud de inspección de ambiente");
  });
});
