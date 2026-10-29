const db = require("../../config/db");

const MODULE_CATALOG = [
  { key: "inicio",        label: "Inicio",          path_prefixes: ["/dashboard"] },
  { key: "kickoff_2026",  label: "Kick Off 2026",   path_prefixes: ["/dashboard/kickoff"] },
  { key: "famdays",       label: "FamDays",         path_prefixes: ["/dashboard/famdays"] },
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
  { key: "comercial_clientes", label: "Comercial Clientes", path_prefixes: ["/dashboard/comercial/clientes", "/dashboard/clientes"] },
  { key: "comercial_planificacion", label: "Comercial Planificacion", path_prefixes: ["/dashboard/comercial/planificacion"] },
  { key: "comercial_aprobacion_planes", label: "Comercial Aprobacion de Planes", path_prefixes: ["/dashboard/comercial/aprobaciones-planificacion"] },
  { key: "comercial_compras_publicas", label: "Comercial Compras Publicas", path_prefixes: ["/dashboard/comercial/equipment-purchases"] },
  { key: "comercial_maximos_saldos", label: "Comercial Maximos y Saldos", path_prefixes: ["/dashboard/comercial/delivery-ceilings"] },
  { key: "business_case", label: "Business Case", path_prefixes: ["/dashboard/business-case"] },
  { key: "workspace_compras", label: "Workspace Compras", path_prefixes: ["/dashboard/purchases/workspace"] },
  { key: "work_management", label: "Work Management", path_prefixes: ["/dashboard/work-management"] },
  { key: "servicio_cronograma", label: "Servicio Cronograma Tecnico", path_prefixes: ["/dashboard/servicio-tecnico/cronograma"] },
  { key: "servicio_inspecciones", label: "Servicio Inspecciones de Ambiente", path_prefixes: ["/dashboard/servicio-tecnico/inspecciones"] },
  { key: "servicio_correctivos", label: "Servicio Correctivos", path_prefixes: ["/dashboard/servicio-tecnico/correctivos"] },
  { key: "servicio_workspace", label: "Servicio Workspace Procedimiento", path_prefixes: ["/dashboard/servicio-tecnico/workspace-procedimiento"] },
  { key: "servicio_retiros", label: "Servicio Retiros", path_prefixes: ["/dashboard/servicio-tecnico/retiros"] },
  { key: "servicio_mantenimientos", label: "Servicio Mantenimientos", path_prefixes: ["/dashboard/servicio-tecnico/mantenimientos"] },
  { key: "servicio_solicitudes", label: "Servicio Solicitudes", path_prefixes: ["/dashboard/servicio-tecnico/solicitudes"] },
  { key: "servicio_disponibilidad", label: "Servicio Disponibilidad", path_prefixes: ["/dashboard/servicio-tecnico/disponibilidad"] },
  { key: "servicio_capacitaciones", label: "Servicio Capacitaciones", path_prefixes: ["/dashboard/servicio-tecnico/capacitaciones"] },
  { key: "servicio_equipos", label: "Servicio Equipos", path_prefixes: ["/dashboard/servicio-tecnico/equipos", "/dashboard/equipos"] },
  { key: "servicio_aprobaciones", label: "Servicio Aprobaciones", path_prefixes: ["/dashboard/servicio-tecnico/aprobaciones"] },
  { key: "servicio_aplicaciones", label: "Servicio Aplicaciones", path_prefixes: ["/dashboard/servicio-tecnico/aplicaciones"] },
  { key: "servicio_desinfeccion", label: "Servicio Desinfeccion", path_prefixes: ["/dashboard/servicio-tecnico/desinfeccion"] },
  { key: "servicio_asistencia", label: "Servicio Asistencia", path_prefixes: ["/dashboard/servicio-tecnico/asistencia"] },
  { key: "servicio_verificacion", label: "Servicio Verificacion", path_prefixes: ["/dashboard/servicio-tecnico/verificacion"] },
  { key: "finanzas_viaticos", label: "Finanzas Viaticos", path_prefixes: ["/dashboard/finanzas/viaticos"] },
  { key: "operaciones", label: "Operaciones", path_prefixes: ["/dashboard/operaciones"] },
  { key: "logistica", label: "Logistica", path_prefixes: ["/dashboard/logistica"] },
  { key: "calidad", label: "Calidad", path_prefixes: ["/dashboard/calidad"] },

  // Agregados en auditoria de cobertura (2026-08-18): estas areas ya tenian
  // paginas y rutas reales en produccion pero nunca se habian registrado en
  // el catalogo, por lo que quedaban implicitamente bajo "inicio" y no se
  // podian activar/desactivar por usuario (ej. pasantes) de forma granular.
  { key: "collab_entregas", label: "Entregas Colaboradores", path_prefixes: ["/dashboard/collab/entregas"] },
  { key: "collab_resumen", label: "Resumen Entregas Colaboradores", path_prefixes: ["/dashboard/collab/resumen"] },
  { key: "ti_actas", label: "TI Actas de Entrega", path_prefixes: ["/dashboard/ti/actas"] },
  { key: "ti_activos", label: "TI Activos (Financiero)", path_prefixes: ["/dashboard/ti/activos"] },
  { key: "talento_command_center", label: "Talento Centro de Comando", path_prefixes: ["/dashboard/talento-humano/command-center"] },
  { key: "talento_departamentos", label: "Talento Departamentos", path_prefixes: ["/dashboard/talento-humano/departamentos"] },
  { key: "talento_usuarios", label: "Talento Gestion de Usuarios", path_prefixes: ["/dashboard/talento-humano/usuarios"] },
  { key: "talento_solicitudes", label: "Talento Solicitudes", path_prefixes: ["/dashboard/talento-humano/solicitudes"] },
  { key: "talento_workspace_personal", label: "Talento Workspace Personal", path_prefixes: ["/dashboard/talento-humano/workspace-personal"] },
  { key: "talento_pruebas_tecnicas", label: "Talento Pruebas Tecnicas", path_prefixes: ["/dashboard/talento-humano/pruebas-tecnicas"] },
  { key: "talento_reporte_documentacion", label: "Talento Reporte de Documentacion", path_prefixes: ["/dashboard/talento-humano/reporte-documentacion"] },
  { key: "capacitaciones", label: "Capacitaciones", path_prefixes: ["/dashboard/capacitaciones"] },
  { key: "signatures", label: "Firmas (FamSign)", path_prefixes: ["/dashboard/signatures"] },
  { key: "backoffice", label: "Backoffice Comercial", path_prefixes: ["/dashboard/backoffice"] },
  { key: "crm_fam", label: "CRM Fam", path_prefixes: ["/dashboard/crm-fam"] },
  { key: "links_interes", label: "Links de Interes", path_prefixes: ["/dashboard/links-interes"] },
  { key: "gerencia", label: "Gerencia", path_prefixes: ["/dashboard/gerencia"] },
  { key: "finanzas", label: "Finanzas", path_prefixes: ["/dashboard/finanzas"] },
  // Catch-alls de area: cubren cualquier ruta futura bajo estos prefijos que
  // no tenga su propia clave especifica (las claves especificas siguen
  // ganando por prefijo mas largo), para que nada vuelva a caer en "inicio"
  // por omision.
  { key: "comercial", label: "Comercial (General)", path_prefixes: ["/dashboard/comercial"] },
  { key: "ti", label: "TI (General)", path_prefixes: ["/dashboard/ti"] },
  { key: "talento_humano", label: "Talento Humano (General)", path_prefixes: ["/dashboard/talento-humano"] },
];

