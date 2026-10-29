jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { normalizeRow } = require("../technicalApplications.controller");

describe("technical-applications – normalizeRow", () => {
  it("mapea snake_case a camelCase para created_at/updated_at", () => {
    const row = {
      id: 1, client: "C", location: "L", type: "T", url: "U", status: "S", assignee: "A",
      created_at: "2026-01-01", updated_at: "2026-01-02",
    };
    const out = normalizeRow(row);
    expect(out).toEqual({
      id: 1, client: "C", location: "L", type: "T", url: "U", status: "S", assignee: "A",
      createdAt: "2026-01-01", updatedAt: "2026-01-02",
    });
  });
});
