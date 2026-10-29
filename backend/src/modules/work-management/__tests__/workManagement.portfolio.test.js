jest.mock("../../../config/db", () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));
jest.mock("../../../utils/drive", () => ({
  ensureFolderPath: jest.fn(),
  uploadFileToDrive: jest.fn(),
}));

const db = require("../../../config/db");
const { getPortfolioSummary } = require("../workManagement.service");

describe("getPortfolioSummary", () => {
  beforeEach(() => {
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [] });
  });

  it("no envia parametros cuando el usuario tiene alcance manager", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ project_count: 0, workspace_count: 0, item_count: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await getPortfolioSummary({ id: 9, role: "jefe_ti" });

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[0][1]).toEqual([]);
    expect(db.query.mock.calls[1][1]).toEqual([]);
    expect(db.query.mock.calls[0][0]).not.toContain("$1");
    expect(db.query.mock.calls[1][0]).not.toContain("$1");
  });

  it("envia user id cuando el usuario no tiene alcance manager", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ project_count: 0, workspace_count: 0, item_count: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await getPortfolioSummary({ id: 11, role: "comercial" });

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[0][1]).toEqual([11]);
    expect(db.query.mock.calls[1][1]).toEqual([11]);
    expect(db.query.mock.calls[0][0]).toContain("$1");
    expect(db.query.mock.calls[1][0]).toContain("$1");
  });
});
