/**
 * Asignaciones centrales heredadas de los datos de usuarios (plan RBAC, Fase 3).
 *
 * Reproduce los roles que ve requireRole: users.role, el scope que el login deriva de ese rol y
 * users.extra_roles. Los valores no validos (`pending`, `"null"`, vacio) no se convierten.
 * Lo usan el sembrador, la pantalla de administracion (al abrir un usuario) y la sincronizacion completa.
 */
const { normalizeRoleName } = require("../../middlewares/roles");

const ROLE_PATTERN = /^[a-z][a-z0-9_]{1,62}$/;
const NOT_REAL = new Set(["null", "pending", "pendiente", ""]);

const isConvertible = (name) => !NOT_REAL.has(name) && ROLE_PATTERN.test(name);

// Se carga al usarse: auth.controller trae configuracion y conexiones que un script no necesita al importar.
const scopeOf = (role) => require("../../modules/auth/auth.controller").resolveRoleMeta(role).scope;

/** Devuelve { assignments: [{role, source}], unconvertible: [{value, where}] } para una fila de users. */
function deriveInheritedRoles(user, deriveScope = (role) => String(scopeOf(role) || "").toLowerCase()) {
  const assignments = [];
  const unconvertible = [];
  const role = normalizeRoleName(user.role);
  if (!isConvertible(role)) {
    unconvertible.push({ value: user.role === null || user.role === undefined ? "(sin rol)" : String(user.role), where: "role" });
    return { assignments, unconvertible };
  }
  assignments.push({ role, source: "legacy_role" });
  const scope = deriveScope(role);
  if (scope && scope !== role && isConvertible(scope)) assignments.push({ role: scope, source: "legacy_scope" });
  (Array.isArray(user.extra_roles) ? user.extra_roles : []).forEach((extra) => {
    const name = normalizeRoleName(extra);
    if (isConvertible(name)) assignments.push({ role: name, source: "legacy_extra_role" });
    else unconvertible.push({ value: String(extra), where: "extra_roles" });
  });
  return { assignments, unconvertible };
}

/**
 * Deja las asignaciones heredadas de un usuario iguales a las que salen de sus datos actuales.
 * Las manuales no se tocan. Crea los roles que falten. `db` puede ser el pool o un cliente en transaccion.
 * Devuelve { added, removed }.
 */
async function reconcileUserInheritedRoles(db, user) {
  const { assignments } = deriveInheritedRoles(user);
  const wanted = new Set(assignments.map((item) => `${item.role}|${item.source}`));
  const { rows: current } = await db.query(
    `SELECT a.id, r.key AS role, a.source FROM public.user_role_assignments a JOIN public.roles r ON r.id = a.role_id
      WHERE a.user_id = $1 AND a.revoked_at IS NULL AND a.source <> 'manual'`, [user.id]);
  const have = new Set(current.map((item) => `${item.role}|${item.source}`));
  const stale = current.filter((item) => !wanted.has(`${item.role}|${item.source}`));
  let added = 0;
  for (const item of assignments.filter((entry) => !have.has(`${entry.role}|${entry.source}`))) {
    await db.query(
      `INSERT INTO public.roles (tenant_id, key, label, is_system) VALUES (NULL, $1, $1, TRUE) ON CONFLICT (key) WHERE tenant_id IS NULL DO NOTHING`, [item.role]);
    const { rowCount } = await db.query(
      `INSERT INTO public.user_role_assignments (user_id, role_id, source)
       SELECT $1, id, $3 FROM public.roles WHERE key = $2 AND tenant_id IS NULL ON CONFLICT DO NOTHING`, [user.id, item.role, item.source]);
    added += rowCount;
  }
  if (stale.length) {
    await db.query(
      `UPDATE public.user_role_assignments SET revoked_at = NOW(), reason = COALESCE(reason, 'cambio en users.role o extra_roles')
        WHERE id = ANY($1::bigint[])`, [stale.map((item) => item.id)]);
  }
  return { added, removed: stale.length };
}

module.exports = { deriveInheritedRoles, reconcileUserInheritedRoles, isConvertible };
