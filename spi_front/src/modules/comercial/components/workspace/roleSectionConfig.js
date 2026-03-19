export const ROLE_SECTION_CONFIG = {
 comercial: {
 visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "consumption_export", "feasibility"],
 canEdit: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "consumption_export"],
 },
 asesor_comercial: {
 visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "consumption_export", "feasibility"],
 canEdit: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "consumption_export"],
 },
 acp_comercial: {
 visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "consumption_export", "dispatch_workspace", "feasibility"],
 canEdit: ["general", "lab", "equipment", "lis", "requirement", "investments", "consumption_export", "feasibility"],
 },
 backoffice_comercial: {
 visible: ["general", "lab", "requirement", "equipment", "lis", "determinations", "investments", "consumption_export", "feasibility"],
 canEdit: ["general", "lab", "requirement", "equipment", "lis", "determinations", "investments", "consumption_export"],
 },
 jefe_comercial: {
 visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "consumption_export", "dispatch_workspace", "feasibility"],
 canEdit: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "consumption_export", "dispatch_workspace", "feasibility"],
 },
 gerencia: {
 visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "consumption_export", "dispatch_workspace", "feasibility"],
 canEdit: ["feasibility"],
 },
 gerencia_general: {
 visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "consumption_export", "dispatch_workspace", "feasibility"],
 canEdit: ["feasibility"],
 },
 operaciones: {
 visible: ["equipment", "determinations", "dispatch_workspace", "feasibility"],
 canEdit: ["equipment", "determinations", "dispatch_workspace"],
 },
 jefe_operaciones: {
 visible: ["equipment", "determinations", "requirement", "investments", "dispatch_workspace", "feasibility"],
 canEdit: ["equipment", "determinations", "requirement", "investments", "dispatch_workspace"],
 },
 servicio_tecnico: {
 visible: ["equipment", "determinations", "feasibility"],
 canEdit: [],
 },
 jefe_tecnico: {
 visible: ["equipment", "determinations", "requirement", "investments", "feasibility"],
 canEdit: ["equipment", "investments"],
 },
 admin: {
 visible: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "dispatch_workspace", "feasibility"],
 canEdit: ["general", "lab", "equipment", "lis", "determinations", "requirement", "investments", "dispatch_workspace", "feasibility"],
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
