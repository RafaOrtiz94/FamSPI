const db = require("../../config/db");

const MODULE_CATALOG = [
  { key: "inicio", label: "Inicio", path_prefixes: ["/dashboard"] },
  { key: "ti_workspace", label: "TI Workspace", path_prefixes: ["/dashboard/ti/workspace"] },
  { key: "ti_dispositivos", label: "TI Dispositivos", path_prefixes: ["/dashboard/ti/dispositivos"] },
  { key: "ti_modulos", label: "TI Modulos por Usuario", path_prefixes: ["/dashboard/ti/modulos"] },
  { key: "ti_casos_externos", label: "TI Casos Externos", path_prefixes: ["/dashboard/ti/casos-externos"] },
  { key: "talento_colaboradores", label: "Talento Colaboradores", path_prefixes: ["/dashboard/talento-humano/colaboradores"] },
  { key: "talento_gestion", label: "Talento Gestion", path_prefixes: ["/dashboard/talento-humano/gestion"] },
  { key: "talento_permisos", label: "Talento Permisos y Vacaciones", path_prefixes: ["/dashboard/talento-humano/permisos"] },
  { key: "talento_asistencia", label: "Talento Asistencia Reportes", path_prefixes: ["/dashboard/talento-humano/asistencia-reportes"] },
  { key: "auditoria", label: "Auditoria y Trazabilidad", path_prefixes: ["/dashboard/auditoria"] },
  { key: "auditoria_preparacion", label: "Auditoria Preparacion", path_prefixes: ["/dashboard/auditoria/preparacion"] },
  { key: "comercial_solicitudes", label: "Comercial Solicitudes", path_prefixes: ["/dashboard/comercial/solicitudes"] },
  { key: "comercial_clientes", label: "Comercial Clientes", path_prefixes: ["/dashboard/comercial/clientes"] },
  { key: "comercial_planificacion", label: "Comercial Planificacion", path_prefixes: ["/dashboard/comercial/planificacion"] },
  { key: "comercial_aprobacion_planes", label: "Comercial Aprobacion de Planes", path_prefixes: ["/dashboard/comercial/aprobaciones-planificacion"] },
  { key: "comercial_compras_publicas", label: "Comercial Compras Publicas", path_prefixes: ["/dashboard/comercial/equipment-purchases"] },
  { key: "comercial_maximos_saldos", label: "Comercial Maximos y Saldos", path_prefixes: ["/dashboard/comercial/delivery-ceilings"] },
  { key: "business_case", label: "Business Case", path_prefixes: ["/dashboard/business-case"] },
  { key: "workspace_compras", label: "Workspace Compras", path_prefixes: ["/dashboard/purchases/workspace"] },
  { key: "servicio_workspace", label: "Servicio Workspace Procedimiento", path_prefixes: ["/dashboard/servicio-tecnico/workspace-procedimiento"] },
  { key: "servicio_mantenimientos", label: "Servicio Mantenimientos", path_prefixes: ["/dashboard/servicio-tecnico/mantenimientos"] },
  { key: "servicio_solicitudes", label: "Servicio Solicitudes", path_prefixes: ["/dashboard/servicio-tecnico/solicitudes"] },
  { key: "servicio_disponibilidad", label: "Servicio Disponibilidad", path_prefixes: ["/dashboard/servicio-tecnico/disponibilidad"] },
  { key: "servicio_capacitaciones", label: "Servicio Capacitaciones", path_prefixes: ["/dashboard/servicio-tecnico/capacitaciones"] },
  { key: "servicio_equipos", label: "Servicio Equipos", path_prefixes: ["/dashboard/servicio-tecnico/equipos"] },
  { key: "servicio_aprobaciones", label: "Servicio Aprobaciones", path_prefixes: ["/dashboard/servicio-tecnico/aprobaciones"] },
  { key: "servicio_aplicaciones", label: "Servicio Aplicaciones", path_prefixes: ["/dashboard/servicio-tecnico/aplicaciones"] },
  { key: "servicio_desinfeccion", label: "Servicio Desinfeccion", path_prefixes: ["/dashboard/servicio-tecnico/desinfeccion"] },
  { key: "servicio_asistencia", label: "Servicio Asistencia", path_prefixes: ["/dashboard/servicio-tecnico/asistencia"] },
  { key: "servicio_verificacion", label: "Servicio Verificacion", path_prefixes: ["/dashboard/servicio-tecnico/verificacion"] },
  { key: "finanzas_viaticos", label: "Finanzas Viaticos", path_prefixes: ["/dashboard/finanzas/viaticos"] },
  { key: "operaciones", label: "Operaciones", path_prefixes: ["/dashboard/operaciones"] },
  { key: "logistica", label: "Logistica", path_prefixes: ["/dashboard/logistica"] },
  { key: "calidad", label: "Calidad", path_prefixes: ["/dashboard/calidad"] },
];

async function ensureSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.user_module_access (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      module_key TEXT NOT NULL,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, module_key)
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_user_module_access_user_id
      ON public.user_module_access(user_id);
  `);
}

function sanitizeModuleKey(value) {
  return String(value || "").trim().toLowerCase();
}

function getCatalog() {
  return MODULE_CATALOG;
}

async function listUserModuleAccess(userId) {
  try {
    await ensureSchema();
    const { rows } = await db.query(
      `
        SELECT module_key, is_enabled, updated_at, updated_by
        FROM public.user_module_access
        WHERE user_id = $1
        ORDER BY module_key ASC
      `,
      [userId]
    );
    return rows.map((row) => ({
      module_key: row.module_key,
      is_enabled: Boolean(row.is_enabled),
      updated_at: row.updated_at,
      updated_by: row.updated_by,
    }));
  } catch (_error) {
    return [];
  }
}

async function upsertUserModuleAccess({ userId, modules, actorUserId }) {
  await ensureSchema();
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    for (const item of modules || []) {
      const key = sanitizeModuleKey(item.module_key);
      const enabled = Boolean(item.is_enabled);
      if (!key) continue;
      await client.query(
        `
          INSERT INTO public.user_module_access (user_id, module_key, is_enabled, updated_by, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (user_id, module_key)
          DO UPDATE SET
            is_enabled = EXCLUDED.is_enabled,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
        `,
        [userId, key, enabled, actorUserId || null]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return listUserModuleAccess(userId);
}

function resolveModuleKeyByPath(pathname) {
  const path = String(pathname || "");
  let bestMatch = null;
  let bestLen = -1;
  for (const module of MODULE_CATALOG) {
    for (const prefix of module.path_prefixes || []) {
      if (path.startsWith(prefix) && prefix.length > bestLen) {
        bestMatch = module.key;
        bestLen = prefix.length;
      }
    }
  }
  return bestMatch;
}

async function isModuleEnabledForUser({ userId, moduleKey }) {
  try {
    await ensureSchema();
    const key = sanitizeModuleKey(moduleKey);
    if (!key) return true;
    const { rows } = await db.query(
      `
        SELECT is_enabled
        FROM public.user_module_access
        WHERE user_id = $1 AND module_key = $2
        LIMIT 1
      `,
      [userId, key]
    );
    if (!rows.length) return true;
    return Boolean(rows[0].is_enabled);
  } catch (_error) {
    return true;
  }
}

module.exports = {
  getCatalog,
  listUserModuleAccess,
  upsertUserModuleAccess,
  resolveModuleKeyByPath,
  isModuleEnabledForUser,
};
