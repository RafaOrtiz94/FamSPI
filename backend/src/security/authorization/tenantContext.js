/**
 * Contexto de empresa para el catalogo central de RBAC (plan RBAC, enfoque SaaS, paso 2).
 *
 * Apagado por defecto: sin RBAC_TENANT_MODE="true" todas las funciones devuelven NO_TENANT y el codigo que las
 * usa sigue exactamente los mismos caminos y consultas de antes de existir el modo multiempresa.
 * Encendido, la empresa de una peticion es la membresia activa por defecto del usuario. No viaja en el token ni
 * en encabezados: no se puede falsificar desde el navegador.
 */
const db = require("../../config/db");

const NO_TENANT = Object.freeze({ enabled: false, tenantId: null });

const isTenantModeEnabled = () => process.env.RBAC_TENANT_MODE === "true";

const httpError = (status, message) => Object.assign(new Error(message), { status });

/** Empresa activa de un usuario, o NO_TENANT si el modo esta apagado. */
async function resolveTenantScope(userId, client = db) {
  if (!isTenantModeEnabled()) return NO_TENANT;
  const { rows } = await client.query(
    `SELECT m.tenant_id
       FROM public.tenant_memberships m
       JOIN public.tenants t ON t.id = m.tenant_id AND t.status = 'active'
      WHERE m.user_id = $1 AND m.status = 'active'
      ORDER BY m.is_default DESC, m.id
      LIMIT 1`,
    [userId],
  );
  if (!rows[0]) throw httpError(403, "Tu usuario no pertenece a ninguna empresa activa.");
  return { enabled: true, tenantId: Number(rows[0].tenant_id) };
}

/** Con empresa activa, el usuario objetivo debe ser miembro de la misma. Se responde 404 para no revelar su existencia. */
async function assertMember(scope, userId, client = db) {
  if (!scope.enabled) return;
  const { rows } = await client.query(
    "SELECT 1 FROM public.tenant_memberships WHERE tenant_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1",
    [scope.tenantId, userId],
  );
  if (!rows[0]) throw httpError(404, "El usuario no existe.");
}

/**
 * Fragmento SQL de los roles visibles para la empresa. Apagado: solo globales (identico a antes).
 * Encendido: globales (sistema) mas los de la empresa. Agrega el parametro a `params`.
 */
function roleVisibility(alias, scope, params) {
  const p = alias ? `${alias}.` : "";
  if (!scope.enabled) return `${p}tenant_id IS NULL`;
  params.push(scope.tenantId);
  return `(${p}tenant_id IS NULL OR ${p}tenant_id = $${params.length})`;
}

/** Igual para asignaciones y permisos individuales: sin filtro apagado; con empresa, las heredadas (NULL) y las de la empresa. */
function rowVisibility(alias, scope, params) {
  if (!scope.enabled) return "TRUE";
  params.push(scope.tenantId);
  return `(${alias}.tenant_id IS NULL OR ${alias}.tenant_id = $${params.length})`;
}

module.exports = { NO_TENANT, isTenantModeEnabled, resolveTenantScope, assertMember, roleVisibility, rowVisibility, httpError };
