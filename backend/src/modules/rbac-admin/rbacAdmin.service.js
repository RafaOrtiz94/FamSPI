/**
 * Administracion del catalogo central de RBAC (plan RBAC, Fase 6).
 *
 * IMPORTANTE: mientras el motor central no se active por modulo (Fases 5 y 7), las asignaciones y grants
 * que se hagan aqui NO cambian el acceso real de nadie: la decision la sigue tomando requireRole. Las
 * respuestas lo dicen en `enforcement` para que la pantalla no prometa de mas.
 *
 * Multiempresa (enfoque SaaS, paso 2): todas las funciones reciben un `scope` (ver tenantContext.js). Con
 * RBAC_TENANT_MODE apagado el scope es NO_TENANT y cada funcion ejecuta las mismas consultas de siempre.
 */
const db = require("../../config/db");
const { invalidateCentralCache } = require("../../security/authorization/centralAuthorization");
const { reconcileUserInheritedRoles } = require("../../security/authorization/inheritedAssignments");
const { NO_TENANT, assertMember, roleVisibility, rowVisibility } = require("../../security/authorization/tenantContext");
const { logAction } = require("../../utils/audit");

const httpError = (status, message) => Object.assign(new Error(message), { status });
const MIN_REASON = 5;

const isPilotEnabled = () => process.env.RBAC_CENTRAL_PILOT === "true";
const enforcement = () => ({
  central_decides: false,
  pilot_permissions: isPilotEnabled() ? ["module_access.read", "module_access.manage"] : [],
  note: "Hoy decide requireRole. Los cambios aqui se aplicaran cuando el modulo se active en el motor central.",
});

function cleanReason(reason) {
  const text = String(reason || "").trim();
  if (text.length < MIN_REASON) throw httpError(400, `Indica el motivo (minimo ${MIN_REASON} caracteres).`);
  return text.slice(0, 500);
}

function cleanExpiry(value) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw httpError(400, "La fecha de vencimiento no es valida.");
  if (date.getTime() <= Date.now()) throw httpError(400, "La fecha de vencimiento debe ser futura.");
  return date.toISOString();
}

// Quien administra no puede cambiarse a si mismo: separa quien pide de quien aprueba.
function assertNotSelf(actorId, userId) {
  if (Number(actorId) === Number(userId)) throw httpError(403, "No puedes modificar tus propios roles ni permisos.");
}

const tenantTag = (scope) => (scope.enabled ? { tenant_id: scope.tenantId } : {});

// Registro de negocio con valor anterior y nuevo (modulo propio, para no duplicar el registro generico de la peticion).
// Un fallo de auditoria no debe deshacer la operacion ya hecha: logAction cae a su respaldo.
async function audit({ actorId, userId, action, description, before = null, after = null, scope = NO_TENANT }) {
  try {
    await logAction({
      usuario_id: actorId,
      modulo: "rbac_cambios",
      accion: action,
      descripcion: description,
      datos_anteriores: before ? { user_id: userId, ...tenantTag(scope), ...before } : null,
      datos_nuevos: { user_id: userId, ...tenantTag(scope), ...(after || {}) },
    });
  } catch (_error) { /* respaldo de logAction */ }
}

async function assertUser(userId, scope = NO_TENANT) {
  const { rows } = await db.query("SELECT id, fullname, email, role, extra_roles, active FROM public.users WHERE id = $1", [userId]);
  if (!rows[0]) throw httpError(404, "El usuario no existe.");
  await assertMember(scope, userId);
  return rows[0];
}

// Cuenta usuarios distintos con el rol; con empresa, solo los miembros de esa empresa (no revela cifras de otras).
const roleUsersCount = (scope, params) => {
  if (!scope.enabled) return "(SELECT COUNT(DISTINCT a.user_id)::int FROM public.user_role_assignments a WHERE a.role_id = r.id AND a.revoked_at IS NULL)";
  params.push(scope.tenantId);
  return `(SELECT COUNT(DISTINCT a.user_id)::int FROM public.user_role_assignments a
            JOIN public.tenant_memberships m ON m.user_id = a.user_id AND m.tenant_id = $${params.length} AND m.status = 'active'
           WHERE a.role_id = r.id AND a.revoked_at IS NULL)`;
};

