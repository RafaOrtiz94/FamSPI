// Roles del CRM en el frontend. Solo deciden qué se MUESTRA; el backend valida cada acción
// (backend/src/modules/crm-fam/crm.constants.js es la fuente de verdad).
export const normalizeRole = (value) => String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

export const ADMIN_ROLES = new Set(["jefe_ti", "jefe_de_ti", "admin", "administrador"]);
export const MANAGER_ROLES = new Set([
  "jefe_comercial", "gerencia", "gerencia_general", "gerente_general", "director", "gerente", ...ADMIN_ROLES,
]);
export const ADVISOR_ROLES = new Set([
  "comercial", "acp_comercial", "backoffice_comercial", "asesor_comercial", "analista_comercial", "backoffice",
]);

const rolesOf = (user) => String(user?.role || "").split(",").map(normalizeRole).filter(Boolean);

export const isManager = (user) => rolesOf(user).some((r) => MANAGER_ROLES.has(r));
export const isAdmin = (user) => rolesOf(user).some((r) => ADMIN_ROLES.has(r));

// Capacidad puntual de supervisar todos los leads sin ser manager del CRM.
export const canSeeAllLeads = (user) =>
  isManager(user) || (Array.isArray(user?.extra_roles) && user.extra_roles.map(normalizeRole).includes("crm_leads_all_access"));
