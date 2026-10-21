jest.mock("react-router-dom", () => ({ NavLink: () => null, useLocation: () => ({ pathname: "/" }) }), { virtual: true });

jest.mock("../../../auth/AuthContext", () => ({ useAuth: () => ({}) }));
jest.mock("../../../hooks/useAuditStatus", () => () => ({}));

const { getPriorityGroups } = require("../NavigationBar");

const hasWorkManagement = (groups) => Object.values(groups).some((group) => group.some((link) => link?.path === "/dashboard/work-management"));

describe("Work Management en la barra de navegacion", () => {
 it.each([
  ["finanzas", "jefe_financiero"],
  ["financiero", "financiero"],
  ["talento_humano", "jefe_talento_humano"],
  ["calidad", "calidad"],
  ["comercial", "comercial"],
  ["servicio_tecnico", "jefe_servicio"],
 ])("lo ve cualquier colaborador interno (%s / %s)", (scope, role) => {
  expect(hasWorkManagement(getPriorityGroups(scope, role, false, []))).toBe(true);
 });

 it("no lo ven los usuarios externos", () => {
  expect(hasWorkManagement(getPriorityGroups("ing_servicio_ext", "ing_servicio_ext", false, []))).toBe(false);
  expect(hasWorkManagement(getPriorityGroups("esp_app_ext", "esp_app_ext", false, []))).toBe(false);
 });

 it("no se repite si el area ya lo tenia", () => {
  const groups = getPriorityGroups("jefe_ti", "jefe_ti", false, []);
  const count = Object.values(groups).flat().filter((link) => link?.path === "/dashboard/work-management").length;
  expect(count).toBe(1);
 });
});