async function getSummary(scope = NO_TENANT) {
  if (!scope.enabled) {
    const { rows } = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM public.modules) AS modules,
      (SELECT COUNT(*)::int FROM public.roles WHERE tenant_id IS NULL AND is_active) AS roles,
      (SELECT COUNT(*)::int FROM public.permissions WHERE is_active) AS permissions,
      (SELECT COUNT(*)::int FROM public.rbac_endpoint_permissions) AS endpoints,
      (SELECT COUNT(*)::int FROM public.user_role_assignments WHERE revoked_at IS NULL) AS assignments,
      (SELECT COUNT(*)::int FROM public.user_role_assignments WHERE revoked_at IS NULL AND source = 'manual') AS manual_assignments,
      (SELECT COUNT(*)::int FROM public.user_permission_grants WHERE revoked_at IS NULL) AS grants`);
    return { ...rows[0], enforcement: enforcement() };
  }
  const { rows } = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM public.modules) AS modules,
      (SELECT COUNT(*)::int FROM public.roles WHERE (tenant_id IS NULL OR tenant_id = $1) AND is_active) AS roles,
      (SELECT COUNT(*)::int FROM public.permissions WHERE is_active) AS permissions,
      (SELECT COUNT(*)::int FROM public.rbac_endpoint_permissions) AS endpoints,
      (SELECT COUNT(*)::int FROM public.user_role_assignments a JOIN public.tenant_memberships m ON m.user_id = a.user_id AND m.tenant_id = $1 AND m.status = 'active' WHERE a.revoked_at IS NULL) AS assignments,
      (SELECT COUNT(*)::int FROM public.user_role_assignments a JOIN public.tenant_memberships m ON m.user_id = a.user_id AND m.tenant_id = $1 AND m.status = 'active' WHERE a.revoked_at IS NULL AND a.source = 'manual') AS manual_assignments,
      (SELECT COUNT(*)::int FROM public.user_permission_grants g JOIN public.tenant_memberships m ON m.user_id = g.user_id AND m.tenant_id = $1 AND m.status = 'active' WHERE g.revoked_at IS NULL) AS grants`,
  [scope.tenantId]);
  return { ...rows[0], enforcement: enforcement(), tenant_id: scope.tenantId };
}

async function listRoles(scope = NO_TENANT) {
  const params = [];
  const users = roleUsersCount(scope, params);
  const visible = roleVisibility("r", scope, params);
  const { rows } = await db.query(`
    SELECT r.id, r.key, r.label, r.is_system, r.created_at,
           (SELECT COUNT(*)::int FROM public.role_permissions rp WHERE rp.role_id = r.id) AS permissions,
           ${users} AS users
      FROM public.roles r WHERE ${visible} AND r.is_active ORDER BY r.key`, params);
  return rows;
}

