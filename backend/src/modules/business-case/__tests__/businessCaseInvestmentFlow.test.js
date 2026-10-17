const { isInvestmentFlowClosed } = require("../businessCaseInvestmentFlow");

describe("businessCaseInvestmentFlow", () => {
  test("keeps investments open when no manual close exists", () => {
    expect(isInvestmentFlowClosed({})).toBe(false);
    expect(isInvestmentFlowClosed({ investments: null })).toBe(false);
  });

  test("does not depend on the obsolete private-flow opt-in", () => {
    expect(isInvestmentFlowClosed({
      investments: { enabled_for_private_flow: false },
    })).toBe(false);
    expect(isInvestmentFlowClosed({
      investments: { enabled_for_private_flow: true },
    })).toBe(false);
  });

  test("preserves an explicit manual close without additional investments", () => {
    expect(isInvestmentFlowClosed({
      investments: { no_additional_investments: true },
    })).toBe(true);
  });

  test("reopens extraordinarily without deleting the original closure rule", () => {
    expect(isInvestmentFlowClosed({
      investments: {
        no_additional_investments: true,
        extraordinary_reopen: { active: true },
      },
    })).toBe(false);
  });

  test("requires a strict boolean for the manual close", () => {
    expect(isInvestmentFlowClosed({
      investments: { no_additional_investments: "true" },
    })).toBe(false);
  });
});
