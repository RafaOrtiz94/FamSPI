/**
 * Registro explicito "ruta API -> modulo" (plan RBAC, Fase 2).
 *
 * Declara a que modulos del catalogo pertenece cada prefijo de la API, para dejar de depender del
 * encabezado x-app-path. Lista vacia = transversal (no depende de ningun modulo). Con varios
 * modulos basta con tener habilitado uno. Un prefijo ausente esta sin declarar.
 *
 * Por ahora solo lo lee el modo sombra (moduleShadow.js): no autoriza ni deniega nada.
 * Cada entrada sale de las llamadas observadas en el ambiente local y requiere aprobacion del
 * responsable del modulo antes de usarse para decidir.
 */
// Observado el 2026-10-07 recorriendo el menu de los 17 roles en el ambiente local (solo cargas de
// pagina). Parcial y pendiente de aprobacion funcional; lo no listado sigue "sin declarar".
const API_MODULE_REGISTRY = Object.freeze({
  // Transversales: se llaman desde cualquier pantalla (widgets globales de la aplicacion).
  "/api/v1/attendance": [],
  "/api/v1/audit-prep": [],
  "/api/v1/clients": [],
  "/api/v1/notifications": [],
  "/api/v1/signature-workflows": [],

  "/api/v1/auditoria": ["auditoria"],
  "/api/v1/business-case": ["business_case", "comercial", "finanzas", "inicio", "operaciones", "servicio_solicitudes", "workspace_compras"],
  "/api/v1/collab-deliveries": ["collab_entregas", "collab_resumen"],
  "/api/v1/collaborators": ["talento_colaboradores", "talento_humano"],
  "/api/v1/consumable-files": ["workspace_compras"],
  "/api/v1/crm-fam": ["crm_fam"],
  "/api/v1/dashboard": ["comercial"],
  "/api/v1/delivery-ceilings": ["comercial_maximos_saldos"],
  "/api/v1/departments": ["talento_gestion", "ti"],
  "/api/v1/equipment-management": ["servicio_equipos"],
  "/api/v1/equipment-purchases": ["comercial_solicitudes", "servicio_solicitudes", "workspace_compras"],
  "/api/v1/famsheets": ["comercial"],
  "/api/v1/hiring-pipeline": ["talento_pruebas_tecnicas"],
  "/api/v1/mantenimientos": ["inicio", "operaciones", "servicio_mantenimientos"],
  "/api/v1/permisos": ["finanzas", "inicio", "operaciones", "talento_permisos", "ti"],
  "/api/v1/personnel-requests": ["talento_colaboradores"],
  "/api/v1/private-purchases": ["logistica", "servicio_solicitudes", "workspace_compras"],
  "/api/v1/process-notes": ["workspace_compras"],
  "/api/v1/requests": ["inicio", "operaciones", "servicio_solicitudes"],
  "/api/v1/schedules": ["comercial_aprobacion_planes"],
  "/api/v1/servicio": ["inicio", "servicio_cronograma", "servicio_disponibilidad", "servicio_mantenimientos"],
  "/api/v1/support-tickets": ["ti_workspace"],
  "/api/v1/technical-applications": ["servicio_aplicaciones"],
  "/api/v1/ti-assets": ["ti_dispositivos"],
  "/api/v1/trainings": ["capacitaciones"],
  "/api/v1/users": ["collab_entregas", "operaciones", "servicio_solicitudes", "talento_gestion", "ti", "ti_dispositivos", "ti_modulos"],
  "/api/v1/vacaciones": ["talento_permisos"],
  "/api/v1/viaticos": ["finanzas_viaticos"],
  "/api/v1/work-management": ["work_management"],
});

// Prefijo estable de una ruta, sin identificadores: /api/v1/<modulo>, /internal/<x>, /api/<x>, /asistencia.
function apiPrefixOf(path) {
  const parts = String(path || "").split("?")[0].split("/").filter(Boolean);
  const size = parts[0] === "api" && parts[1] === "v1" ? 3 : parts[0] === "asistencia" ? 1 : 2;
  return `/${parts.slice(0, size).join("/")}`;
}

// Devuelve los modulos declarados (gana el prefijo mas largo) o null si la ruta esta sin declarar.
function resolveDeclaredModules(path, registry = API_MODULE_REGISTRY) {
  const clean = String(path || "").split("?")[0];
  const prefixes = Object.keys(registry).sort((a, b) => b.length - a.length);
  const match = prefixes.find((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
  return match ? registry[match] : null;
}

module.exports = { API_MODULE_REGISTRY, apiPrefixOf, resolveDeclaredModules };
