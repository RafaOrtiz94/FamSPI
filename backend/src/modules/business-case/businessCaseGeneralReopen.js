function isWorkspaceClosedByFeasibility(businessCase = {}) {
  const metadata = businessCase?.modern_bc_metadata && typeof businessCase.modern_bc_metadata === "object"
    ? businessCase.modern_bc_metadata
    : {};
  const feasibility = metadata?.feasibility && typeof metadata.feasibility === "object"
    ? metadata.feasibility
    : {};
  const decision = feasibility?.decision && typeof feasibility.decision === "object"
    ? feasibility.decision
    : {};
  return Boolean(feasibility?.closed || decision?.decided_at);
}

function canEditGeneralWhenWorkspaceClosed({ businessCase, userRole, lockInfo, ownershipEntry } = {}) {
  return Boolean(
    isWorkspaceClosedByFeasibility(businessCase)
    && String(userRole || "").trim().toLowerCase() === "jefe_comercial"
    && lockInfo
    && lockInfo.isLocked === false
    && ownershipEntry?.metadata?.allow_edit_when_workspace_closed === true,
  );
}

module.exports = {
  isWorkspaceClosedByFeasibility,
  canEditGeneralWhenWorkspaceClosed,
};