async function listPermissions({ q = "", moduleKey = "", limit = 200, offset = 0 } = {}) {
  const params = [];
  const where = ["p.is_active"];
  if (q) { params.push(`%${String(q).toLowerCase()}%`); where.push(`LOWER(p.key) LIKE $${params.length}`); }
  if (moduleKey) { params.push(String(moduleKey)); where.push(`p.module_key = $${params.length}`); }
  params.push(Math.min(Number(limit) || 200, 1000), Math.max(Number(offset) || 0, 0));
  const { rows } = await db.query(
    `SELECT p.key, p.module_key, p.resource, p.action, p.description, p.is_sensitive,
            (SELECT COUNT(*)::int FROM public.role_permissions rp WHERE rp.permission_key = p.key) AS roles
       FROM public.permissions p WHERE ${where.join(" AND ")} ORDER BY p.key LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

// Usuarios que se pueden administrar desde la pantalla: todos hoy; con empresa, solo sus miembros.
async function listMembers(scope = NO_TENANT) {
  if (!scope.enabled) {
    const { rows } = await db.query("SELECT id, fullname, email, role, active FROM public.users ORDER BY fullname, id");
    return rows;
  }
  const { rows } = await db.query(
    `SELECT u.id, u.fullname, u.email, u.role, u.active
       FROM public.users u JOIN public.tenant_memberships m ON m.user_id = u.id AND m.tenant_id = $1 AND m.status = 'active'
      ORDER BY u.fullname, u.id`, [scope.tenantId]);
  return rows;
}

async function getUserAccess(userId, scope = NO_TENANT) {
  const user = await assertUser(userId, scope);
  // Si cambio users.role o extra_roles, se pone al dia lo heredado de este usuario antes de mostrarlo.
  await reconcileUserInheritedRoles(db, user)
    .then((result) => { if (result.added || result.removed) invalidateCentralCache(userId); })
    .catch(() => {});
  const roleParams = [userId];
  const grantParams = [userId];
  const roleScope = scope.enabled ? ` AND ${rowVisibility("a", scope, roleParams)}` : "";
  const grantScope = scope.enabled ? ` AND ${rowVisibility("g", scope, grantParams)}` : "";
  const [assignments, grants] = await Promise.all([
    db.query(`SELECT a.id, r.key AS role, a.source, a.reason, a.starts_at, a.expires_at, a.created_at
                FROM public.user_role_assignments a JOIN public.roles r ON r.id = a.role_id
               WHERE a.user_id = $1 AND a.revoked_at IS NULL${roleScope} ORDER BY a.source, r.key`, roleParams),
    db.query(`SELECT g.id, g.permission_key, g.reason, g.starts_at, g.expires_at, g.created_at
                FROM public.user_permission_grants g WHERE g.user_id = $1 AND g.revoked_at IS NULL${grantScope} ORDER BY g.permission_key`, grantParams),
  ]);
  return {
    user: { id: user.id, fullname: user.fullname, email: user.email, role: user.role, extra_roles: user.extra_roles || [], active: user.active },
    assignments: assignments.rows,
    grants: grants.rows,
    enforcement: enforcement(),
  };
}

async function assignRole({ actorId, userId, roleKey, reason, expiresAt, scope = NO_TENANT }) {
  assertNotSelf(actorId, userId);
  const cleanedReason = cleanReason(reason);
  const expires = cleanExpiry(expiresAt);
  await assertUser(userId, scope);
  const key = String(roleKey || "").toLowerCase();
  const roleParams = [key];
  const roleScope = scope.enabled ? roleVisibility("", scope, roleParams) : "tenant_id IS NULL";
  const role = (await db.query(`SELECT id FROM public.roles WHERE key = $1 AND ${roleScope} AND is_active${scope.enabled ? " ORDER BY tenant_id NULLS LAST LIMIT 1" : ""}`, roleParams)).rows[0];
  if (!role) throw httpError(400, "El rol no existe en el catalogo.");
  // Sin objetivo de conflicto: sirve con el indice unico de 316 y con el de 317 (que incluye la empresa).
  const { rows } = scope.enabled
    ? await db.query(
      `INSERT INTO public.user_role_assignments (user_id, role_id, source, reason, assigned_by, expires_at, tenant_id)
       VALUES ($1, $2, 'manual', $3, $4, $5, $6)
       ON CONFLICT DO NOTHING RETURNING id`,
      [userId, role.id, cleanedReason, actorId, expires, scope.tenantId],
    )
    : await db.query(
      `INSERT INTO public.user_role_assignments (user_id, role_id, source, reason, assigned_by, expires_at)
       VALUES ($1, $2, 'manual', $3, $4, $5)
       ON CONFLICT DO NOTHING RETURNING id`,
      [userId, role.id, cleanedReason, actorId, expires],
    );
  if (!rows[0]) throw httpError(409, "El usuario ya tiene ese rol asignado manualmente.");
  invalidateCentralCache(userId);
  await audit({ actorId, userId, scope, action: "asignar_rol", description: `Rol ${key}: ${cleanedReason}`, after: { role: key, reason: cleanedReason, expires_at: expires } });
  return getUserAccess(userId, scope);
}

async function revokeRole({ actorId, userId, assignmentId, reason, scope = NO_TENANT }) {
  assertNotSelf(actorId, userId);
  const cleanedReason = cleanReason(reason);
  await assertMember(scope, userId);
  const previousParams = [assignmentId, userId];
  const previousScope = scope.enabled ? ` AND ${rowVisibility("a", scope, previousParams)}` : "";
  const previous = (await db.query(
    `SELECT r.key AS role, a.reason, a.expires_at FROM public.user_role_assignments a JOIN public.roles r ON r.id = a.role_id
      WHERE a.id = $1 AND a.user_id = $2 AND a.revoked_at IS NULL AND a.source = 'manual'${previousScope}`, previousParams)).rows[0];
  const updateParams = [assignmentId, userId, actorId, cleanedReason];
  const updateScope = scope.enabled ? ` AND ${rowVisibility("user_role_assignments", scope, updateParams)}` : "";
  const { rows } = await db.query(
    `UPDATE public.user_role_assignments SET revoked_at = NOW(), revoked_by = $3, reason = COALESCE(reason, '') || ' | revocado: ' || $4
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND source = 'manual'${updateScope} RETURNING id`,
    updateParams,
  );
  // Las heredadas de users.role se corrigen cambiando el usuario, no desde aqui.
  if (!rows[0]) throw httpError(404, "No hay una asignacion manual vigente con ese id.");
  invalidateCentralCache(userId);
  await audit({ actorId, userId, scope, action: "revocar_rol", description: `Rol ${previous?.role || assignmentId}: ${cleanedReason}`, before: previous || { id: assignmentId }, after: { revoked: true, reason: cleanedReason } });
  return getUserAccess(userId, scope);
}

async function grantPermission({ actorId, userId, permissionKey, reason, expiresAt, scope = NO_TENANT }) {
  assertNotSelf(actorId, userId);
  const cleanedReason = cleanReason(reason);
  const expires = cleanExpiry(expiresAt);
  await assertUser(userId, scope);
  const permission = (await db.query("SELECT key FROM public.permissions WHERE key = $1 AND is_active", [String(permissionKey || "")])).rows[0];
  if (!permission) throw httpError(400, "El permiso no existe en el catalogo.");
  if (scope.enabled) {
    await db.query(
      `INSERT INTO public.user_permission_grants (user_id, permission_key, reason, assigned_by, expires_at, tenant_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, permission.key, cleanedReason, actorId, expires, scope.tenantId],
    );
  } else {
    await db.query(
      `INSERT INTO public.user_permission_grants (user_id, permission_key, reason, assigned_by, expires_at) VALUES ($1, $2, $3, $4, $5)`,
      [userId, permission.key, cleanedReason, actorId, expires],
    );
  }
  invalidateCentralCache(userId);
  await audit({ actorId, userId, scope, action: "otorgar_permiso", description: `${permission.key}: ${cleanedReason}`, after: { permission: permission.key, reason: cleanedReason, expires_at: expires } });
  return getUserAccess(userId, scope);
}

