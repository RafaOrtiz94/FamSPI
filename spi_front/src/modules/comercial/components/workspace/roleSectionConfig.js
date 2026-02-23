export const ROLE_SECTION_CONFIG = {
  comercial: {
    visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments"],
    canEdit: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments"],
  },
  asesor_comercial: {
    visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments"],
    canEdit: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments"],
  },
  acp_comercial: {
    visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "prices", "calculations", "rentability", "consumption_export", "dispatch_workspace"],
    canEdit: ["general", "lab", "equipment", "lis", "requirement", "investments", "consumption_export"],
  },
  backoffice_comercial: {
    visible: ["general", "lab", "requirement", "equipment", "lis", "determinations", "investments", "calculations"],
    canEdit: ["general", "lab", "requirement", "equipment", "lis", "determinations", "investments"],
  },
  jefe_comercial: {
    visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "prices", "calculations", "rentability", "consumption_export", "dispatch_workspace"],
    canEdit: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "consumption_export", "dispatch_workspace"],
  },
  gerencia: {
    visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "dispatch_workspace"],
    canEdit: [],
  },
  gerencia_general: {
    visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "prices", "calculations", "rentability", "dispatch_workspace"],
    canEdit: [],
  },
  operaciones: {
    visible: ["equipment", "determinations", "dispatch_workspace"],
    canEdit: ["equipment", "determinations", "dispatch_workspace"],
  },
  jefe_operaciones: {
    visible: ["equipment", "determinations", "requirement", "investments", "dispatch_workspace"],
    canEdit: ["equipment", "determinations", "requirement", "investments", "dispatch_workspace"],
  },
  servicio_tecnico: {
    visible: ["equipment", "determinations"],
    canEdit: [],
  },
  jefe_tecnico: {
    visible: ["equipment", "determinations", "requirement", "investments"],
    canEdit: ["equipment", "investments"],
  },
  admin: {
    visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "dispatch_workspace"],
    canEdit: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "dispatch_workspace"],
  },
};

export function resolveRoleSectionConfig(role = "") {
  const normalizedRole = String(role || "").toLowerCase();
  return ROLE_SECTION_CONFIG[normalizedRole] || { visible: "all", canEdit: [] };
}

export function canRoleEditSection(roleConfig, sectionId) {
  if (!roleConfig) return false;
  if (roleConfig.canEdit === "all") return true;
  return Array.isArray(roleConfig.canEdit) ? roleConfig.canEdit.includes(sectionId) : false;
}
