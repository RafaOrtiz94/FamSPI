jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { toRounded } = require("../deliveryCeilings.service");

describe("delivery-ceilings – toRounded", () => {
  it("redondea a 3 decimales", () => {
    expect(toRounded("1.23456")).toBe(1.235);
    expect(toRounded(10)).toBe(10);
  });
  it("trata null/vacio como 0", () => {
    expect(toRounded(null)).toBe(0);
    expect(toRounded("")).toBe(0);
  });
});
