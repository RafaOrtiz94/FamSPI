/**
 * Motor central de autorizacion (plan RBAC, Fase 4): lee el catalogo y las asignaciones de la base.
 * Hoy solo lo usa el modo sombra (centralShadow.js); ninguna ruta decide con el.
 */
const db = require("../../config/db");
const { buildEndpointIndex, resolveEndpointPermission, decide } = require("./centralModel");
const { isTenantModeEnabled, resolveTenantScope } = require("./tenantContext");

// Multiempresa (enfoque SaaS, paso 2). Apagado, los nombres de rol son los de siempre y las consultas son las mismas.
// Encendido, un rol de una empresa se llama `t<id>:<clave>`, asi dos empresas pueden tener `custom_ventas` distinto
// y un rol de una empresa nunca coincide con el de otra ni con un rol de sistema.
const roleName = (key, tenantId, tenantMode) => (tenantMode && tenantId ? `t${tenantId}:${key}` : key);

const CACHE_TTL_MS = 60000;
let modelCache = null; // { loadedAt, tenantMode, index, permissionRoles }
const userCache = new Map(); // userId -> { loadedAt, roles, grants }

async function loadModel(now = Date.now()) {
  const tenantMode = isTenantModeEnabled();
  if (modelCache && modelCache.tenantMode === tenantMode && now - modelCache.loadedAt < CACHE_TTL_MS) return modelCache;
  const [endpoints, rolePermissions] = await Promise.all([
    db.query("SELECT method, route_pattern, permission_key FROM public.rbac_endpoint_permissions"),
    tenantMode
      ? db.query(`SELECT r.key AS role, r.tenant_id, rp.permission_key
                   FROM public.role_permissions rp JOIN public.roles r ON r.id = rp.role_id
                  WHERE r.is_active`)
      : db.query(`SELECT r.key AS role, rp.permission_key
                   FROM public.role_permissions rp JOIN public.roles r ON r.id = rp.role_id
                  WHERE r.tenant_id IS NULL AND r.is_active`),
  ]);
  const permissionRoles = new Map();
  rolePermissions.rows.forEach(({ role, tenant_id: tenantId, permission_key: key }) => {
    if (!permissionRoles.has(key)) permissionRoles.set(key, new Set());
    permissionRoles.get(key).add(roleName(role, tenantId, tenantMode));
  });
  // Un permiso sin ningun rol existe igual (solo superroles): se registra vacio.
  endpoints.rows.forEach(({ permission_key: key }) => { if (!permissionRoles.has(key)) permissionRoles.set(key, new Set()); });
  modelCache = { loadedAt: now, tenantMode, index: buildEndpointIndex(endpoints.rows), permissionRoles };
  return modelCache;
}

async function loadUser(userId, now = Date.now()) {
  const tenantMode = isTenantModeEnabled();
  const cached = userCache.get(userId);
  if (cached && cached.tenantMode === tenantMode && now - cached.loadedAt < CACHE_TTL_MS && now < cached.validUntil) return cached;
  // Con empresa, la del usuario: se cargan sus roles de sistema, los heredados y solo los de su empresa.
  const scope = tenantMode ? await resolveTenantScope(userId) : null;
  const [roles, grants] = await Promise.all([
    scope
      ? db.query(`SELECT r.key, r.tenant_id, a.expires_at FROM public.user_role_assignments a JOIN public.roles r ON r.id = a.role_id
                   WHERE a.user_id = $1 AND a.revoked_at IS NULL AND (r.tenant_id IS NULL OR r.tenant_id = $2)
                     AND (a.tenant_id IS NULL OR a.tenant_id = $2)
                     AND (a.starts_at IS NULL OR a.starts_at <= NOW()) AND (a.expires_at IS NULL OR a.expires_at > NOW())`, [userId, scope.tenantId])
      : db.query(`SELECT r.key, a.expires_at FROM public.user_role_assignments a JOIN public.roles r ON r.id = a.role_id
                   WHERE a.user_id = $1 AND a.revoked_at IS NULL
                     AND (a.starts_at IS NULL OR a.starts_at <= NOW()) AND (a.expires_at IS NULL OR a.expires_at > NOW())`, [userId]),
    scope
      ? db.query(`SELECT permission_key, expires_at FROM public.user_permission_grants
                   WHERE user_id = $1 AND revoked_at IS NULL AND (tenant_id IS NULL OR tenant_id = $2)
                     AND (starts_at IS NULL OR starts_at <= NOW()) AND (expires_at IS NULL OR expires_at > NOW())`, [userId, scope.tenantId])
      : db.query(`SELECT permission_key, expires_at FROM public.user_permission_grants
                   WHERE user_id = $1 AND revoked_at IS NULL
                     AND (starts_at IS NULL OR starts_at <= NOW()) AND (expires_at IS NULL OR expires_at > NOW())`, [userId]),
  ]);
  // La entrada deja de valer cuando vence el primer rol o grant con vencimiento, aunque no haya pasado el TTL.
  const expiries = [...roles.rows, ...grants.rows].map((row) => row.expires_at).filter(Boolean).map((value) => new Date(value).getTime());
  const entry = {
    loadedAt: now,
    tenantMode,
    tenantId: scope ? scope.tenantId : null,
    validUntil: expiries.length ? Math.min(...expiries) : Infinity,
    roles: new Set(roles.rows.map((row) => roleName(row.key, row.tenant_id, tenantMode))),
    grants: new Set(grants.rows.map((row) => row.permission_key)),
  };
  userCache.set(userId, entry);
  return entry;
}

// Cambiar roles, permisos o grants debe llamar a esto para que la decision no use datos viejos.
function invalidateCentralCache(userId = null) {
  modelCache = null;
  if (userId === null) userCache.clear();
  else userCache.delete(userId);
}

/** Decision central para una peticion ya enrutada. null si el endpoint no exige permiso de rol. */
async function centralDecisionForRequest({ userId, method, path, routePath, moduleVerified }) {
  const model = await loadModel();
  const permissionKey = resolveEndpointPermission(model.index, method, path, routePath);
  if (!permissionKey) return null;
  const user = await loadUser(userId);
  return {
    permissionKey,
    ...decide({ userRoles: user.roles, permissionKey, permissionRoles: model.permissionRoles, moduleVerified, grantedPermissions: user.grants }),
  };
}

/** Decision central para un permiso con nombre (requirePermission). null si el catalogo no lo conoce. */
// tokenRoles: los roles del token. Se suman a los de la base igual que en el control por area, para que un usuario
// recien creado (sin asignaciones heredadas aun) no quede peor que con la regla de siempre.
async function centralHasPermission({ userId, permissionKey, moduleVerified = false, tokenRoles = [] }) {
  const model = await loadModel();
  if (!model.permissionRoles.has(permissionKey)) return null;
  const user = await loadUser(userId);
  const userRoles = new Set([...tokenRoles, ...user.roles]);
  return decide({ userRoles, permissionKey, permissionRoles: model.permissionRoles, moduleVerified, grantedPermissions: user.grants });
}

module.exports = { loadModel, loadUser, invalidateCentralCache, centralDecisionForRequest, centralHasPermission };