async function revokeGrant({ actorId, userId, grantId, scope = NO_TENANT }) {
  assertNotSelf(actorId, userId);
  await assertMember(scope, userId);
  const params = [grantId, userId, actorId];
  const tenantScope = scope.enabled ? ` AND ${rowVisibility("user_permission_grants", scope, params)}` : "";
  const { rows } = await db.query(
    `UPDATE public.user_permission_grants SET revoked_at = NOW(), revoked_by = $3 WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL${tenantScope}
      RETURNING id, permission_key, reason, expires_at`,
    params,
  );
  if (!rows[0]) throw httpError(404, "No hay un grant vigente con ese id.");
  invalidateCentralCache(userId);
  await audit({ actorId, userId, scope, action: "revocar_permiso", description: rows[0].permission_key, before: rows[0], after: { revoked: true } });
  return getUserAccess(userId, scope);
}

// Matriz rol x area: cuantos permisos de cada area tiene cada rol. Sirve para revisar de un vistazo.
async function getMatrix(scope = NO_TENANT) {
  const params = [];
  const visible = roleVisibility("r", scope, params);
  const { rows } = await db.query(`
    SELECT r.key AS role, split_part(p.resource, '/', 1) AS area, COUNT(*)::int AS permissions
      FROM public.role_permissions rp
      JOIN public.roles r ON r.id = rp.role_id AND ${visible} AND r.is_active
      JOIN public.permissions p ON p.key = rp.permission_key AND p.is_active
     GROUP BY r.key, split_part(p.resource, '/', 1) ORDER BY r.key, area`, params);
  const cells = {};
  rows.forEach((row) => { cells[`${row.role}|${row.area}`] = row.permissions; });
  return { areas: [...new Set(rows.map((row) => row.area))].sort(), roles: [...new Set(rows.map((row) => row.role))].sort(), cells };
}

