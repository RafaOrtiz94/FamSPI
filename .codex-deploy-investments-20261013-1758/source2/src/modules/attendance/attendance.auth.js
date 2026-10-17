const REPORTING_ROLES = new Set([
  "talento_humano",
  "jefe_talento_humano",
  "jefe_de_talento_humano",
  "analista_talento_humano",
  "asistente_talento_humano",
  "auxiliar_talento_humano",
  "rh",
  "rrhh",
  "finanzas",
  "financiero",
  "jefe_finanzas",
  "jefe_financiero",
  "gerencia",
  "gerencia_general",
  "gerente_general",
  "director",
  "admin",
  "administrador",
]);

const normalizeRoleName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const collectUserRoles = (user = {}) => {
  const roles = new Set();
  [user.role, user.scope, user.role_name, user.rol].forEach((value) => {
    const normalized = normalizeRoleName(value);
    if (normalized) roles.add(normalized);
  });
  if (Array.isArray(user.roles)) user.roles.forEach((role) => roles.add(normalizeRoleName(role)));
  if (Array.isArray(user.scopes)) user.scopes.forEach((scope) => roles.add(normalizeRoleName(scope)));
  return roles;
};

const hasReportingAccess = (user = {}) => {
  const roles = collectUserRoles(user);
  for (const role of roles) {
    if (REPORTING_ROLES.has(role)) return true;
  }
  return false;
};

const hasGlobalAttendanceReportingAccess = (user = {}) => hasReportingAccess(user);

const parseTargetUserId = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized || normalized === "me") return null;
  if (normalized === "all") return Number.NaN;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
};

const canAccessAttendanceTarget = (requester, rawTargetUserId, { allowAll = false } = {}) => {
  const requesterId = Number(requester?.id || 0);
  if (!requesterId) return false;

  const targetUserId = parseTargetUserId(rawTargetUserId);
  if (targetUserId === null) return true;
  const hasGlobalAccess = hasGlobalAttendanceReportingAccess(requester);
  if (Number.isNaN(targetUserId)) return allowAll && hasGlobalAccess;
  if (targetUserId === requesterId) return true;
  return hasGlobalAccess;
};

const requireAttendanceReportAccess = (targetSelector, options = {}) => (req, res, next) => {
  const rawTargetUserId =
    typeof targetSelector === "function"
      ? targetSelector(req)
      : targetSelector === "param"
        ? req.params?.userId
        : req.query?.userId;

  if (canAccessAttendanceTarget(req.user, rawTargetUserId, options)) {
    return next();
  }

  return res.status(403).json({
    ok: false,
    code: "ATTENDANCE_REPORTS_FORBIDDEN",
    message: "No tienes permisos para consultar registros de asistencia de otros usuarios",
  });
};

module.exports = {
  REPORTING_ROLES,
  hasReportingAccess,
  hasGlobalAttendanceReportingAccess,
  canAccessAttendanceTarget,
  requireAttendanceReportAccess,
};
