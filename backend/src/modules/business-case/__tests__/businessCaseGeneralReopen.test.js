const {
  isWorkspaceClosedByFeasibility,
  canEditGeneralWhenWorkspaceClosed,
} = require("../businessCaseGeneralReopen");

const closedBusinessCase = {
  modern_bc_metadata: {
    feasibility: {
      closed: true,
      decision: { decided_at: "2026-10-14T14:09:47.372Z" },
    },
  },
};

describe("reapertura focalizada de Datos generales", () => {
  test("detecta el cierre por factibilidad", () => {
    expect(isWorkspaceClosedByFeasibility(closedBusinessCase)).toBe(true);
    expect(isWorkspaceClosedByFeasibility({ modern_bc_metadata: {} })).toBe(false);
  });

  test("habilita solo una reapertura explicita para jefe_comercial", () => {
    expect(canEditGeneralWhenWorkspaceClosed({
      businessCase: closedBusinessCase,
      userRole: "jefe_comercial",
      lockInfo: { isLocked: false },
      ownershipEntry: { metadata: { allow_edit_when_workspace_closed: true } },
    })).toBe(true);
  });

  test.each([
    ["otro rol", "comercial", false, true],
    ["seccion bloqueada", "jefe_comercial", true, true],
    ["sin autorizacion focalizada", "jefe_comercial", false, false],
  ])("mantiene cerrado con %s", (_label, userRole, isLocked, allowed) => {
    expect(canEditGeneralWhenWorkspaceClosed({
      businessCase: closedBusinessCase,
      userRole,
      lockInfo: { isLocked },
      ownershipEntry: { metadata: { allow_edit_when_workspace_closed: allowed } },
    })).toBe(false);
  });
});