async function listAudit({ userId = null, limit = 50, scope = NO_TENANT } = {}) {
  const params = [Math.min(Number(limit) || 50, 200)];
  let where = "l.modulo = 'rbac_cambios'";
  if (userId) {
    params.push(String(userId));
    where += ` AND COALESCE(l.datos_nuevos->>'user_id', l.datos_anteriores->>'user_id') = $${params.length}`;
  }
  if (scope.enabled) {
    // Solo lo etiquetado con la empresa: los registros anteriores al modo multiempresa no se muestran a ninguna.
    params.push(String(scope.tenantId));
    where += ` AND COALESCE(l.datos_nuevos->>'tenant_id', l.datos_anteriores->>'tenant_id') = $${params.length}`;
  }
  const { rows } = await db.query(
    `SELECT l.id, l.usuario_email AS actor, l.rol AS actor_role, l.accion AS action, l.descripcion AS description,
            l.datos_anteriores AS before, l.datos_nuevos AS after, l.fecha AS at
       FROM auditoria.logs l WHERE ${where} ORDER BY l.id DESC LIMIT $1`,
    params,
  );
  return rows;
}

// Pone al dia lo heredado de todos los usuarios. Idempotente; las asignaciones manuales no se tocan.
async function syncInherited({ actorId, scope = NO_TENANT }) {
  const { rows: users } = scope.enabled
    ? await db.query(
      `SELECT u.id, u.role, u.extra_roles FROM public.users u
         JOIN public.tenant_memberships m ON m.user_id = u.id AND m.tenant_id = $1 AND m.status = 'active'`, [scope.tenantId])
    : await db.query("SELECT id, role, extra_roles FROM public.users");
  let added = 0;
  let removed = 0;
  for (const user of users) {
    const result = await reconcileUserInheritedRoles(db, user);
    added += result.added;
    removed += result.removed;
  }
  invalidateCentralCache();
  await audit({ actorId, userId: actorId, scope, action: "sincronizar_heredadas", description: `+${added} -${removed}`, after: { users: users.length, added, removed } });
  return { users: users.length, added, removed };
}

// ---- Constructor de roles ---------------------------------------------------------------------------
// Los roles personalizados viven en la base y su prefijo `custom_` los separa de los roles del codigo: asi
// ninguno puede llamarse `admin`, `jefe_ti` ni cualquier nombre que requireRole o los superroles reconozcan.
// Los roles de sistema (derivados del codigo) son de solo lectura. Un rol personalizado solo tiene efecto en las
// areas con RBAC_CENTRAL_ENFORCE activo; en el resto sigue decidiendo requireRole.
const CUSTOM_PREFIX = "custom_";
const ROLE_KEY_PATTERN = /^custom_[a-z0-9_]{2,50}$/;
const MAX_ROLE_PERMISSIONS = 700;
// Permisos de administracion del propio RBAC: no se pueden delegar en un rol personalizado.
const RESERVED_PERMISSION = /^(rbac|module_access)\./;

