// Fuente unica de roles para CRM-Fam. Antes existian dos listas separadas
// (MANAGER_ROLES en crm.service.js y managerRoles+adminRoles en
// crm.routes.js) que hoy coinciden en contenido pero viven duplicadas --
// agregar un rol manager nuevo en un solo lugar dejaba el otro
// desincronizado (la ruta deja pasar pero el servicio sigue ocultando datos,
// o viceversa). Ver skill modulo-crm-fam, gotcha #4.

// Roles operativos del equipo comercial (sin permisos de manager).
const CRM_ROLES = [
  'comercial', 'jefe_comercial', 'backoffice_comercial',
  'asesor_comercial', 'analista_comercial', 'acp_comercial', 'backoffice',
];

// Roles con visibilidad/permiso de manager dentro del modulo (ven cuentas
// private/team ajenas, aprueban Blue Sheets, acceden a forecast/reportes).
// jefe_comercial aparece aqui Y en CRM_ROLES a proposito: es operativo pero
// tambien tiene visibilidad de manager.
const MANAGER_ROLES = [
  'jefe_comercial', 'gerencia', 'gerencia_general', 'gerente_general', 'director', 'gerente',
];

// Roles de administracion de plataforma (acceso total, incluye configuracion
// del modulo en CrmSettingsPage).
const ADMIN_ROLES = ['jefe_ti', 'jefe_de_ti', 'admin', 'administrador'];

// Todos los roles que pueden ver el modulo (lectura minima).
const ALL_CRM_ROLES = [...new Set([...CRM_ROLES, ...MANAGER_ROLES, ...ADMIN_ROLES])];

// Roles con permiso de manager "de negocio" O de plataforma -- usado para
// forecast, blue-sheet-kpis, reportes de gerencia.
const MANAGER_OR_ADMIN_ROLES = [...new Set([...MANAGER_ROLES, ...ADMIN_ROLES])];

// Fases del embudo en las que la venta ya esta cerrada con el cliente aunque la oportunidad siga
// abierta: contrato, entrega del equipo y control de consumibles. Cuentan como "vendido".
const SOLD_STAGE_NAMES = ['Contratos', 'Entrega e instalación', 'Control de consumibles'];
const SOLD_STAGES_SQL = `(${SOLD_STAGE_NAMES.map((name) => `'${name}'`).join(', ')})`;

module.exports = {
  SOLD_STAGE_NAMES,
  SOLD_STAGES_SQL,
  CRM_ROLES,
  MANAGER_ROLES,
  ADMIN_ROLES,
  ALL_CRM_ROLES,
  MANAGER_OR_ADMIN_ROLES,
};
