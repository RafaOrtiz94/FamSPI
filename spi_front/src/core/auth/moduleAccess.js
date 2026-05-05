export const MODULE_PATH_PREFIXES = [
  { key: "ti_workspace", prefixes: ["/dashboard/ti/workspace"] },
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
  { key: "comercial_clientes", prefixes: ["/dashboard/comercial/clientes"] },
  { key: "comercial_planificacion", prefixes: ["/dashboard/comercial/planificacion"] },
  { key: "comercial_aprobacion_planes", prefixes: ["/dashboard/comercial/aprobaciones-planificacion"] },
  { key: "comercial_compras_publicas", prefixes: ["/dashboard/comercial/equipment-purchases"] },
  { key: "comercial_maximos_saldos", prefixes: ["/dashboard/comercial/delivery-ceilings"] },
  { key: "business_case", prefixes: ["/dashboard/business-case"] },
  { key: "workspace_compras", prefixes: ["/dashboard/purchases/workspace"] },
  { key: "servicio_workspace", prefixes: ["/dashboard/servicio-tecnico/workspace-procedimiento"] },
  { key: "servicio_mantenimientos", prefixes: ["/dashboard/servicio-tecnico/mantenimientos"] },
  { key: "servicio_solicitudes", prefixes: ["/dashboard/servicio-tecnico/solicitudes"] },
  { key: "servicio_disponibilidad", prefixes: ["/dashboard/servicio-tecnico/disponibilidad"] },
  { key: "servicio_capacitaciones", prefixes: ["/dashboard/servicio-tecnico/capacitaciones"] },
  { key: "servicio_equipos", prefixes: ["/dashboard/servicio-tecnico/equipos"] },
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
