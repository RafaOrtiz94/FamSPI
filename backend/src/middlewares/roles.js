/**
 * Middleware requireRole
 * ----------------------
 * - Verifica si el rol del usuario está en la lista permitida
 * - Ejemplo: requireRole(['admin','gerencia'])
 */

const ROLE_GROUPS = {
  comercial: [
    "comercial",
    "jefe_comercial",
    "jefe_de_comercial",
    "backoffice_comercial",
    "asesor_comercial",
    "analista_comercial",
    "acp_comercial",
    "backoffice",
  ],
  // Familia técnica interna — incluye roles nuevos y aliases legacy
  tecnico: [
    "tecnico",          // legacy → migrado a ing_servicio
    "ing_servicio",
    "esp_app",
    "servicio_tecnico",
    "responsable_tecnico",
    "jefe_servicio_tecnico",
    "jefe_de_servicio_tecnico",
    "jefe_tecnico",     // legacy → migrado a jefe_serSvicio
    "jefe_servicio",
    "jefe_de_tecnico",
  ],
  servicio_tecnico: [
    "servicio_tecnico",
    "tecnico",
    "ing_servicio",
    "esp_app",
    "responsable_tecnico",
    "jefe_servicio_tecnico",
    "jefe_de_servicio_tecnico",
    "jefe_tecnico",
    "jefe_servicio",
    "jefe_de_tecnico",
  ],
  // Grupos individuales — roles internos nuevos
  ing_servicio: ["ing_servicio", "tecnico"],
  jefe_servicio: ["jefe_servicio", "jefe_tecnico", "jefe_de_tecnico", "jefe_servicio_tecnico", "jefe_de_servicio_tecnico"],
  esp_app: ["esp_app"],
  // Roles externos — acceso limitado: FamSign, Capacitaciones, Permisos, Vacaciones
  ing_servicio_ext: ["ing_servicio_ext"],
  esp_app_ext: ["esp_app_ext"],
  ext_users: ["ing_servicio_ext", "esp_app_ext"],
  gerencia: ["gerencia", "gerencia_general", "gerente_general", "director", "gerente"],
  operaciones: [
    "operaciones",
    "jefe_operaciones",
    "jefe_de_operaciones",
    "analista_operaciones",
  ],
  calidad: ["calidad", "jefe_calidad"],
  ti: ["ti", "jefe_ti", "jefe_de_ti", "desarrollador", "soporte"],
  admin: ["admin", "administrador"],
  talento_humano: [
    "talento_humano",
    "jefe_talento_humano",
    "jefe_de_talento_humano",
    "analista_talento_humano",
    "asistente_talento_humano",
    "auxiliar_talento_humano",
    "rh",
    "rrhh",
  ],
  finanzas: ["finanzas", "financiero", "jefe_finanzas", "jefe_de_finanzas", "contador", "jefe_financiero"],
  jefe_comercial: ["jefe_comercial", "jefe_de_comercial"],
  jefe_servicio_tecnico: ["jefe_servicio_tecnico", "jefe_de_servicio_tecnico"],
  jefe_tecnico: ["jefe_tecnico", "jefe_de_tecnico", "jefe_servicio", "jefe_servicio_tecnico", "jefe_de_servicio_tecnico"],
  jefe_operaciones: ["jefe_operaciones", "jefe_de_operaciones"],
  jefe_calidad: ["jefe_calidad", "jefe_de_calidad"],
  jefe_ti: ["jefe_ti", "jefe_de_ti"],
  jefe_talento_humano: ["jefe_talento_humano", "jefe_de_talento_humano"],
  jefe_finanzas: ["jefe_finanzas", "jefe_de_finanzas"],
  backoffice_comercial: ["backoffice_comercial"],
  // Pasantes: login por credenciales propias (sin OAuth), sin heredar
  // permisos de ningun area por default -- todo se asigna explicitamente via
  // user_module_access (ver docs/plans/pasantes-access-plan.md).
  pasante: ["pasante"],
};

const SUPER_ROLES = new Set(["admin", "administrador"]);

const normalizeRoleName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const collectUserRoles = (user = {}) => {
  const roles = new Set();
  const pushRole = (value) => {
    const normalized = normalizeRoleName(value);
    if (normalized) roles.add(normalized);
  };

  pushRole(user.role);
  pushRole(user.scope);
  pushRole(user.role_name);

  if (Array.isArray(user.roles)) {
    user.roles.forEach(pushRole);
  }

  if (Array.isArray(user.scopes)) {
    user.scopes.forEach(pushRole);
  }

  // Capacidades adicionales otorgadas a un usuario puntual sin cambiar su rol
  // principal (ver migrations/276_users_extra_roles.sql). Se propaga en el
  // JWT (signAccess) para que este chequeo, que solo lee el token, las vea.
  if (Array.isArray(user.extra_roles)) {
    user.extra_roles.forEach(pushRole);
  }

  return roles;
};

function expandRoles(allowed = []) {
  const expanded = new Set();
  allowed.forEach((role) => {
    const key = normalizeRoleName(role);
    if (ROLE_GROUPS[key]) {
      ROLE_GROUPS[key].forEach((r) => expanded.add(r));
    } else if (key) {
      expanded.add(key);
    }
  });
  return expanded;
}

function requireRole(allowedRoles = []) {
  const expanded = expandRoles(allowedRoles);
  const allowsPasante = expanded.has("pasante");
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "No autenticado." });
    }

    const candidates = collectUserRoles(req.user);

    // Pasantes no tienen un set de roles fijo por endpoint: su acceso real
    // se decide por user_module_access via moduleAccessGuard (corre antes,
    // en app.js). Si ese middleware ya marco el request como verificado
    // (modulo resuelto y habilitado para este usuario), no lo volvemos a
    // filtrar por rol aqui. Rutas fuera del catalogo de modulos (ej. las de
    // BYPASS_PREFIXES como auth o el propio module-access) nunca reciben
    // ese flag, asi que siguen exigiendo el rol exacto de allowedRoles.
    if (!allowsPasante && candidates.has("pasante") && req._moduleAccessVerified) {
      return next();
    }

    for (const role of candidates) {
      if (SUPER_ROLES.has(role)) {
        return next();
      }
      if (expanded.has(role)) {
        return next();
      }
    }

    if (candidates.size === 0) {
      return res.status(403).json({
        ok: false,
        error: `Acceso denegado. Roles permitidos: ${Array.from(expanded).join(", ")}`,
      });
    }

    return res.status(403).json({
      ok: false,
      error: `Acceso denegado. Roles permitidos: ${Array.from(expanded).join(", ")}`,
    });
  };
}

module.exports = { requireRole, ROLE_GROUPS };
