/**
 * Middleware requireRole
 * ----------------------
 * - Verifica si el rol del usuario está en la lista permitida
 * - Ejemplo: requireRole(['admin','gerencia'])
 */

const ROLE_GROUPS = {
  comercial: ["comercial", "jefe_comercial", "backoffice_comercial"],
  tecnico: ["tecnico", "servicio_tecnico", "jefe_servicio_tecnico", "jefe_tecnico"],
  servicio_tecnico: ["servicio_tecnico", "tecnico", "jefe_servicio_tecnico", "jefe_tecnico"],
  gerencia: ["gerencia", "gerente_general", "director"],
  operaciones: ["operaciones", "jefe_operaciones"],
  calidad: ["calidad", "jefe_calidad"],
  ti: ["ti", "jefe_ti"],
  admin: ["admin", "administrador"],
  talento_humano: ["talento_humano", "jefe_talento_humano"],
  finanzas: ["finanzas", "jefe_finanzas"],
  jefe_comercial: ["jefe_comercial"],
  jefe_servicio_tecnico: ["jefe_servicio_tecnico"],
  jefe_tecnico: ["jefe_tecnico"],
  jefe_operaciones: ["jefe_operaciones"],
  jefe_calidad: ["jefe_calidad"],
  jefe_ti: ["jefe_ti"],
  jefe_talento_humano: ["jefe_talento_humano"],
  jefe_finanzas: ["jefe_finanzas"],
  backoffice_comercial: ["backoffice_comercial"],
};

const SUPER_ROLES = new Set(["admin", "administrador"]);

const normalizeRoleName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

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

    const role = normalizeRoleName(req.user.role);
    if (role && SUPER_ROLES.has(role)) {
      return next();
    }
    if (!role || !expanded.has(role)) {
      return res.status(403).json({
        ok: false,
        error: `Acceso denegado. Roles permitidos: ${Array.from(expanded).join(", ")}`,
      });
    }

    next();
  };
}

module.exports = { requireRole, ROLE_GROUPS };
