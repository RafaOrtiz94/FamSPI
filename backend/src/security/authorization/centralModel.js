/**
 * Modelo central de autorizacion (plan RBAC, Fases 3 y 4): funciones puras, sin base de datos.
 *
 * El catalogo se DERIVA de las guardas que hoy corren (requireRole), asi que reproduce la decision
 * actual por construccion. Los nombres de permiso son provisionales (`<area>.<recurso>.<accion>`) y
 * quedan pendientes de aprobacion funcional; cuando un mismo nombre agrupa conjuntos de roles
 * distintos se separa con `-v2`, `-v3` y se deja anotado para revision.
 */
const { expandRoles, normalizeRoleName } = require("../../middlewares/roles");

const SUPER_ROLES = new Set(["admin", "administrador"]);
const ACTIONS = { GET: "read", HEAD: "read", POST: "create", PUT: "update", PATCH: "update", DELETE: "delete" };
const GENERATED_PREFIX = "[generado]";

// Todas las guardas de rol encadenadas deben cumplirse: el conjunto efectivo es la interseccion.
function effectiveRoleSet(roleGuards = []) {
  const sets = roleGuards.map((guard) => expandRoles(guard));
  if (!sets.length) return null;
  return new Set([...sets[0]].filter((role) => sets.every((set) => set.has(role))));
}

function pathSegments(routePath) {
  const parts = String(routePath || "").split("?")[0].split("/").filter(Boolean);
  if (parts[0] === "api" && parts[1] === "v1") return parts.slice(2);
  if (parts[0] === "asistencia") return ["attendance", ...parts.slice(1)];
  return parts;
}

function basePermissionKey(endpoint) {
  const [area = "root", second] = pathSegments(endpoint.path);
  const resource = second && !second.startsWith(":") ? second : "root";
  const action = ACTIONS[endpoint.method] || "other";
  return { area, resource, action, key: `${area}.${resource}.${action}` };
}

const roleSetSignature = (set) => [...set].sort().join(",");

/**
 * endpoints: filas del inventario (classification "rol"). registry: prefijo -> { modules }.
 * Devuelve el catalogo completo y el mapa endpoint -> permiso.
 */
function buildCatalog(endpoints, { registry = {}, moduleKeys = [], namedPermissions = {} } = {}) {
  const known = new Set(moduleKeys);
  const byBase = new Map();
  endpoints
    .filter((endpoint) => endpoint.classification === "rol" && endpoint.roleGuards.length)
    .forEach((endpoint) => {
      const base = basePermissionKey(endpoint);
      const roles = effectiveRoleSet(endpoint.roleGuards);
      const entry = byBase.get(base.key) || { base, variants: new Map() };
      const signature = roleSetSignature(roles);
      const variant = entry.variants.get(signature) || { roles, endpoints: [] };
      variant.endpoints.push(endpoint);
      entry.variants.set(signature, variant);
      byBase.set(base.key, entry);
    });

  const permissions = [];
  const rolePermissions = [];
  const endpointMap = [];
  const roleNames = new Set(SUPER_ROLES);
  const variantReport = [];

  [...byBase.values()].sort((a, b) => a.base.key.localeCompare(b.base.key)).forEach(({ base, variants }) => {
    const ordered = [...variants.entries()].sort((a, b) => b[1].endpoints.length - a[1].endpoints.length || a[0].localeCompare(b[0]));
    const prefix = `/api/v1/${base.area}`;
    const modules = (registry[prefix]?.modules || []).filter((key) => known.has(key));
    ordered.forEach(([, variant], index) => {
      const action = index === 0 ? base.action : `${base.action}-v${index + 1}`;
      const key = `${base.area}.${base.resource}.${action}`;
      permissions.push({
        key,
        module_key: modules.length === 1 ? modules[0] : null,
        resource: `${base.area}/${base.resource}`,
        action,
        description: `${GENERATED_PREFIX} ${variant.endpoints.length} endpoint(s) de /${base.area}; nombre provisional pendiente de aprobacion.`,
      });
      variant.roles.forEach((role) => {
        roleNames.add(role);
        rolePermissions.push({ role, permission: key });
      });
      variant.endpoints.forEach((endpoint) => endpointMap.push({ method: endpoint.method, route_pattern: endpoint.path, permission_key: key }));
    });
    if (ordered.length > 1) variantReport.push({ base: base.key, variants: ordered.length });
  });

  // Permisos que el codigo ya nombra (requirePermission): se cargan tal cual, con los roles que hoy los tienen.
  Object.entries(namedPermissions).sort(([a], [b]) => a.localeCompare(b)).forEach(([key, roles]) => {
    const [resource, action = "access"] = key.split(".");
    permissions.push({ key, module_key: null, resource, action, description: `${GENERATED_PREFIX} permiso nombrado en el codigo (requirePermission).` });
    expandRoles(roles).forEach((role) => { roleNames.add(role); rolePermissions.push({ role, permission: key }); });
  });

  return { permissions, rolePermissions, endpointMap, roleNames: [...roleNames].sort(), variantReport };
}

// ---- decision

function matcherFor(pattern) {
  const source = pattern.split("/").map((segment) => (segment.startsWith(":") ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("/");
  return new RegExp(`^${source}/?$`, "i");
}

// Indice para resolver (metodo, ruta concreta) -> permiso. Gana el patron con mas segmentos fijos.
function buildEndpointIndex(endpointMap) {
  const entries = endpointMap.map((item) => ({
    ...item,
    regex: matcherFor(item.route_pattern),
    fixed: item.route_pattern.split("/").filter((segment) => segment && !segment.startsWith(":")).length,
  }));
  entries.sort((a, b) => b.fixed - a.fixed || b.route_pattern.length - a.route_pattern.length);
  return entries;
}

function resolveEndpointPermission(index, method, concretePath, routePath) {
  const clean = String(concretePath || "").split("?")[0];
  const upper = String(method || "").toUpperCase();
  const candidates = index.filter((entry) => entry.method === upper && entry.regex.test(clean));
  if (!candidates.length) return null;
  // Con la ruta que Express enruto de verdad se evita confundir /x/my (sin guarda de rol) con /x/:id.
  if (routePath && routePath !== "/") {
    const exact = candidates.find((entry) => entry.route_pattern.endsWith(routePath));
    return exact ? exact.permission_key : null;
  }
  return candidates[0].permission_key;
}

/**
 * Misma regla que requireRole: superrol pasa; el pasante verificado por modulo pasa; si no, algun rol
 * del usuario debe estar entre los roles del permiso. grantedPermissions: grants individuales vigentes.
 */
function decide({ userRoles, permissionKey, permissionRoles, moduleVerified = false, grantedPermissions = new Set() }) {
  const roles = [...userRoles].map(normalizeRoleName);
  if (roles.some((role) => SUPER_ROLES.has(role))) return { allowed: true, reason: "superrol" };
  if (roles.includes("pasante") && moduleVerified) return { allowed: true, reason: "pasante_modulo_verificado" };
  if (grantedPermissions.has(permissionKey)) return { allowed: true, reason: "grant_individual" };
  const allowedRoles = permissionRoles.get(permissionKey);
  if (!allowedRoles) return { allowed: false, reason: "permiso_desconocido" };
  return roles.some((role) => allowedRoles.has(role)) ? { allowed: true, reason: "rol" } : { allowed: false, reason: "sin_rol" };
}

module.exports = {
  SUPER_ROLES,
  GENERATED_PREFIX,
  effectiveRoleSet,
  basePermissionKey,
  buildCatalog,
  buildEndpointIndex,
  resolveEndpointPermission,
  decide,
};
