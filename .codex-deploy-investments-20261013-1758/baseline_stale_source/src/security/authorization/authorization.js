const {
  ROLE_GROUPS,
  normalizeRoleName,
  collectUserRoles,
  expandRoles,
} = require("../../middlewares/roles");

const AUTHORIZATION_MANIFEST_VERSION = 1;

// Fase 1: catálogo mínimo para probar la interfaz nueva sin cambiar aún
// todos los módulos. Las fases siguientes ampliarán este catálogo por módulo.
const PERMISSION_ROLE_MAP = Object.freeze({
  "module_access.read": ["jefe_ti", "admin_ti"],
  "module_access.manage": ["jefe_ti", "admin_ti"],
});

const SUPER_ROLES = new Set(["admin", "administrador"]);

const getPermissionRoles = (permission) => {
  const key = String(permission || "").trim().toLowerCase();
  return PERMISSION_ROLE_MAP[key] || null;
};

const hasPermission = (user = {}, permission) => {
  const allowedRoles = getPermissionRoles(permission);
  if (!allowedRoles) return false;

  const userRoles = collectUserRoles(user);
  if ([...userRoles].some((role) => SUPER_ROLES.has(role))) return true;

  const expandedAllowed = expandRoles(allowedRoles);
  return [...userRoles].some((role) => expandedAllowed.has(normalizeRoleName(role)));
};

const listPermissionsForUser = (user = {}) =>
  Object.keys(PERMISSION_ROLE_MAP).filter((permission) => hasPermission(user, permission));

const isKnownPermission = (permission) => Boolean(getPermissionRoles(permission));

module.exports = {
  AUTHORIZATION_MANIFEST_VERSION,
  PERMISSION_ROLE_MAP,
  ROLE_GROUPS,
  collectUserRoles,
  getPermissionRoles,
  hasPermission,
  isKnownPermission,
  listPermissionsForUser,
  normalizeRoleName,
};