function cleanRoleKey(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  const key = raw.startsWith(CUSTOM_PREFIX) ? raw : `${CUSTOM_PREFIX}${raw}`;
  if (!ROLE_KEY_PATTERN.test(key)) throw httpError(400, "El nombre del rol debe tener entre 2 y 50 letras, numeros o guiones bajos.");
  return key;
}

function cleanLabel(value) {
  const label = String(value || "").trim();
  if (label.length < 2 || label.length > 80) throw httpError(400, "El nombre visible del rol debe tener entre 2 y 80 caracteres.");
  return label;
}

async function cleanPermissions(permissions) {
  const keys = [...new Set((Array.isArray(permissions) ? permissions : []).map((key) => String(key || "").trim()).filter(Boolean))];
  if (!keys.length) throw httpError(400, "Elige al menos un permiso para el rol.");
  if (keys.length > MAX_ROLE_PERMISSIONS) throw httpError(400, "Demasiados permisos en un solo rol.");
  const reserved = keys.filter((key) => RESERVED_PERMISSION.test(key));
  if (reserved.length) throw httpError(400, `Estos permisos son de administracion del sistema y no se pueden delegar: ${reserved.join(", ")}.`);
  const { rows } = await db.query("SELECT key FROM public.permissions WHERE is_active AND key = ANY($1::text[])", [keys]);
  const known = new Set(rows.map((row) => row.key));
  const unknown = keys.filter((key) => !known.has(key));
  if (unknown.length) throw httpError(400, `Permisos que no existen: ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? "…" : ""}.`);
  return keys.sort();
}

async function getRole(roleId, scope = NO_TENANT) {
  const params = [roleId];
  const users = roleUsersCount(scope, params);
  const visible = roleVisibility("r", scope, params);
  const { rows } = await db.query(
    `SELECT r.id, r.key, r.label, r.is_system, r.is_active, r.tenant_id,
            COALESCE((SELECT array_agg(rp.permission_key ORDER BY rp.permission_key) FROM public.role_permissions rp WHERE rp.role_id = r.id), '{}') AS permissions,
            ${users} AS users
       FROM public.roles r WHERE r.id = $1 AND ${visible} AND r.is_active`, params);
  if (!rows[0]) throw httpError(404, "El rol no existe.");
  return rows[0];
}

// Con empresa, solo se modifican los roles de la propia empresa; los personalizados anteriores al modo
// multiempresa (sin empresa) los adopta la plataforma, no una empresa.
function assertEditable(role, scope) {
  if (role.is_system) throw httpError(403, "Los roles de sistema vienen del codigo y no se editan aqui. Duplicalo para crear uno personalizado.");
  if (scope.enabled && Number(role.tenant_id) !== Number(scope.tenantId)) {
    throw httpError(403, "Este rol no pertenece a tu empresa. Duplicalo para crear uno propio.");
  }
}

async function auditRole({ actorId, action, role, before = null, after = null, description, scope = NO_TENANT }) {
  try {
    await logAction({
      usuario_id: actorId, modulo: "rbac_cambios", accion: action, descripcion: description,
      datos_anteriores: before ? { role_id: role.id, role: role.key, ...tenantTag(scope), ...before } : null,
      datos_nuevos: { role_id: role.id, role: role.key, ...tenantTag(scope), ...(after || {}) },
    });
  } catch (_error) { /* respaldo de logAction */ }
}

async function writeRolePermissions(client, roleId, permissions) {
  await client.query("DELETE FROM public.role_permissions WHERE role_id = $1", [roleId]);
  await client.query(
    "INSERT INTO public.role_permissions (role_id, permission_key) SELECT $1, unnest($2::text[])", [roleId, permissions]);
}

