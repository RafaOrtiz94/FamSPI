import { canRoleEditSection, resolveRoleSectionConfig } from "../roleSectionConfig";

describe("roleSectionConfig", () => {
  test("resuelve rol conocido con secciones visibles", () => {
    const config = resolveRoleSectionConfig("acp_comercial");
    expect(Array.isArray(config.visible)).toBe(true);
    expect(config.visible).toContain("determinations");
  });

  test("canRoleEditSection respeta permisos por rol", () => {
    const config = resolveRoleSectionConfig("jefe_tecnico");
    expect(canRoleEditSection(config, "investments")).toBe(true);
    expect(canRoleEditSection(config, "lis")).toBe(false);
  });
});
