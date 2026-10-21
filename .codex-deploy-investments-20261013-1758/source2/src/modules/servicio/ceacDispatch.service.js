const db = require("../../config/db");
const notificationManager = require("../notifications/notificationManager");
const notificationsService = require("../notifications/notifications.service");

// jefe_tecnico/servicio_tecnico/tecnico/ingeniero/especialista_aplicaciones son
// aliases legacy (ver ROLE_GROUPS en middlewares/roles.js) -- se mantienen para
// cuentas viejas, pero los roles vigentes (jefe_servicio/ing_servicio/esp_app)
// faltaban aca, bloqueando en silencio a tecnicos con el rol moderno aunque la
// ruta (correctiveWriteRoles en servicio.routes.js) ya los dejaba entrar.
const CEAC_ROLES = Object.freeze([
  "ceac",
  "ti",
  "jefe_ti",
  "admin_ti",
  "servicio_tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "jefe_servicio",
]);

const DISPATCH_ROLES = Object.freeze([
  "dispatcher",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "jefe_servicio",
  "servicio_tecnico",
]);

const COMMERCIAL_ROLES = Object.freeze([
  "comercial",
  "jefe_comercial",
  "backoffice_comercial",
  "acp_comercial",
]);

const TECH_SPECIALIST_ROLES = Object.freeze([
  "servicio_tecnico",
  "tecnico",
  "ing_servicio",
  "esp_app",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "jefe_servicio",
  "ingeniero",
  "especialista_aplicaciones",
]);

const normalize = (value) => String(value || "").trim().toLowerCase();

const normalizeRoleList = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalize).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map(normalize)
    .filter(Boolean);
};

const getUserRoleSet = (user = {}) =>
  new Set([
    ...normalizeRoleList(user.role),
    ...normalizeRoleList(user.scope),
    ...normalizeRoleList(user.role_name),
    ...normalizeRoleList(user.roles),
    ...normalizeRoleList(user.scopes),
  ]);

const hasAnyRole = (user, roles = []) => {
  const roleSet = getUserRoleSet(user);
  return roles.some((role) => roleSet.has(normalize(role)));
};

const isCeacUser = (user) => hasAnyRole(user, CEAC_ROLES);
const isDispatcherUser = (user) => hasAnyRole(user, DISPATCH_ROLES);
const isCommercialUser = (user) => hasAnyRole(user, COMMERCIAL_ROLES);
const isTechSpecialistUser = (user) => hasAnyRole(user, TECH_SPECIALIST_ROLES);

const assertCeacEntryPermission = ({ actorUser, ceacExceptionAuthorized = false, ceacExceptionReason = null }) => {
  if (isCeacUser(actorUser)) return;
  if (ceacExceptionAuthorized && String(ceacExceptionReason || "").trim().length >= 8) return;

  const error = new Error("El ingreso correctivo debe pasar por CEAC o registrar excepción formal autorizada");
  error.status = 403;
  error.code = "CORRECTIVE_CASE_CEAC_ENTRY_REQUIRED";
  throw error;
};

const assertRoleForAction = ({ action, actorUser }) => {
  const normalizedAction = normalize(action);
  const roleChecks = {
    create: () => isCeacUser(actorUser),
    ceac_diagnosis: () => isCeacUser(actorUser),
    resolve_remote: () => isCeacUser(actorUser),
    escalate_dispatch: () => isCeacUser(actorUser) || isDispatcherUser(actorUser),
    classify_case: () => isDispatcherUser(actorUser) || isCeacUser(actorUser),
    register_dispatch_milestone: () => isDispatcherUser(actorUser) || isTechSpecialistUser(actorUser),
    request_commercial_quote: () => isTechSpecialistUser(actorUser) || isDispatcherUser(actorUser),
    issue_commercial_quote: () => isCommercialUser(actorUser),
    record_client_quote_decision: () => isCommercialUser(actorUser) || isCeacUser(actorUser),
    register_spare_part_requirement: () => isTechSpecialistUser(actorUser) || isDispatcherUser(actorUser),
    schedule_revisit: () => isDispatcherUser(actorUser) || isTechSpecialistUser(actorUser),
    record_part_replacement: () => isTechSpecialistUser(actorUser),
    link_disinfection_fst02: () => isTechSpecialistUser(actorUser) || isDispatcherUser(actorUser),
    close_case: () => isCeacUser(actorUser) || isDispatcherUser(actorUser) || isTechSpecialistUser(actorUser),
    cancel_case: () => isCeacUser(actorUser) || isDispatcherUser(actorUser),
    add_evidence: () => isCeacUser(actorUser) || isDispatcherUser(actorUser) || isTechSpecialistUser(actorUser),
  };

  const check = roleChecks[normalizedAction];
  if (!check) return;
  if (check()) return;

  const error = new Error(`No autorizado para la acción ${normalizedAction}`);
  error.status = 403;
  error.code = "CORRECTIVE_CASE_ACTION_FORBIDDEN";
  throw error;
};