async function createRole({ actorId, key, label, permissions, cloneFromId, reason, scope = NO_TENANT }) {
  const cleanedReason = cleanReason(reason);
  const roleKey = cleanRoleKey(key);
  const roleLabel = cleanLabel(label);
  let chosen = permissions;
  if ((!Array.isArray(chosen) || !chosen.length) && cloneFromId) {
    chosen = (await getRole(cloneFromId, scope)).permissions.filter((permission) => !RESERVED_PERMISSION.test(permission));
  }
  const keys = await cleanPermissions(chosen);

  const client = await db.getClient();
  let role;
  try {
    await client.query("BEGIN");
    const inserted = scope.enabled
      ? await client.query("INSERT INTO public.roles (tenant_id, key, label, is_system) VALUES ($3, $1, $2, FALSE) RETURNING id, key, label", [roleKey, roleLabel, scope.tenantId])
      : await client.query("INSERT INTO public.roles (tenant_id, key, label, is_system) VALUES (NULL, $1, $2, FALSE) RETURNING id, key, label", [roleKey, roleLabel]);
    role = inserted.rows[0];
    await writeRolePermissions(client, role.id, keys);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") throw httpError(409, "Ya existe un rol con ese nombre (puede estar archivado).");
    throw error;
  } finally {
    client.release();
  }
  invalidateCentralCache();
  await auditRole({ actorId, scope, action: "crear_rol", role, description: `${role.key}: ${cleanedReason}`, after: { label: roleLabel, permissions: keys.length, reason: cleanedReason } });
  return getRole(role.id, scope);
}

async function updateRole({ actorId, roleId, label, permissions, reason, scope = NO_TENANT }) {
  const cleanedReason = cleanReason(reason);
  const current = await getRole(roleId, scope);
  assertEditable(current, scope);
  const roleLabel = label === undefined ? current.label : cleanLabel(label);
  const keys = permissions === undefined ? current.permissions : await cleanPermissions(permissions);
  const before = new Set(current.permissions);
  const after = new Set(keys);
  const added = keys.filter((key) => !before.has(key));
  const removed = current.permissions.filter((key) => !after.has(key));
  if (!added.length && !removed.length && roleLabel === current.label) throw httpError(400, "No hay cambios que guardar.");

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE public.roles SET label = $2, updated_at = NOW() WHERE id = $1", [roleId, roleLabel]);
    await writeRolePermissions(client, roleId, keys);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  invalidateCentralCache();
  await auditRole({
    actorId, scope, action: "editar_rol", role: current, description: `${current.key}: ${cleanedReason}`,
    before: { label: current.label, permissions: current.permissions.length },
    after: { label: roleLabel, permissions: keys.length, added, removed, reason: cleanedReason },
  });
  return getRole(roleId, scope);
}

// Se archiva en vez de borrar: asi se conserva el historial de asignaciones. Con usuarios activos se rechaza.
async function archiveRole({ actorId, roleId, reason, scope = NO_TENANT }) {
  const cleanedReason = cleanReason(reason);
  const current = await getRole(roleId, scope);
  if (current.is_system) throw httpError(403, "Los roles de sistema no se archivan.");
  assertEditable(current, scope);
  if (current.users > 0) throw httpError(409, `El rol lo tienen ${current.users} usuario(s). Retiraselo primero.`);
  await db.query("UPDATE public.roles SET is_active = FALSE, updated_at = NOW() WHERE id = $1", [roleId]);
  invalidateCentralCache();
  await auditRole({ actorId, scope, action: "archivar_rol", role: current, description: `${current.key}: ${cleanedReason}`, before: { label: current.label, permissions: current.permissions.length }, after: { archived: true, reason: cleanedReason } });
  return { id: current.id, key: current.key, archived: true };
}

module.exports = {
  getRole, createRole, updateRole, archiveRole, CUSTOM_PREFIX, getSummary, listRoles, listPermissions, listMembers,
  getUserAccess, assignRole, revokeRole, grantPermission, revokeGrant, getMatrix, listAudit, syncInherited,
};
