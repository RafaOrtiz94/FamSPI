// Aislado en su propio archivo (sin requires pesados) a proposito: el
// controller principal arrastra una cadena de requires que rompe bajo Jest
// por un problema preexistente y no relacionado con uuid/ESM
// (equipmentPurchases.service.js -> uuid), lo que impedia testear esta
// logica de permisos importando businessCase.controller.js directamente.

// Roles que pueden agregar items o cambiar cantidades/caracteristicas en la
// lista de inversiones adicionales del Business Case (edicion en paralelo,
// sin carrito ni dueno por item).
const INVESTMENT_EDIT_ROLES = new Set([
  "acp_comercial",
  "jefe_comercial",
  "jefe_operaciones",
  "jefe_servicio",
  "jefe_logistica",
  "jefe_ti", // BC-10: puede ver y agregar items al carrito
  // 2026-09-23: se decidio abrir el rol completo (antes solo alexandra.molina
  // tenia el permiso puntual INVESTMENT_EDIT_EXTRA_ROLE de abajo). Cualquier
  // usuario con rol jefe_financiero, actual o futuro, edita inversiones.
  "jefe_financiero",
]);

// Capacidad puntual otorgada a un usuario especifico sin cambiar su rol
// principal (mismo patron que "bc_quality_summary" para lorena.loaiza, ver
// migrations/276_users_extra_roles.sql). Mecanismo generico para el proximo
// caso de "esta persona puntual necesita el permiso, no todo su rol" --
// jefe_financiero ya no lo necesita, ver INVESTMENT_EDIT_ROLES arriba.
const INVESTMENT_EDIT_EXTRA_ROLE = "bc_investment_edit";

function hasInvestmentEditRole(role, extraRoles = []) {
  return INVESTMENT_EDIT_ROLES.has(role)
    || (Array.isArray(extraRoles) && extraRoles.includes(INVESTMENT_EDIT_EXTRA_ROLE));
}

module.exports = {
  INVESTMENT_EDIT_ROLES,
  INVESTMENT_EDIT_EXTRA_ROLE,
  hasInvestmentEditRole,
};