const SLA_MATRIX = Object.freeze({
  A: {
    critica: { responseHours: 0.5, resolutionHours: 8 },
    alta: { responseHours: 2, resolutionHours: 16 },
    media: { responseHours: 4, resolutionHours: 24 },
    baja: { responseHours: 8, resolutionHours: 48 },
  },
  B: {
    critica: { responseHours: 1, resolutionHours: 12 },
    alta: { responseHours: 4, resolutionHours: 24 },
    media: { responseHours: 8, resolutionHours: 48 },
    baja: { responseHours: 24, resolutionHours: 96 },
  },
  C: {
    critica: { responseHours: 2, resolutionHours: 24 },
    alta: { responseHours: 8, resolutionHours: 48 },
    media: { responseHours: 24, resolutionHours: 120 },
    baja: { responseHours: 48, resolutionHours: 168 },
  },
});

const normalizeClientSegment = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (["A", "B", "C"].includes(normalized)) return normalized;
  return "C";
};

const normalizePriority = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["critica", "alta", "media", "baja"].includes(normalized)) return normalized;
  return "media";
};

const buildSlaDeadlines = ({ clientSegment = "C", priority = "media" } = {}) => {
  const segment = normalizeClientSegment(clientSegment);
  const normalizedPriority = normalizePriority(priority);
  const matrix = SLA_MATRIX[segment] || SLA_MATRIX.C;
  const cfg = matrix[normalizedPriority] || matrix.media;
  return {
    client_segment: segment,
    priority: normalizedPriority,
    response_hours: cfg.responseHours,
    resolution_hours: cfg.resolutionHours,
  };
};

const getUsersByRoles = async (roles = []) => {
  const normalized = Array.from(new Set((roles || []).map(normalize).filter(Boolean)));
  if (!normalized.length) return [];
  const { rows } = await db.query(
    `
      SELECT id, email, fullname, role
      FROM users
      WHERE LOWER(COALESCE(role, '')) = ANY($1)
      ORDER BY id ASC
    `,
    [normalized],
  );
  return rows || [];
};

const notifyUsers = async ({ users = [], title, message, source, priority = 1, meta = {} }) => {
  const userIds = Array.from(new Set((users || []).map((row) => Number(row?.id)).filter(Boolean)));
  if (!userIds.length) return;
  await Promise.all(
    userIds.map(async (userId) => {
      try {
        await notificationManager.sendNotification({
          userId,
          customTitle: title,
          customMessage: message,
          type: "task",
          source,
          priority,
          meta,
          email: true,
          chat: false,
        });
      } catch (_error) {
        await notificationsService.createNotification({
          user_id: userId,
          title,
          message,
          type: "task",
          source,
          priority,
          meta,
        });
      }
    }),
  );
};

module.exports = {
  CEAC_ROLES,
  DISPATCH_ROLES,
  COMMERCIAL_ROLES,
  TECH_SPECIALIST_ROLES,
  normalizeRoleList,
  getUserRoleSet,
  hasAnyRole,
  isCeacUser,
  isDispatcherUser,
  isCommercialUser,
  isTechSpecialistUser,
  assertCeacEntryPermission,
  assertRoleForAction,
  normalizeClientSegment,
  normalizePriority,
  buildSlaDeadlines,
  getUsersByRoles,
  notifyUsers,
};
