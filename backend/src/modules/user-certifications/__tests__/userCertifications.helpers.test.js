jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { formatDateLabel } = require("../userCertifications.service");

describe("user-certifications – formatDateLabel", () => {
  it("devuelve el fallback para valores ausentes o invalidos", () => {
    expect(formatDateLabel(null)).toBe("No registrada");
    expect(formatDateLabel("no-es-fecha")).toBe("No registrada");
    expect(formatDateLabel(null, "sin dato")).toBe("sin dato");
  });
  it("formatea una fecha valida", () => {
    const label = formatDateLabel("2026-01-15");
    expect(label).not.toBe("No registrada");
    expect(typeof label).toBe("string");
  });
});
