jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { isAuditActive, assertAllowedSection } = require("../auditPrep.service");

describe("audit-prep – isAuditActive", () => {
  it("es falso cuando el modo auditoria esta apagado", () => {
    expect(isAuditActive({ audit_mode: false })).toBe(false);
    expect(isAuditActive({})).toBe(false);
  });
  it("es falso cuando la fecha de inicio es futura", () => {
    expect(isAuditActive({ audit_mode: true, audit_start_date: "2999-01-01" })).toBe(false);
  });
});

describe("audit-prep – assertAllowedSection", () => {
  it("lanza 404 cuando la seccion no existe", () => {
    expect(() => assertAllowedSection(null, "gerencia")).toThrow(/no encontrada|inactiva/);
  });
});
