/**
 * Grupos de roles para el módulo de compras (público + privado).
 * Espejo parcial de ROLE_GROUPS en backend/src/middlewares/roles.js —
 * mantener sincronizado si se agregan/renombran roles ahí.
 *
 * Antes de este módulo, cada componente de compras armaba su propio array
 * de roles a mano ('jefe_tecnico', 'jefe_servicio_tecnico', ...), y cada vez
 * que se agregaba un alias de rol (ej. jefe_servicio) había que actualizar
 * ~15 archivos por separado. Usar hasRole(...) contra estos grupos evita
 * que ese bug se repita.
 */
export const PURCHASE_ROLE_GROUPS = {
  // Grupo amplio: cualquiera del lado comercial (usado para visibilidad de tabs).
  comercial: [
    'comercial', 'asesor_comercial', 'analista_comercial',
    'backoffice', 'backoffice_comercial',
    'acp_comercial',
    'jefe_comercial', 'jefe_de_comercial',
  ],
  // Sub-grupos finos: para permisos donde asesor/backoffice/ACP son distintos entre sí.
  comercial_advisor: ['comercial', 'asesor_comercial', 'analista_comercial'],
  backoffice: ['backoffice', 'backoffice_comercial'],
  acp_comercial: ['acp_comercial'],
  jefe_comercial: ['jefe_comercial', 'jefe_de_comercial'],
  tecnico: [
    'tecnico', 'ing_servicio', 'esp_app', 'servicio_tecnico',
    'jefe_tecnico', 'jefe_de_tecnico',
    'jefe_servicio', 'jefe_servicio_tecnico', 'jefe_de_servicio_tecnico',
  ],
  jefe_tecnico: ['jefe_tecnico', 'jefe_de_tecnico', 'jefe_servicio', 'jefe_servicio_tecnico', 'jefe_de_servicio_tecnico'],
  logistica: ['logistica', 'jefe_logistica'],
  operaciones: ['operaciones', 'jefe_operaciones', 'jefe_de_operaciones', 'analista_operaciones'],
  gerencia: ['gerencia', 'gerencia_general', 'gerente_general', 'director', 'gerente'],
  admin: ['admin', 'administrador'],
};

export const normalizeRoles = (user) => {
  if (!user) return [];
  const rawRoles = user?.roles ?? user?.role ?? user?.user?.roles ?? user?.user?.role ?? [];
  const rawScopes = user?.scope ?? user?.user?.scope ?? [];
  return [...(Array.isArray(rawRoles) ? rawRoles : [rawRoles]), ...(Array.isArray(rawScopes) ? rawScopes : [rawScopes])]
    .flatMap((role) => {
      if (typeof role === 'object' && role !== null) return String(role.name || role.role || role.code || role.slug || '');
      return String(role || '').split(/[,\s]+/);
    })
    .map((role) => role.toLowerCase().trim())
    .filter(Boolean);
};

/**
 * hasRole(userRoles, 'tecnico') -- 'tecnico' se expande al grupo completo
 * (tecnico, ing_servicio, jefe_servicio, jefe_servicio_tecnico, ...).
 * hasRole(userRoles, 'jefe_ti') -- token sin grupo, se usa tal cual.
 * Match por substring (igual al patrón ya usado en todo el módulo), así
 * 'jefe_servicio_tecnico' matchea el token 'jefe_servicio' y viceversa.
 */
export const hasRole = (userRoles = [], groupOrToken) => {
  const tokens = PURCHASE_ROLE_GROUPS[groupOrToken] || [groupOrToken];
  return userRoles.some((role) => tokens.some((t) => role === t || role.includes(t) || t.includes(role)));
};

export const hasAnyRole = (userRoles = [], groupsOrTokens = []) =>
  groupsOrTokens.some((g) => hasRole(userRoles, g));

export const isManager = (userRoles = []) => hasAnyRole(userRoles, ['gerencia', 'jefe_comercial', 'admin']);
export const isComercial = (userRoles = []) => hasRole(userRoles, 'comercial');
export const isComercialAdvisor = (userRoles = []) => hasRole(userRoles, 'comercial_advisor');
export const isBackoffice = (userRoles = []) => hasRole(userRoles, 'backoffice');
export const isAcp = (userRoles = []) => hasRole(userRoles, 'acp_comercial');
export const isTechnical = (userRoles = []) => hasRole(userRoles, 'tecnico');
export const isChiefTechnical = (userRoles = []) => hasRole(userRoles, 'jefe_tecnico');
export const isLogistics = (userRoles = []) => hasAnyRole(userRoles, ['logistica', 'operaciones']);