let ensureSchemaPromise = null;
let ensureGlobalStatusSchemaPromise = null;

// ponytail: moduleAccessGuard llama isModuleEnabledForUser en cada request
// autenticado -> cachear en memoria (TTL 60s) en vez de 1 query por request.
// Se invalida al toggle de acceso (upsertUserModuleAccess) para que un
// revoke aplique de inmediato en vez de esperar el TTL.
const MODULE_ACCESS_CACHE_TTL_MS = 60000;
const moduleAccessCache = new Map(); // `${userId}:${moduleKey}` -> { enabled, expiresAt }

function invalidateUserModuleAccessCache(userId) {
  const prefix = `${userId}:`;
  for (const key of moduleAccessCache.keys()) {
    if (key.startsWith(prefix)) moduleAccessCache.delete(key);
  }
}

async function ensureSchema() {
  if (ensureSchemaPromise) {
    return ensureSchemaPromise;
  }

  ensureSchemaPromise = (async () => {
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
  })();

  return ensureSchemaPromise;
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
  invalidateUserModuleAccessCache(userId);
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
  const key = sanitizeModuleKey(moduleKey);
  if (!key) return true;

  const cacheKey = `${userId}:${key}`;
  const cached = moduleAccessCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.enabled;
  }

  try {
    await ensureSchema();
    const { rows } = await db.query(
      `
        SELECT is_enabled
        FROM public.user_module_access
        WHERE user_id = $1 AND module_key = $2
        LIMIT 1
      `,
      [userId, key]
    );
    const enabled = !rows.length ? true : Boolean(rows[0].is_enabled);
    moduleAccessCache.set(cacheKey, { enabled, expiresAt: Date.now() + MODULE_ACCESS_CACHE_TTL_MS });
    return enabled;
  } catch (_error) {
    return true;
  }
}

