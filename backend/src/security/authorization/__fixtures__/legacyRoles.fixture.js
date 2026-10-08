// Fixtures de caracterizacion del RBAC legacy (plan RBAC, Fase 1B). Sin datos personales.
// Fuente: valores reales de users.role y users.extra_roles en Neon al 2026-10-07.

// Roles con al menos un usuario en la base.
const REAL_ROLES = [
  "acp_comercial",
  "comercial",
  "financiero",
  "gerencia_general",
  "ing_servicio",
  "ing_servicio_ext",
  "jefe_calidad",
  "jefe_comercial",
  "jefe_financiero",
  "jefe_logistica",
  "jefe_operaciones",
  "jefe_servicio",
  "jefe_ti",
  "logistica",
  "operaciones",
  "pasante",
  "talento_humano",
];

// Valores que existen en users.role pero no son un rol valido (usuarios inactivos).
const INVALID_ROLE_VALUES = ["null", "pending"];

// Combinaciones reales de rol principal + extra_roles.
const EXTRA_ROLE_CASES = [
  { role: "comercial", extra_roles: ["crm_leads_all_access"] },
  { role: "financiero", extra_roles: ["backoffice_comercial", "bc_quality_summary"] },
  { role: "talento_humano", extra_roles: ["backoffice_comercial"] },
];

module.exports = { REAL_ROLES, INVALID_ROLE_VALUES, EXTRA_ROLE_CASES };
