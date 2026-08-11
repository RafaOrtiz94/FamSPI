export const MODULE_PATH_PREFIXES = [
  { key: "kickoff_2026",  prefixes: ["/dashboard/kickoff"] },
  { key: "famdays",  prefixes: ["/dashboard/famdays"] },
  { key: "ti_workspace",  prefixes: ["/dashboard/ti/workspace"] },
  { key: "ti_dispositivos", prefixes: ["/dashboard/ti/dispositivos"] },
  { key: "ti_modulos", prefixes: ["/dashboard/ti/modulos"] },
  { key: "ti_casos_externos", prefixes: ["/dashboard/ti/casos-externos"] },
  { key: "talento_colaboradores", prefixes: ["/dashboard/talento-humano/colaboradores"] },
  { key: "talento_gestion", prefixes: ["/dashboard/talento-humano/gestion"] },
  { key: "talento_permisos", prefixes: ["/dashboard/talento-humano/permisos"] },
  { key: "talento_asistencia", prefixes: ["/dashboard/talento-humano/asistencia-reportes"] },
  { key: "auditoria_preparacion", prefixes: ["/dashboard/auditoria/preparacion"] },
  { key: "auditoria", prefixes: ["/dashboard/auditoria"] },
  { key: "comercial_solicitudes", prefixes: ["/dashboard/comercial/solicitudes"] },
  { key: "comercial_clientes", prefixes: ["/dashboard/comercial/clientes", "/dashboard/clientes"] },
  { key: "comercial_planificacion", prefixes: ["/dashboard/comercial/planificacion"] },
  { key: "comercial_aprobacion_planes", prefixes: ["/dashboard/comercial/aprobaciones-planificacion"] },
  { key: "comercial_compras_publicas", prefixes: ["/dashboard/comercial/equipment-purchases"] },
  { key: "comercial_maximos_saldos", prefixes: ["/dashboard/comercial/delivery-ceilings"] },
  { key: "business_case", prefixes: ["/dashboard/business-case"] },
  { key: "workspace_compras", prefixes: ["/dashboard/purchases/workspace"] },
  { key: "work_management", prefixes: ["/dashboard/work-management"] },
  { key: "servicio_cronograma", prefixes: ["/dashboard/servicio-tecnico/cronograma"] },
  { key: "servicio_inspecciones", prefixes: ["/dashboard/servicio-tecnico/inspecciones"] },
  { key: "servicio_correctivos", prefixes: ["/dashboard/servicio-tecnico/correctivos"] },
  { key: "servicio_workspace", prefixes: ["/dashboard/servicio-tecnico/workspace-procedimiento"] },
  { key: "servicio_retiros", prefixes: ["/dashboard/servicio-tecnico/retiros"] },
  { key: "servicio_mantenimientos", prefixes: ["/dashboard/servicio-tecnico/mantenimientos"] },
  { key: "servicio_solicitudes", prefixes: ["/dashboard/servicio-tecnico/solicitudes"] },
  { key: "servicio_disponibilidad", prefixes: ["/dashboard/servicio-tecnico/disponibilidad"] },
  { key: "servicio_capacitaciones", prefixes: ["/dashboard/servicio-tecnico/capacitaciones"] },
  { key: "servicio_equipos", prefixes: ["/dashboard/servicio-tecnico/equipos", "/dashboard/equipos"] },
  { key: "servicio_aprobaciones", prefixes: ["/dashboard/servicio-tecnico/aprobaciones"] },
  { key: "servicio_aplicaciones", prefixes: ["/dashboard/servicio-tecnico/aplicaciones"] },
  { key: "servicio_desinfeccion", prefixes: ["/dashboard/servicio-tecnico/desinfeccion"] },
  { key: "servicio_asistencia", prefixes: ["/dashboard/servicio-tecnico/asistencia"] },
  { key: "servicio_verificacion", prefixes: ["/dashboard/servicio-tecnico/verificacion"] },
  { key: "finanzas_viaticos", prefixes: ["/dashboard/finanzas/viaticos"] },
  { key: "operaciones", prefixes: ["/dashboard/operaciones"] },
  { key: "logistica", prefixes: ["/dashboard/logistica"] },
  { key: "calidad", prefixes: ["/dashboard/calidad"] },
  { key: "inicio", prefixes: ["/dashboard"] },
];

export const resolveModuleKeyForPath = (pathname = "") => {
  let bestKey = null;
  let bestLen = -1;
  for (const item of MODULE_PATH_PREFIXES) {
    for (const prefix of item.prefixes || []) {
      if (String(pathname).startsWith(prefix) && prefix.length > bestLen) {
        bestKey = item.key;
        bestLen = prefix.length;
      }
    }
  }
  return bestKey;
};

export const buildModuleAccessMap = (moduleAccess = []) => {
  const map = new Map();
  for (const row of moduleAccess || []) {
    map.set(String(row.module_key || "").toLowerCase(), Boolean(row.is_enabled));
  }
  return map;
};

export const isPathEnabledForUser = ({ pathname, moduleAccess }) => {
  const key = resolveModuleKeyForPath(pathname);
  if (!key) return true;
  const map = buildModuleAccessMap(moduleAccess);
  if (!map.has(key)) return true;
  return map.get(key);
};

// ── Global status helpers ─────────────────────────────────────────────────────

export const buildGlobalStatusMap = (moduleGlobalStatus = []) => {
  const map = new Map();
  for (const row of moduleGlobalStatus || []) {
    map.set(String(row.module_key || '').toLowerCase(), {
      stage:        row.stage || 'production',
      in_whitelist: Boolean(row.in_whitelist),
    });
  }
  return map;
};

// Returns { stage, in_whitelist } for a path. stage defaults to 'production' if unknown.
export const getModuleStatusForPath = ({ pathname, moduleGlobalStatus }) => {
  const key = resolveModuleKeyForPath(pathname);
  if (!key) return { stage: 'production', in_whitelist: false };
  const map = buildGlobalStatusMap(moduleGlobalStatus);
  return map.get(key) || { stage: 'production', in_whitelist: false };
};

// Returns true if the user should see the "under construction" page
export const isModuleUnderConstruction = ({ pathname, moduleGlobalStatus, isTiAdmin = false }) => {
  if (isTiAdmin) return false; // TI always passes through
  const { stage, in_whitelist } = getModuleStatusForPath({ pathname, moduleGlobalStatus });
  if (stage === 'construction') return true;
  if (stage === 'testing' && !in_whitelist) return true;
  return false;
};
