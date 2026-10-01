// hasInvestmentEditRole: quien puede editar la lista de inversiones adicionales.
// jefe_financiero es rol completo desde 2026-09-23 (antes solo alexandra.molina
// via extra_roles puntual, ver git history). INVESTMENT_EDIT_EXTRA_ROLE
// (bc_quality_summary/bc_investment_edit, migrations/276_users_extra_roles.sql)
// sigue existiendo como mecanismo generico para el proximo caso de "esta
// persona puntual necesita el permiso, no todo su rol".

const { hasInvestmentEditRole, INVESTMENT_EDIT_EXTRA_ROLE, INVESTMENT_EDIT_ROLES } = require("../investmentEditAccess");

describe("hasInvestmentEditRole", () => {
  it("permite a los roles habilitados sin necesidad de extra_roles", () => {
    expect(hasInvestmentEditRole("jefe_comercial", [])).toBe(true);
    expect(hasInvestmentEditRole("jefe_ti", undefined)).toBe(true);
    expect(hasInvestmentEditRole("jefe_financiero", [])).toBe(true);
    expect(hasInvestmentEditRole("jefe_financiero", undefined)).toBe(true);
  });

  it("INVESTMENT_EDIT_ROLES incluye jefe_financiero", () => {
    expect(INVESTMENT_EDIT_ROLES.has("jefe_financiero")).toBe(true);
  });

  it("rechaza un rol no habilitado sin el extra_role puntual", () => {
    expect(hasInvestmentEditRole("comercial", [])).toBe(false);
    expect(hasInvestmentEditRole("comercial", undefined)).toBe(false);
    expect(hasInvestmentEditRole("comercial", ["algun_otro_extra_role"])).toBe(false);
  });

  it("permite a un rol no habilitado si tiene el extra_role puntual bc_investment_edit", () => {
    expect(INVESTMENT_EDIT_EXTRA_ROLE).toBe("bc_investment_edit");
    expect(hasInvestmentEditRole("comercial", ["bc_investment_edit"])).toBe(true);
  });
});
