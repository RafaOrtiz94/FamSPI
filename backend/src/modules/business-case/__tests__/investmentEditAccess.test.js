// hasInvestmentEditRole: mismo patron que "bc_quality_summary" (lorena.loaiza,
// migrations/276_users_extra_roles.sql) -- otorga la capacidad de editar la
// lista de inversiones adicionales a un usuario puntual (ej. alexandra.molina,
// jefe_financiero) via extra_roles del JWT, sin extender INVESTMENT_EDIT_ROLES
// a todo su rol.

const { hasInvestmentEditRole, INVESTMENT_EDIT_EXTRA_ROLE } = require("../investmentEditAccess");

describe("hasInvestmentEditRole", () => {
  it("permite a los roles ya habilitados sin necesidad de extra_roles", () => {
    expect(hasInvestmentEditRole("jefe_comercial", [])).toBe(true);
    expect(hasInvestmentEditRole("jefe_ti", undefined)).toBe(true);
  });

  it("rechaza un rol no habilitado sin el extra_role puntual", () => {
    expect(hasInvestmentEditRole("jefe_financiero", [])).toBe(false);
    expect(hasInvestmentEditRole("jefe_financiero", undefined)).toBe(false);
    expect(hasInvestmentEditRole("jefe_financiero", ["algun_otro_extra_role"])).toBe(false);
  });

  it("permite a un rol no habilitado si tiene el extra_role puntual bc_investment_edit", () => {
    expect(INVESTMENT_EDIT_EXTRA_ROLE).toBe("bc_investment_edit");
    expect(hasInvestmentEditRole("jefe_financiero", ["bc_investment_edit"])).toBe(true);
  });

  it("no se ve afectado por un rol vacio/desconocido salvo que traiga el extra_role", () => {
    expect(hasInvestmentEditRole("comercial", [])).toBe(false);
    expect(hasInvestmentEditRole("comercial", ["bc_investment_edit"])).toBe(true);
  });
});
