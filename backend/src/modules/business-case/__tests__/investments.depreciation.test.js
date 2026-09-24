jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const investments = require("../investments.service");

describe("financial investment depreciation", () => {
  it("calculates annual, monthly and projected depreciation", () => {
    expect(investments.calculateFinancialDepreciation({
      unitPrice: 2000,
      percentage: 10,
      projectedMonths: 15,
    })).toEqual({
      annual: 200,
      monthly: 16.67,
      projected: 250,
      net: 1750,
    });
  });
});
