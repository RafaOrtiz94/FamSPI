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
  tecnico: [
    "tecnico",
    "servicio_tecnico",
    "jefe_servicio_tecnico",
    "jefe_de_servicio_tecnico",
    "jefe_tecnico",
    "jefe_de_tecnico",
  ],
  servicio_tecnico: [
    "servicio_tecnico",
    "tecnico",
    "jefe_servicio_tecnico",
    "jefe_de_servicio_tecnico",
    "jefe_tecnico",
    "jefe_de_tecnico",
  ],
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
  finanzas: ["finanzas", "jefe_finanzas", "jefe_de_finanzas", "contador", "jefe_financiero"],
  jefe_comercial: ["jefe_comercial", "jefe_de_comercial"],
  jefe_servicio_tecnico: ["jefe_servicio_tecnico", "jefe_de_servicio_tecnico"],
  jefe_tecnico: ["jefe_tecnico", "jefe_de_tecnico"],
  jefe_operaciones: ["jefe_operaciones", "jefe_de_operaciones"],
  jefe_calidad: ["jefe_calidad", "jefe_de_calidad"],
  jefe_ti: ["jefe_ti", "jefe_de_ti"],
  jefe_talento_humano: ["jefe_talento_humano", "jefe_de_talento_humano"],
  jefe_finanzas: ["jefe_finanzas", "jefe_de_finanzas"],
  backoffice_comercial: ["backoffice_comercial"],
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
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "No autenticado." });
    }

    const candidates = collectUserRoles(req.user);
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