// ─── Global module status ─────────────────────────────────────────────────────

async function ensureGlobalStatusSchema() {
  if (ensureGlobalStatusSchemaPromise) {
    return ensureGlobalStatusSchemaPromise;
  }

  ensureGlobalStatusSchemaPromise = (async () => {
    await db.query(`
    CREATE TABLE IF NOT EXISTS module_global_status (
      module_key        TEXT PRIMARY KEY,
      stage             TEXT NOT NULL DEFAULT 'production'
                        CHECK (stage IN ('production', 'testing', 'construction')),
      whitelist_emails  TEXT[] NOT NULL DEFAULT '{}',
      updated_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  })();

  return ensureGlobalStatusSchemaPromise;
}

async function listGlobalModuleStatuses() {
  try {
    await ensureGlobalStatusSchema();
    const { rows } = await db.query(
      `SELECT module_key, stage, whitelist_emails, updated_at, updated_by
       FROM module_global_status ORDER BY module_key`
    );
    return rows;
  } catch (_) {
    return [];
  }
}

// talento_asistencia está temporalmente en construcción hasta esta fecha (UTC-5 Ecuador).
const ASISTENCIA_REENABLE_DATE = new Date('2026-06-06T00:00:00-05:00');

async function getGlobalModuleStatusForUser(userEmail) {
  const statuses = await listGlobalModuleStatuses();
  const now = new Date();

  const rows = statuses.map(s => {
    let stage = s.stage;
    if (s.module_key === 'talento_asistencia' && now < ASISTENCIA_REENABLE_DATE) {
      stage = 'construction';
    }
    return {
      module_key:   s.module_key,
      stage,
      in_whitelist: Array.isArray(s.whitelist_emails)
        ? s.whitelist_emails.map(e => e.toLowerCase()).includes((userEmail || '').toLowerCase())
        : false,
    };
  });

  // Si talento_asistencia no tiene fila en DB aún pero sigue en el periodo de bloqueo,
  // lo inyectamos para que el frontend lo trate como en construcción.
  if (now < ASISTENCIA_REENABLE_DATE && !rows.some(r => r.module_key === 'talento_asistencia')) {
    rows.push({ module_key: 'talento_asistencia', stage: 'construction', in_whitelist: false });
  }

  return rows;
}

async function upsertGlobalModuleStatus({ moduleKey, stage, whitelist_emails, actorUserId }) {
  await ensureGlobalStatusSchema();
  const key = sanitizeModuleKey(moduleKey);
  if (!key) throw Object.assign(new Error('moduleKey inválido'), { status: 400 });

  const validStages = ['production', 'testing', 'construction'];
  if (!validStages.includes(stage)) throw Object.assign(new Error('stage inválido'), { status: 400 });

  const emails = (whitelist_emails || []).map(e => String(e).trim().toLowerCase()).filter(Boolean);

  const { rows } = await db.query(
    `INSERT INTO module_global_status (module_key, stage, whitelist_emails, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (module_key) DO UPDATE SET
       stage = EXCLUDED.stage,
       whitelist_emails = EXCLUDED.whitelist_emails,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING *`,
    [key, stage, emails, actorUserId || null]
  );
  return rows[0];
}

module.exports = {
  getCatalog,
  listUserModuleAccess,
  upsertUserModuleAccess,
  resolveModuleKeyByPath,
  isModuleEnabledForUser,
  invalidateUserModuleAccessCache,
  listGlobalModuleStatuses,
  getGlobalModuleStatusForUser,
  upsertGlobalModuleStatus,
};
