jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { buildOffboardingRequestCode } = require("../offboarding.service");

describe("offboarding – buildOffboardingRequestCode", () => {
  it("genera un codigo con prefijo OFF y el id del usuario", () => {
    const code = buildOffboardingRequestCode(42);
    expect(code).toMatch(/^OFF-42-[0-9A-Z]+$/);
  });
  it("genera codigos distintos en llamadas separadas", async () => {
    const a = buildOffboardingRequestCode(1);
    await new Promise((r) => setTimeout(r, 2));
    const b = buildOffboardingRequestCode(1);
    expect(a).not.toBe(b);
  });
});
