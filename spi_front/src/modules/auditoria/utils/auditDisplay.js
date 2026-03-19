const RAW_UNKNOWN_USERS = new Set(["", "anon", "anonymous"]);
const RAW_UNKNOWN_MODULES = new Set(["", "core"]);
const RAW_UNKNOWN_ACTIONS = new Set(["", "desconocida"]);

const MODULE_LABELS = {
  users: "Usuarios",
  departments: "Departamentos",
  personnel_requests: "Gestion de Talento Humano",
  collaborators: "Colaboradores",
  user_profile: "Perfil de usuario",
  attendance: "Asistencia",
  permisos: "Permisos",
  vacaciones: "Vacaciones",
  audit_prep: "Preparacion de auditoria",
  auditoria: "Auditoria",
};

const ACTION_LABELS = {
  create: "Creacion",
  update: "Actualizacion",
  deactivate: "Desactivacion",
  update_status: "Cambio de estado",
  add_comment: "Comentario",
  assign_collaborator: "Asignacion de colaborador",
  hire: "Contratacion",
};

const humanizeIdentifier = (value) =>
  String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const getAuditActorLabel = (item = {}) => {
  const rawEmail = String(item.usuario_email || item.email || "").trim();
  if (!RAW_UNKNOWN_USERS.has(rawEmail.toLowerCase())) return rawEmail;
  if (item.usuario_id) return `Usuario #${item.usuario_id} (sin normalizar)`;
  return "Actor no resuelto";
};

export const getAuditModuleLabel = (item = {}) => {
  const rawModule = String(item.modulo || item.module || "").trim().toLowerCase();
  if (RAW_UNKNOWN_MODULES.has(rawModule)) return "Modulo sin normalizar";
  return MODULE_LABELS[rawModule] || humanizeIdentifier(rawModule);
};

export const getAuditActionLabel = (item = {}) => {
  const rawAction = String(item.accion || item.action || "").trim().toLowerCase();
  if (RAW_UNKNOWN_ACTIONS.has(rawAction)) return "Accion sin normalizar";
  return ACTION_LABELS[rawAction] || humanizeIdentifier(rawAction);
};
