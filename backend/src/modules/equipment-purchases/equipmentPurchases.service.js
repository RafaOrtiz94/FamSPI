const db = require("../../config/db");
const logger = require("../../config/logger");
const { v4: uuidv4 } = require("uuid");
const PDFDocument = require("pdfkit");
const { ensureFolder, uploadBase64File, copyTemplate, replaceTags } = require("../../utils/drive");
const { createAllDayEvent } = require("../../utils/calendar");
const { sendMail } = require("../../utils/mailer");
const { renderProviderEmail } = require("../../utils/emailTemplate");
const inventarioService = require("../inventario/inventario.service");
const notificationManager = require("../notifications/notificationManager");
const { trackFst07WorkflowDocument } = require("../servicio/fst07.service");
const { trackFst14WorkflowDocument } = require("../servicio/fst14.service");
const { generateFst14PdfBuffer, buildFst14FileName } = require("../servicio/fst14Pdf.service");
const {
  normalizeInstallationWorkflowState,
  buildDispatchRequestPatch,
  buildLogisticsValidationPatch,
  buildVisualReceptionPatch,
  buildVerificationDecisionPatch,
  buildVerificationRemediationPatch,
  appendVerificationAttempt,
  buildCuProviderReportPatch,
  computeInstallationClosureGate,
  enrichInstallationWorkflowWithGate,
  createInstallationWorkflowError,
} = require("../servicio/installationWorkflow.service");
const {
  createRequest: createServiceRequest,
  generateActa,
  addDriveAttachment,
  markRequestCompleted,
} = require("../requests/requests.service");

const DEFAULT_ROOT_ENV_KEYS = ["DRIVE_ROOT_FOLDER_ID", "DRIVE_FOLDER_ID"];
const ROOT_FOLDER_NAME = process.env.EQUIPMENT_PURCHASE_ROOT_FOLDER || "Solicitudes de compra de equipos";
const COMMERCIAL_FOLDER_NAME = "Comercial";
const PURCHASE_FOLDER_NAME = "Compras";
const CONTRACT_MAX_DAYS = 110;
const CONTRACT_REMINDER_DAYS_BEFORE = 15;
const RESERVATION_VALIDITY_DAYS       = 15; // Reserva vÃ¡lida por 15 dÃ­as
const RESERVATION_REMINDER_DAYS_BEFORE = 3;  // Recordatorio de Calendar 3 dÃ­as antes del vencimiento
const RESERVATION_REMINDER_OFFSET_DAYS = RESERVATION_VALIDITY_DAYS - RESERVATION_REMINDER_DAYS_BEFORE; // = 12
const CONTRACT_REMINDER_MINUTES_BEFORE = CONTRACT_REMINDER_DAYS_BEFORE * 24 * 60;
const PROFORMA_REQUEST_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 horas
const TECHNICAL_DAILY_CAPACITY = Number.parseInt(process.env.TECHNICAL_DAILY_CAPACITY || "3", 10);
const SITE_INSPECTION_STATUS = {
  PENDING: "pending",
  NON_COMPLIANT_REINSPECTION_PENDING: "non_compliant_reinspection_pending",
  READY_FOR_INSTALLATION: "ready_for_installation",
};

const FST07_CHECKLIST_QUESTIONS = [
  {
    key: "area_min_space",
    label: "El Ã¡rea cumple los requerimientos mÃ­nimos de espacio requeridos por el equipo",
    allows_na: false,
  },
  {
    key: "area_pressure_temperature",
    label: "El Ã¡rea cumple con las condiciones de presiÃ³n y temperatura requeridas por el equipo",
    allows_na: false,
  },
  {
    key: "area_humidity",
    label: "La humedad del ambiente es la mÃ¡xima permitida por el equipo",
    allows_na: false,
  },
  {
    key: "area_free_dust",
    label: "El Ã¡rea se encuentra libre de polvo y/o contaminaciÃ³n para el buen funcionamiento del equipo",
    allows_na: false,
  },
  {
    key: "electrical_dedicated_outlets",
    label: "El Ã¡rea posee tomas elÃ©ctricas dedicadas",
    allows_na: false,
  },
  {
    key: "electrical_polarized_outlets",
    label: "El Ã¡rea posee tomas elÃ©ctricas polarizadas",
    allows_na: false,
  },
  {
    key: "electrical_breakers",
    label: "Las tomas elÃ©ctricas estÃ¡n protegidas por brakers adecuados para la carga del equipo",
    allows_na: false,
  },
  {
    key: "electrical_power_capacity",
    label: "La conexiÃ³n elÃ©ctrica garantiza el consumo de potencia del equipo",
    allows_na: false,
  },
  {
    key: "electrical_ups",
    label: "Posee el Ã¡rea una toma protegida por un UPS central",
    allows_na: true,
  },
  {
    key: "electrical_grounding",
    label: "El Ã¡rea posee conexiÃ³n a tierra que garantice un voltaje menor a 1 V entre neutro tierra",
    allows_na: false,
  },
  {
    key: "water_intake",
    label: "El Ã¡rea tiene las tomas de agua requeridas",
    allows_na: true,
  },
  {
    key: "water_pressure",
    label: "La presiÃ³n de agua es adecuada (mÃ­n. 30 PSI)",
    allows_na: true,
  },
  {
    key: "water_drain",
    label: "El Ã¡rea tiene los desagÃ¼es necesarios",
    allows_na: true,
  },
  {
    key: "water_quality",
    label: "La calidad del agua es la adecuada",
    allows_na: true,
  },
  {
    key: "remote_network_points",
    label: "Tiene el laboratorio puntos de red en las cercanÃ­as de la ubicaciÃ³n del equipo",
    allows_na: false,
  },
  {
    key: "remote_internet",
    label: "Tiene el laboratorio conexiÃ³n a internet para acceso remoto",
    allows_na: false,
  },
];

let initialized = false;

const STATUS = {
  PENDING_PROVIDER:           "pending_provider_assignment",
  WAITING_PROVIDER:           "waiting_provider_response",
  NO_STOCK:                   "no_stock",
  WAITING_PROFORMA:           "waiting_proforma",
  PROFORMA_RECEIVED:          "proforma_received",
  WAITING_SIGNED_PROFORMA:    "waiting_signed_proforma",
  PENDING_CONTRACT:           "pending_contract",
  CONTRACT_AVAILABLE:         "contract_available",
  DELIVERY_DATES_REQUESTED:   "delivery_dates_requested",
  DELIVERY_DATES_SUBMITTED:   "delivery_dates_submitted",
  WAITING_DISPATCH:           "waiting_dispatch",
  DISPATCH_READY:             "dispatch_ready",
  COMPLETED:                  "completed",
  /* CU: equipo disponible solo en condiciÃ³n de uso â€” pendiente aprobaciÃ³n del comercial */
  WAITING_CLIENT_CU_APPROVAL:        "waiting_client_cu_approval",
  WAITING_ACP_IMPORT_CONFIRMATION:   "waiting_acp_import_confirmation",
};

const STATUS_STATS_ORDER = [
  STATUS.PENDING_PROVIDER,
  STATUS.WAITING_PROVIDER,
  STATUS.WAITING_PROFORMA,
  STATUS.PROFORMA_RECEIVED,
  STATUS.WAITING_SIGNED_PROFORMA,
  STATUS.PENDING_CONTRACT,
  STATUS.CONTRACT_AVAILABLE,
  STATUS.DELIVERY_DATES_REQUESTED,
  STATUS.DELIVERY_DATES_SUBMITTED,
  STATUS.WAITING_DISPATCH,
  STATUS.DISPATCH_READY,
  STATUS.COMPLETED,
];

// CP-02: jefe_de_comercial = same permissions as jefe_comercial â€” must canManageAll
// GAP-02: jefe_financiero y jefe_operaciones necesitan ver todos los expedientes (no solo los propios)
const MANAGER_ROLES = new Set(["acp_comercial", "gerencia", "gerencia_general", "jefe_comercial", "jefe_de_comercial", "jefe_financiero", "jefe_operaciones"]);
const ACTION_BY_STATUS = {
  [STATUS.PENDING_PROVIDER]:           "start_availability",
  [STATUS.WAITING_PROVIDER]:           "save_provider_response",
  [STATUS.WAITING_CLIENT_CU_APPROVAL]:      "confirm_cu_availability",
  [STATUS.WAITING_ACP_IMPORT_CONFIRMATION]: "confirm_acp_import_awareness",
  [STATUS.WAITING_PROFORMA]: "request_or_upload_proforma",
  [STATUS.PROFORMA_RECEIVED]: "reserve_equipment",
  [STATUS.WAITING_SIGNED_PROFORMA]: "submit_signed_with_inspection",
  [STATUS.PENDING_CONTRACT]: "upload_contract",
  [STATUS.CONTRACT_AVAILABLE]: "request_delivery_dates",
  [STATUS.DELIVERY_DATES_REQUESTED]: "submit_delivery_dates",
  [STATUS.DELIVERY_DATES_SUBMITTED]: "mark_equipment_arrived",
  [STATUS.WAITING_DISPATCH]: "mark_dispatch_ready",
  [STATUS.DISPATCH_READY]: "complete_delivery",
};
const CHECKLIST_ITEMS = {
  client_confirmed: {
    label: "Cliente validado",
    auto: true,
    validator: (request) => Boolean(request?.client_name),
  },
  equipment_confirmed: {
    label: "Equipos validados",
    auto: true,
    validator: (request) => Array.isArray(request?.equipment) && request.equipment.length > 0,
  },
  assignee_confirmed: {
    label: "ACP asignado",
    auto: true,
    validator: (request) => Boolean(request?.assigned_to),
  },
  provider_contact_verified: {
    label: "Correo/proveedor verificado",
    auto: true,
    validator: (request) => Boolean(request?.provider_email),
  },
  commercial_context_validated: {
    label: "Contexto comercial validado",
    auto: true,
    validator: (request) => Boolean(request?.notes) || Boolean(request?.client_name),
  },
  accepted_items_validated: {
    label: "Items aceptados validados",
    auto: true,
    validator: (request) => getAcceptedItems(request).length > 0,
  },
  proforma_terms_validated: {
    label: "TÃ©rminos de proforma validados",
    auto: true,
    validator: (request) => Boolean(request?.proforma_file_id || request?.proforma_uploaded_at),
  },
  inspection_date_coordinated: {
    label: "Fecha de inspecciÃ³n coordinada (comercial+tÃ©cnico)",
    auto: true,
    validator: (request) => Boolean(request?.inspection_min_date && request?.inspection_max_date),
  },
  technical_window_confirmed: {
    label: "Ventana tÃ©cnica confirmada",
    auto: true,
    validator: (request) => Boolean(request?.inspection_min_date && request?.inspection_max_date),
  },
  contract_ready_for_signature: {
    label: "Contrato listo para firma (fecha coordinada + acta F.ST-20)",
    auto: true,
    validator: (request) => Boolean(
      request?.signed_proforma_file_id &&
      request?.inspection_request_id &&
      request?.inspection_scheduled_date &&
      hasInspectionActa(request),
    ),
  },
  business_case_resolved_factible: {
    label: "Business Case resuelto como factible",
    auto: true,
    validator: (request) => Boolean(request?.auto_business_case_resolved_factible),
  },
  public_portal_awarded: {
    label: "Proceso ganado en portal de compras pÃºblicas",
    auto: true,
    validator: (request) =>
      String(request?.public_portal_outcome || request?.extra?.public_portal_outcome?.outcome || "")
        .toLowerCase() === "won",
  },
  signed_proforma_uploaded: {
    label: "Proforma firmada subida",
    auto: true,
    validator: (request) => Boolean(request?.signed_proforma_file_id),
  },
  client_registered: {
    label: "Cliente registrado",
    auto: true,
    validator: (request) => Boolean(request?.client_id),
  },
  inspection_date_confirmed: {
    label: "Fecha de inspecciÃ³n coordinada",
    auto: true,
    validator: (request) => Boolean(request?.inspection_scheduled_date),
  },
  inspection_requested: {
    label: "InspecciÃ³n de ambiente solicitada",
    auto: true,
    validator: (request) => Boolean(request?.inspection_request_id),
  },
  inspection_site_ready: {
    label: "InspecciÃ³n en sitio F.ST-07 completada",
    auto: true,
    validator: (request) =>
      Boolean(
        request?.inspection_site_ready_for_installation ||
          request?.extra?.inspection_site?.ready_for_installation,
      ),
  },
  inspection_site_report_uploaded: {
    label: "Acta F.ST-07 subida",
    auto: true,
    validator: (request) =>
      Boolean(
        request?.inspection_site_report_file_id ||
          request?.inspection_site_report_link ||
          request?.extra?.inspection_site?.report_file_id ||
          request?.extra?.inspection_site?.report_link,
      ),
  },
  equipment_arrived: {
    label: "Equipo arribado",
    auto: true,
    validator: (request) => Boolean(request?.equipment_arrived_at),
  },
  dispatch_ready_confirmed: {
    label: "Despacho marcado como listo",
    auto: true,
    validator: (request) => Boolean(request?.dispatch_ready_at),
  },
};
const ACTION_CHECKLIST_REQUIREMENTS = {
  start_availability: [
    "client_confirmed",
    "equipment_confirmed",
    "provider_contact_verified",
    "commercial_context_validated",
  ],
  request_or_upload_proforma: ["accepted_items_validated"],
  reserve_equipment: ["proforma_terms_validated"],
  submit_signed_with_inspection: ["proforma_terms_validated"],
  request_inspection: ["signed_proforma_uploaded"],
  upload_contract: [
    "business_case_resolved_factible",
    "public_portal_awarded",
    "client_registered",
    "inspection_requested",
  ],
  request_delivery_dates: [],
  submit_delivery_dates: [],
  mark_equipment_arrived: [],
  mark_dispatch_ready: ["equipment_arrived"],
  complete_delivery: ["dispatch_ready_confirmed", "inspection_site_report_uploaded"],
};
const ACTION_ALLOWED_STATUSES = {
  start_availability:       [STATUS.PENDING_PROVIDER],
  save_provider_response:   [STATUS.WAITING_PROVIDER],
  confirm_cu_availability:         [STATUS.WAITING_CLIENT_CU_APPROVAL],
  confirm_acp_import_awareness:    [STATUS.WAITING_ACP_IMPORT_CONFIRMATION],
  request_or_upload_proforma: [STATUS.WAITING_PROFORMA],
  reserve_equipment: [STATUS.PROFORMA_RECEIVED],
  submit_signed_with_inspection: [STATUS.WAITING_SIGNED_PROFORMA],
  request_inspection: [STATUS.WAITING_SIGNED_PROFORMA, STATUS.PENDING_CONTRACT],
  register_public_portal_outcome: [STATUS.PENDING_CONTRACT],
  coordinate_inspection_date: [STATUS.WAITING_SIGNED_PROFORMA, STATUS.PENDING_CONTRACT],
  upload_contract: [STATUS.PENDING_CONTRACT],
  request_delivery_dates: [STATUS.CONTRACT_AVAILABLE],
  submit_delivery_dates: [STATUS.DELIVERY_DATES_REQUESTED],
  mark_equipment_arrived: [STATUS.DELIVERY_DATES_SUBMITTED, STATUS.WAITING_DISPATCH],
  mark_dispatch_ready: [STATUS.WAITING_DISPATCH],
  complete_delivery: [STATUS.DISPATCH_READY],
};
const PURCHASE_PROCESS_TEMPLATE_ID =
  process.env.PURCHASE_PROCESS_TEMPLATE_ID || process.env.EQUIPMENT_PURCHASE_PROCESS_TEMPLATE_ID || null;
const CLIENT_DOCUMENT_FIELDS = [
  { key: "id_file_id", label: "Documento de identificaciÃ³n del cliente" },
  { key: "ruc_file_id", label: "RUC" },
  { key: "legal_rep_appointment_file_id", label: "Nombramiento representante legal" },
  { key: "consent_evidence_file_id", label: "Evidencia de consentimiento LOPDP" },
  { key: "approval_letter_file_id", label: "Oficio de aprobaciÃ³n" },
  { key: "consent_record_file_id", label: "Registro de consentimiento" },
];

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getRoleTokens(user) {
  const rawRole = user?.role;
  const rawScope = user?.scope;
  const roleValues = Array.isArray(rawRole) ? rawRole : [rawRole];
  const scopeValues = Array.isArray(rawScope) ? rawScope : [rawScope];
  return [...roleValues, ...scopeValues]
    .flatMap((value) => {
      const raw = String(value || "").trim();
      if (!raw) return [];
      return [raw, ...raw.split(/[,\s]+/)];
    })
    .map((value) => normalizeRole(value))
    .filter(Boolean);
}

function hasRoleToken(user, token) {
  const normalizedToken = normalizeRole(token);
  const compactToken = normalizedToken.replace(/_/g, "");
  return getRoleTokens(user).some((role) => {
    const compactRole = String(role || "").replace(/_/g, "");
    return (
      role === normalizedToken ||
      role.includes(normalizedToken) ||
      compactRole === compactToken ||
      compactRole.includes(compactToken)
    );
  });
}

function canViewInspectionQueue(user) {
  return ["jefe_tecnico", "jefe_servicio", "jefe_servicio_tecnico", "tecnico"].some((role) =>
    hasRoleToken(user, role),
  );
}

function canCoordinateInspection(user) {
  return [
    "jefe_tecnico",
    "jefe_servicio",
    "jefe_servicio_tecnico",
  ].some((role) => hasRoleToken(user, role));
}

function canReviewInspectionCoordination(user) {
  return [
    "jefe_tecnico",
    "jefe_servicio",
    "jefe_servicio_tecnico",
  ].some((role) => hasRoleToken(user, role));
}

function canRegisterSiteInspection(user) {
  return [
    "tecnico",
    "jefe_tecnico",
    "jefe_servicio",
    "jefe_servicio_tecnico",
  ].some((role) => hasRoleToken(user, role));
}

function getInspectionResponsibleName(user) {
  const fullName = String(user?.fullname || user?.name || "").trim();
  if (fullName) return fullName;
  return String(user?.email || "").trim() || "N/D";
}

// Ejecución física: llegada del equipo, despacho, entrega completada.
function canManageDelivery(user) {
  return [
    "acp_comercial",
    "gerencia",
    "gerencia_general",
    "jefe_comercial",
    "jefe_operaciones",
    "jefe_logistica",
    "jefe_tecnico",
    "jefe_servicio",
    "jefe_servicio_tecnico",
    "tecnico",
  ].some((role) => hasRoleToken(user, role));
}

// Planificación: solicitar y confirmar fechas de entrega con el cliente.
function canPlanDelivery(user) {
  return [
    "acp_comercial",
    "gerencia",
    "gerencia_general",
    "jefe_comercial",
    "jefe_operaciones",
    "operaciones",
  ].some((role) => hasRoleToken(user, role));
}

function canManageAll(user) {
  const directRole = normalizeRole(user?.role);
  if (MANAGER_ROLES.has(directRole)) return true;
  return getRoleTokens(user).some((role) => MANAGER_ROLES.has(role));
}

function createAppError(message, { status = 400, code = "BAD_REQUEST", details, retryable } = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details !== undefined) error.details = details;
  if (retryable !== undefined) error.retryable = Boolean(retryable);
  return error;
}

function assertRequestExists(request) {
  if (request) return;
  throw createAppError("Solicitud no encontrada o sin acceso", {
    status: 404,
    code: "REQUEST_NOT_FOUND",
  });
}

function assertActionStatus(request, action) {
  const allowed = ACTION_ALLOWED_STATUSES[action] || [];
  if (!allowed.length) return;
  if (allowed.includes(request?.status)) return;
  throw createAppError("La solicitud no estÃ¡ en el estado requerido para esta acciÃ³n", {
    status: 409,
    code: "INVALID_TRANSITION",
    details: {
      action,
      current_status: request?.status || null,
      allowed_statuses: allowed,
    },
  });
}

function assertNoStaleWrite(request, expectedUpdatedAt) {
  if (!expectedUpdatedAt) return;

  const expectedMs = new Date(expectedUpdatedAt).getTime();
  const currentMs = new Date(request?.updated_at).getTime();
  if (!Number.isFinite(expectedMs) || !Number.isFinite(currentMs)) {
    throw createAppError("Marca de versiÃ³n invÃ¡lida para control de concurrencia", {
      status: 400,
      code: "INVALID_CONCURRENCY_TOKEN",
    });
  }

  // Tolerancia de 1 segundo para diferencias de serializaciÃ³n.
  if (Math.abs(expectedMs - currentMs) <= 1000) return;

  throw createAppError("La solicitud cambiÃ³ en otra sesiÃ³n. Refresca e intenta nuevamente.", {
    status: 409,
    code: "STALE_REQUEST_STATE",
    details: {
      expected_updated_at: new Date(expectedMs).toISOString(),
      current_updated_at: new Date(currentMs).toISOString(),
    },
    retryable: true,
  });
}

async function getUsersByRole(role) {
  if (!role) return [];
  try {
    const { rows } = await db.query(
      'SELECT id, email, fullname FROM users WHERE role = $1 AND active = true ORDER BY id ASC',
      [role],
    );
    return rows;
  } catch (error) {
    logger.warn({ error, role }, 'No se pudo resolver usuarios por rol');
    return [];
  }
}

async function notifyUsers({
  userIds = [],
  title,
  message,
  type = "info",
  source,
  priority = 1,
  meta = {},
  data = {},
  email = true,
  chat = false,
}) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!uniqueIds.length) return;
  await Promise.all(uniqueIds.map((userId) =>
    notificationManager.sendNotification({
      userId,
      customTitle: title,
      customMessage: message,
      type,
      source,
      priority,
      data,
      email,
      chat,
      meta,
    })
  ));
}

async function notifyDeliveryStage({ request, title, message, meta = {}, priority = 1 }) {
  if (!request) return;
  try {
    await notifyUsers({
      userIds: [request.created_by, request.assigned_to],
      title,
      message,
      type: "task",
      source: "equipment_purchases_delivery",
      priority,
      meta: { request_id: request.id, ...meta },
    });
  } catch (notifyError) {
    logger.warn(
      { notifyError, requestId: request.id },
      "No se pudieron enviar notificaciones del flujo de entrega",
    );
  }
}

function driveLink(fileId) {
  return fileId ? `https://drive.google.com/file/d/${fileId}/view` : null;
}

function safeJsonParse(value, fallback = {}) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function mergeExtra(baseExtra, patchExtra = {}) {
  const base = baseExtra && typeof baseExtra === "object" && !Array.isArray(baseExtra) ? baseExtra : {};
  const patch = patchExtra && typeof patchExtra === "object" && !Array.isArray(patchExtra) ? patchExtra : {};
  return { ...base, ...patch };
}

function normalizeDateOnlyInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const isoDateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDateMatch) return isoDateMatch[1];

  const esDateMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (esDateMatch) {
    const [, dd, mm, yyyy] = esDateMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const day = String(parsed.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return "";
}

function hasInspectionActa(request) {
  const extra = request?.extra && typeof request.extra === "object" && !Array.isArray(request.extra)
    ? request.extra
    : {};
  return Boolean(extra?.inspection_acta_file_id || extra?.inspection_acta_link);
}

function getContractTimelineFromSignedProforma(value) {
  const signedAt = value ? new Date(value) : null;
  if (!signedAt || Number.isNaN(signedAt.getTime())) {
    return {
      dueDate: null,
      reminderDate: null,
      daysRemaining: null,
      isOverdue: false,
    };
  }

  const dueDate = new Date(signedAt);
  dueDate.setUTCDate(dueDate.getUTCDate() + CONTRACT_MAX_DAYS);

  const reminderDate = new Date(dueDate);
  reminderDate.setUTCDate(reminderDate.getUTCDate() - CONTRACT_REMINDER_DAYS_BEFORE);

  const dueDateIso = normalizeDateOnlyInput(dueDate.toISOString());
  const reminderDateIso = normalizeDateOnlyInput(reminderDate.toISOString());

  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const dueDateUtc = dueDateIso ? new Date(`${dueDateIso}T00:00:00.000Z`) : null;
  const daysRemaining =
    dueDateUtc && !Number.isNaN(dueDateUtc.getTime())
      ? Math.ceil((dueDateUtc.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000))
      : null;

  return {
    dueDate: dueDateIso || null,
    reminderDate: reminderDateIso || null,
    daysRemaining,
    isOverdue: Number.isFinite(daysRemaining) ? daysRemaining < 0 : false,
  };
}

function normalizeChecklistAnswer(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "SI" || normalized === "NO" || normalized === "N/A") return normalized;
  return "";
}

function normalizeFst07Checklist(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const normalized = {};
  for (const question of FST07_CHECKLIST_QUESTIONS) {
    const answer = normalizeChecklistAnswer(source[question.key]);
    if (!answer) {
      throw createAppError(`Checklist F.ST-07 incompleto en '${question.key}'`, {
        status: 400,
        code: "SITE_INSPECTION_CHECKLIST_INVALID",
        details: { key: question.key, reason: "required" },
      });
    }
    if (answer === "N/A" && !question.allows_na) {
      throw createAppError(`La opciÃ³n N/A no aplica para '${question.key}'`, {
        status: 400,
        code: "SITE_INSPECTION_CHECKLIST_INVALID",
        details: { key: question.key, reason: "na_not_allowed" },
      });
    }
    normalized[question.key] = answer;
  }
  return normalized;
}

function getInspectionSiteState(extra = {}) {
  const raw = extra?.inspection_site && typeof extra.inspection_site === "object" ? extra.inspection_site : {};
  const status =
    raw.status ||
    (raw.ready_for_installation ? SITE_INSPECTION_STATUS.READY_FOR_INSTALLATION : SITE_INSPECTION_STATUS.PENDING);
  return {
    status,
    result: raw.result || null,
    follow_up_date: normalizeDateOnlyInput(raw.follow_up_date),
    report_file_id: raw.report_file_id || null,
    report_link: raw.report_link || null,
    report_generated_at: raw.report_generated_at || null,
    ready_for_installation: Boolean(raw.ready_for_installation),
    requires_reinspection: Boolean(raw.requires_reinspection),
    checklist: raw.checklist && typeof raw.checklist === "object" ? raw.checklist : {},
    observations: raw.observations || null,
    recommendations: raw.recommendations || null,
    responsible_name: raw.responsible_name || null,
    client_signer_name: raw.client_signer_name || null,
    updated_at: raw.updated_at || null,
    updated_by: raw.updated_by || null,
    updated_by_email: raw.updated_by_email || null,
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

function getInstallationWorkflowState(extra = {}, { equipment = [], siteReady = true, requiresSiteInspection = true } = {}) {
  const source = extra?.installation_workflow && typeof extra.installation_workflow === "object"
    ? extra.installation_workflow
    : {};
  const normalized = normalizeInstallationWorkflowState(source, { equipment });
  const gate = computeInstallationClosureGate({
    workflow: normalized,
    siteReady,
    requiresSiteInspection,
  });
  return {
    ...normalized,
    closure_gate: gate,
  };
}

function mapRequestRow(row = {}) {
  const extra = typeof row.extra === "string" ? safeJsonParse(row.extra) : row.extra;
  const checklist = typeof row.checklist === "string" ? safeJsonParse(row.checklist, {}) : (row.checklist || {});
  const inspectionSite = getInspectionSiteState(extra || {});
  const installationWorkflow = getInstallationWorkflowState(extra || {}, {
    equipment: Array.isArray(row?.equipment) ? row.equipment : [],
    siteReady: Boolean(inspectionSite?.ready_for_installation),
    requiresSiteInspection: Boolean(row?.inspection_request_id || row?.inspection_scheduled_date),
  });
  const autoBusinessCaseStage = row?.auto_business_case_stage || extra?.auto_business_case_stage || null;
  const autoBusinessCaseStatus = row?.auto_business_case_status || extra?.auto_business_case_status || null;
  const autoBusinessCaseResolvedFactible =
    typeof row?.auto_business_case_resolved_factible === "boolean"
      ? row.auto_business_case_resolved_factible
      : String(autoBusinessCaseStage || "").trim().toLowerCase() === "factible";
  const mappedAction = ACTION_BY_STATUS[row.status] || null;
  const checklistItems = Object.entries(CHECKLIST_ITEMS).map(([key, meta]) => {
    const dbValue = checklist[key] || {};
    const checked = meta.auto ? Boolean(meta.validator?.({ ...row, extra })) : Boolean(dbValue.checked);
    return {
      key,
      label: meta.label,
      auto: meta.auto,
      checked,
      note: dbValue.note || null,
      updated_at: dbValue.updated_at || null,
      updated_by: dbValue.updated_by || null,
      required_for_action: Object.entries(ACTION_CHECKLIST_REQUIREMENTS)
        .filter(([, required]) => required.includes(key))
        .map(([action]) => action),
    };
  });
  const pendingForCurrentAction = mappedAction
    ? checklistItems
      .filter((item) => (ACTION_CHECKLIST_REQUIREMENTS[mappedAction] || []).includes(item.key) && !item.checked)
      .map((item) => item.key)
    : [];
  const proformaRequestedAt = row?.proforma_requested_at ? new Date(row.proforma_requested_at) : null;
  const proformaRetryAvailableAt =
    proformaRequestedAt && !Number.isNaN(proformaRequestedAt.getTime())
      ? new Date(proformaRequestedAt.getTime() + PROFORMA_REQUEST_COOLDOWN_MS)
      : null;
  const hasProformaResponse = Boolean(row?.proforma_file_id || row?.proforma_uploaded_at);
  const isProformaRequestLocked = Boolean(
    proformaRetryAvailableAt &&
    !hasProformaResponse &&
    Date.now() < proformaRetryAvailableAt.getTime(),
  );
  const proformaRetryRemainingSeconds = isProformaRequestLocked
    ? Math.max(0, Math.ceil((proformaRetryAvailableAt.getTime() - Date.now()) / 1000))
    : 0;
  const contractTimeline = getContractTimelineFromSignedProforma(row?.signed_proforma_uploaded_at);
  const portalOutcomeRaw = extra?.public_portal_outcome && typeof extra.public_portal_outcome === "object"
    ? extra.public_portal_outcome
    : {};
  const publicPortalOutcome = String(portalOutcomeRaw.outcome || "").trim().toLowerCase() || null;
  return {
    ...row,
    extra,
    checklist,
    request_type: row.request_type || "purchase",
    // Campos unificados del workflow
    status_unified: row.status_unified || null,
    forwarded_to_acp_at: row.forwarded_to_acp_at || null,
    business_case_id: row.business_case_id || null,
    offer_document_id: row.offer_document_id || null,
    offer_signed_document_id: row.offer_signed_document_id || null,
    comodato_document_id: row.comodato_document_id || null,
    contract_document_id: row.contract_document_id || row.contract_file_id || null,
    contract_signed_document_id: row.contract_signed_document_id || null,
    contract_client_signed_document_id: row.contract_client_signed_document_id || null,
    delivery_act_document_id: row.delivery_act_document_id || null,
    site_inspection_report_document_id: row.site_inspection_report_document_id || null,
    inspection_acta_document_id: row.inspection_acta_document_id || null,
    manager_contract_decision: row.manager_contract_decision || null,
    manager_contract_decision_reason: row.manager_contract_decision_reason || null,
    manager_contract_decision_at: row.manager_contract_decision_at || null,
    manager_contract_decision_by: row.manager_contract_decision_by || null,
    offer_valid_until: row.offer_valid_until || null,
    offer_kind: row.offer_kind || null,
    offer_signed_uploaded_at: row.offer_signed_uploaded_at || null,
    backoffice_approved_at: row.backoffice_approved_at || null,
    commercial_accepted_offer_at: row.commercial_accepted_offer_at || null,
    signed_offer_received_at: row.signed_offer_received_at || null,
    client_registered_at: row.client_registered_at || null,
    client_registration_requested_at: row.client_registration_requested_at || null,
    client_approved_at: row.client_approved_at || null,
    operations_notes: row.operations_notes || null,
    estimated_arrival_at: row.estimated_arrival_at || null,
    estimated_arrival_updated_at: row.estimated_arrival_updated_at || null,
    dispatch_items_json: row.dispatch_items_json || null,
    dispatch_notes: row.dispatch_notes || null,
    delivery_guides_json: row.delivery_guides_json || null,
    delivery_guides_uploaded_at: row.delivery_guides_uploaded_at || null,
    delivery_act_number: row.delivery_act_number || null,
    delivery_act_dispatched_by: row.delivery_act_dispatched_by || null,
    delivery_act_dispatched_at: row.delivery_act_dispatched_at || null,
    delivery_act_delivered_by: row.delivery_act_delivered_by || null,
    delivery_act_delivered_at: row.delivery_act_delivered_at || null,
    delivery_act_observations_json: row.delivery_act_observations_json || null,
    delivery_act_draft_document_id: row.delivery_act_draft_document_id || null,
    delivery_act_draft_generated_at: row.delivery_act_draft_generated_at || null,
    delivery_act_generated_at: row.delivery_act_generated_at || null,
    delivery_act_assigned_to_user_id: row.delivery_act_assigned_to_user_id || null,
    delivery_act_assigned_to_email: row.delivery_act_assigned_to_email || null,
    delivery_act_assigned_to_name: row.delivery_act_assigned_to_name || null,
    delivery_act_assigned_at: row.delivery_act_assigned_at || null,
    delivery_act_assigned_by: row.delivery_act_assigned_by || null,
    delivery_act_logistics_signed_document_id: row.delivery_act_logistics_signed_document_id || null,
    delivery_act_logistics_signed_at: row.delivery_act_logistics_signed_at || null,
    delivery_act_logistics_signed_by: row.delivery_act_logistics_signed_by || null,
    site_inspection: row.site_inspection || null,
    site_inspection_status: row.site_inspection_status || inspectionSite.status,
    site_inspection_result: row.site_inspection_result || inspectionSite.result,
    site_inspection_follow_up_date: row.site_inspection_follow_up_date || inspectionSite.follow_up_date || null,
    site_inspection_report_link: row.site_inspection_report_link || inspectionSite.report_link,
    site_inspection_report_generated_at: row.site_inspection_report_generated_at || inspectionSite.report_generated_at || null,
    site_inspection_ready_for_installation: row.site_inspection_ready_for_installation || inspectionSite.ready_for_installation,
    site_inspection_requires_reinspection: row.site_inspection_requires_reinspection || inspectionSite.requires_reinspection,
    site_inspection_updated_at: row.site_inspection_updated_at || inspectionSite.updated_at,
    site_inspection_updated_by: row.site_inspection_updated_by || inspectionSite.updated_by,
    site_inspection_updated_by_email: row.site_inspection_updated_by_email || inspectionSite.updated_by_email,
    comodato_business_case_id: row.comodato_business_case_id || null,
    equipment_purchase_request_id: row.equipment_purchase_request_id || null,
    client_request_id: row.client_request_id || null,
    client_snapshot: row.client_snapshot || null,
    client_type: row.client_type || null,
    // Campos legacy existentes
    proforma_file_link: driveLink(row.proforma_file_id),
    signed_proforma_file_link: driveLink(row.signed_proforma_file_id),
    contract_file_link: driveLink(row.contract_file_id),
    process_doc_link: row.process_doc_url || driveLink(row.process_doc_id),
    inspection_request_id: row.inspection_request_id || null,
    inspection_assigned_technician_id: extra?.inspection_assigned_technician_id || null,
    inspection_assigned_technician_email: extra?.inspection_assigned_technician_email || null,
    inspection_assigned_technician_name: extra?.inspection_assigned_technician_name || null,
    inspection_calendar_event_id: extra?.inspection_calendar_event_id || null,
    inspection_calendar_event_link: extra?.inspection_calendar_event_link || null,
    installation_workflow: installationWorkflow,
    installation_can_close: Boolean(installationWorkflow?.closure_gate?.can_close),
    installation_blocked_reasons: installationWorkflow?.closure_gate?.blocked_reasons || [],
    installation_dispatch_request: installationWorkflow?.dispatch_request || null,
    installation_logistics_validation: installationWorkflow?.logistics_validation || null,
    installation_visual_reception: installationWorkflow?.visual_reception || null,
    installation_verification_decision: installationWorkflow?.verification_decision || null,
    installation_verification_cycle: installationWorkflow?.verification_cycle || null,
    installation_cu_flow: installationWorkflow?.cu_flow || null,
    installation_delivery_act: installationWorkflow?.delivery_act || null,
    fst14_report_file_id: installationWorkflow?.visual_reception?.report_file_id || null,
    fst14_report_link: installationWorkflow?.visual_reception?.report_link || null,
    verification_decision_applies: installationWorkflow?.verification_decision?.applies,
    verification_cycle_status: installationWorkflow?.verification_cycle?.status || null,
    verification_attempts: Array.isArray(installationWorkflow?.verification_cycle?.attempts)
      ? installationWorkflow.verification_cycle.attempts
      : [],
    auto_business_case_stage: autoBusinessCaseStage,
    auto_business_case_status: autoBusinessCaseStatus,
    auto_business_case_resolved_factible: autoBusinessCaseResolvedFactible,
    contract_deadline_date: contractTimeline.dueDate,
    contract_reminder_date: contractTimeline.reminderDate,
    contract_deadline_days_remaining: contractTimeline.daysRemaining,
    contract_deadline_overdue: contractTimeline.isOverdue,
    public_portal_outcome: publicPortalOutcome,
    public_portal_outcome_notes: portalOutcomeRaw.notes || null,
    public_portal_outcome_at: portalOutcomeRaw.recorded_at || null,
    public_portal_outcome_by: portalOutcomeRaw.recorded_by || null,
    public_portal_outcome_by_email: portalOutcomeRaw.recorded_by_email || null,
    proforma_request_locked: isProformaRequestLocked,
    proforma_retry_available_at: proformaRetryAvailableAt ? proformaRetryAvailableAt.toISOString() : null,
    proforma_retry_remaining_seconds: proformaRetryRemainingSeconds,
    checklist_state: {
      action: mappedAction,
      requirements: mappedAction ? (ACTION_CHECKLIST_REQUIREMENTS[mappedAction] || []) : [],
      pending: pendingForCurrentAction,
      items: checklistItems,
    },
  };
}

function buildClientDocumentsFromRow(clientRow = {}) {
  return CLIENT_DOCUMENT_FIELDS
    .filter((field) => Boolean(clientRow[field.key]))
    .map((field) => ({
      key: field.key.replace(/_id$/, ""),
      label: field.label,
      file_id: clientRow[field.key],
      link: driveLink(clientRow[field.key]),
    }));
}

async function enrichRequestsWithClientDocuments(requests = []) {
  const list = Array.isArray(requests) ? requests : [];
  if (!list.length) return list;

  const clientIds = Array.from(
    new Set(
      list
        .map((request) => Number.parseInt(request?.client_id, 10))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );
  if (!clientIds.length) {
    return list.map((request) => ({ ...request, client_documents: [] }));
  }

  let clientRows = [];
  try {
    const { rows } = await db.query(
      `SELECT
         id,
         id_file_id,
         ruc_file_id,
         legal_rep_appointment_file_id,
         operating_permit_file_id,
         consent_evidence_file_id,
         approval_letter_file_id,
         consent_record_file_id
       FROM client_requests
       WHERE id = ANY($1::int[])`,
      [clientIds],
    );
    clientRows = rows || [];
  } catch (error) {
    logger.warn({ error }, "No se pudieron cargar documentos del cliente para compras pÃºblicas");
  }

  const docsByClientId = new Map(
    clientRows.map((row) => [Number.parseInt(row.id, 10), buildClientDocumentsFromRow(row)]),
  );

  return list.map((request) => ({
    ...request,
    client_documents: docsByClientId.get(Number.parseInt(request?.client_id, 10)) || [],
  }));
}

function getAutoBusinessCaseIdFromRequest(request = {}) {
  const value = String(request?.business_case_id || "").trim();
  return value || null;
}

async function enrichRequestsWithAutoBusinessCaseStatus(requests = []) {
  const list = Array.isArray(requests) ? requests : [];
  if (!list.length) return list;

  const bcIds = Array.from(
    new Set(
      list
        .map((request) => getAutoBusinessCaseIdFromRequest(request))
        .filter(Boolean),
    ),
  );
  if (!bcIds.length) {
    return list.map((request) => ({
      ...request,
      auto_business_case_stage: null,
      auto_business_case_status: null,
      auto_business_case_resolved_factible: false,
    }));
  }

  let rows = [];
  try {
    const queryResult = await db.query(
      `SELECT id, status, bc_stage
         FROM equipment_purchase_requests
        WHERE id = ANY($1::uuid[])
          AND COALESCE(request_type, 'purchase') = 'business_case'`,
      [bcIds],
    );
    rows = queryResult.rows || [];
  } catch (error) {
    logger.warn({ error }, "No se pudo cargar estado de Business Case automÃ¡tico");
    rows = [];
  }

  const byId = new Map(rows.map((row) => [String(row.id), row]));

  return list.map((request) => {
    const bcId = getAutoBusinessCaseIdFromRequest(request);
    const bc = bcId ? byId.get(String(bcId)) : null;
    const stage = String(bc?.bc_stage || "").trim().toLowerCase();
    return {
      ...request,
      auto_business_case_stage: bc?.bc_stage || null,
      auto_business_case_status: bc?.status || null,
      auto_business_case_resolved_factible: stage === "factible",
    };
  });
}

function assertChecklistReady(request, action) {
  const required = ACTION_CHECKLIST_REQUIREMENTS[action] || [];
  if (!required.length) return;

  const checklist = typeof request?.checklist === "string" ? safeJsonParse(request.checklist, {}) : (request?.checklist || {});
  const pending = required.filter((key) => {
    const meta = CHECKLIST_ITEMS[key];
    if (!meta) return true;
    if (meta.auto) return !Boolean(meta.validator?.(request));
    return !Boolean(checklist?.[key]?.checked);
  });

  if (pending.length) {
    throw createAppError(
      `Checklist incompleto para continuar: ${pending.map((key) => CHECKLIST_ITEMS[key]?.label || key).join(", ")}`,
      {
        status: 409,
        code: "CHECKLIST_INCOMPLETE",
        details: { action, pending },
      },
    );
  }
}

function assertSiteReadyForInstallation(request) {
  const ready = Boolean(
    request?.inspection_site_ready_for_installation ||
      request?.extra?.inspection_site?.ready_for_installation,
  );
  if (ready) return;
  throw createAppError("El sitio inspeccionado no estÃ¡ conforme para instalar el equipo", {
    status: 409,
    code: "SITE_NOT_READY_FOR_INSTALLATION",
    details: {
      inspection_site_status:
        request?.inspection_site_status ||
        request?.extra?.inspection_site?.status ||
        SITE_INSPECTION_STATUS.PENDING,
      follow_up_date:
        request?.inspection_site_follow_up_date ||
        request?.extra?.inspection_site?.follow_up_date ||
        null,
    },
  });
}

function getAcceptedItems(request) {
  if (!request?.provider_response?.items) return [];
  return request.provider_response.items.filter(
    (item) => item && item.decision !== "reject" && item.available_type !== "none",
  );
}

function formatEquipmentList(items) {
  const list = (items || []).map((item) => {
    const label = item.available_type === "cu"
      ? "CU"
      : item.available_type === "new_import"
        ? "Nuevo para importaciÃ³n"
        : item.available_type === "installed_client"
          ? "Instalado en cliente"
          : "Nuevo disponible";
    const name = item.name || item.sku || "Equipo";
    return `<li>${name} (${label})</li>`;
  });
  return list.length ? `<ul>${list.join("")}</ul>` : "<p>Sin equipos disponibles</p>";
}

function stripHtml(text) {
  if (!text) return "";
  return text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function buildReport({ subject, html, request, actionLabel, user }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const acceptedItems = getAcceptedItems(request);
    const requestedItems = Array.isArray(request?.equipment) ? request.equipment : [];
    const now = new Date();

    doc.fontSize(18).text(actionLabel || "Informe de disponibilidad de equipos", {
      underline: true,
    });
    doc.moveDown();
    doc.fontSize(12).text(`Fecha y hora: ${now.toLocaleString("es-ES")}`);
    if (subject) doc.text(`Asunto: ${subject}`);
    if (user?.fullname || user?.name || user?.email) {
      const author = user.fullname || user.name || user.email;
      doc.text(`Usuario: ${author}${user.email && author !== user.email ? ` (${user.email})` : ""}`);
    }
    if (request?.client_name) doc.text(`Cliente: ${request.client_name}`);
    if (request?.provider_email) doc.text(`Proveedor: ${request.provider_email}`);
    if (request?.id) doc.text(`Solicitud: ${request.id}`);
    if (request?.provider_response?.notes) doc.text(`Notas del proveedor: ${request.provider_response.notes}`);

    doc.moveDown();
    doc.fontSize(14).text("Equipos aceptados");
    doc.fontSize(12);
    if (acceptedItems.length) {
      acceptedItems.forEach((item, idx) => {
        const label = item.available_type === "cu"
          ? "CU"
          : item.available_type === "new_import"
            ? "Nuevo para importaciÃ³n"
            : item.available_type === "installed_client"
              ? "Instalado en cliente"
              : "Nuevo disponible";
        const name = item.name || item.sku || `Equipo ${idx + 1}`;
        const serial = item.serial ? ` - Serie: ${item.serial}` : "";
        doc.text(`â€¢ ${name}${serial} (${label})`);
      });
    } else {
      doc.text("Sin equipos aceptados registrados");
    }

    if (requestedItems.length) {
      doc.moveDown();
      doc.fontSize(14).text("Equipos solicitados");
      doc.fontSize(12);
      requestedItems.forEach((item, idx) => {
        const label = item.type === "cu"
          ? "CU"
          : item.type === "new_import"
            ? "Nuevo para importaciÃ³n"
            : item.type === "installed_client"
              ? "Instalado en cliente"
              : "Nuevo disponible";
        const name = item.name || item.sku || `Equipo ${idx + 1}`;
        const serial = item.serial ? ` - Serie: ${item.serial}` : "";
        doc.text(`â€¢ ${name}${serial} (${label})`);
      });
    }

    const body = stripHtml(html) || "Sin detalle de mensaje";
    doc.moveDown();
    doc.fontSize(14).text("Detalle del mensaje enviado");
    doc.fontSize(12).text(body, { align: "left" });

    doc.end();
  });
}

async function ensureTables() {
  if (initialized) return;
  await db.query(`CREATE SCHEMA IF NOT EXISTS servicio`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS equipment_purchase_requests (
      id UUID PRIMARY KEY,
      created_by INTEGER,
      created_by_email TEXT,
      assigned_to INTEGER,
      assigned_to_email TEXT,
      assigned_to_name TEXT,
      client_id INTEGER,
      client_name TEXT NOT NULL,
      client_email TEXT,
      notes TEXT,
      provider_email TEXT,
      equipment JSONB NOT NULL DEFAULT '[]',
      status TEXT NOT NULL,
      availability_email_sent_at TIMESTAMPTZ,
      availability_email_file_id TEXT,
      provider_response JSONB,
      provider_response_at TIMESTAMPTZ,
      proforma_requested_at TIMESTAMPTZ,
      proforma_request_email_file_id TEXT,
      proforma_file_id TEXT,
      proforma_uploaded_at TIMESTAMPTZ,
      reservation_email_sent_at TIMESTAMPTZ,
      reservation_calendar_event_id TEXT,
      reservation_calendar_event_link TEXT,
      reservation_email_file_id TEXT,
      signed_proforma_file_id TEXT,
      signed_proforma_uploaded_at TIMESTAMPTZ,
      arrival_eta_email_sent_at TIMESTAMPTZ,
      arrival_eta_email_file_id TEXT,
      inspection_min_date DATE,
      inspection_max_date DATE,
      includes_starter_kit BOOLEAN,
      inspection_recorded_at TIMESTAMPTZ,
      inspection_request_id INTEGER,
      inspection_scheduled_date DATE,
      inspection_proposed_date DATE,
      inspection_proposed_notes TEXT,
      inspection_proposed_at TIMESTAMPTZ,
      inspection_proposed_by INTEGER,
      inspection_proposed_by_email TEXT,
      inspection_coordination_status TEXT DEFAULT 'pending_proposal',
      inspection_review_notes TEXT,
      inspection_reviewed_at TIMESTAMPTZ,
      inspection_reviewed_by INTEGER,
      inspection_reviewed_by_email TEXT,
      inspection_coordination_notes TEXT,
      inspection_coordinated_at TIMESTAMPTZ,
      inspection_coordinated_by INTEGER,
      inspection_coordinated_by_email TEXT,
      contract_file_id TEXT,
      contract_uploaded_at TIMESTAMPTZ,
      contract_reminder_event_id TEXT,
      contract_reminder_event_link TEXT,
      contract_reminder_email_sent_at TIMESTAMPTZ,
      contract_reminder_email_to TEXT,
      drive_folder_id TEXT,
      extra JSONB,
      request_type TEXT DEFAULT 'purchase',
      availability_status TEXT,
      availability_source TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS assigned_to INTEGER`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS assigned_to_email TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS assigned_to_name TEXT`,
  );
  await db.query(`ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS notes TEXT`);
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS process_doc_id TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS process_doc_url TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS process_doc_created_at TIMESTAMPTZ`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'purchase'`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_request_id INTEGER`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_scheduled_date DATE`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_proposed_date DATE`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_proposed_notes TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_proposed_at TIMESTAMPTZ`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_proposed_by INTEGER`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_proposed_by_email TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_coordination_status TEXT DEFAULT 'pending_proposal'`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_review_notes TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_reviewed_at TIMESTAMPTZ`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_reviewed_by INTEGER`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_reviewed_by_email TEXT`,
  );
  await db.query(
    `UPDATE equipment_purchase_requests
        SET inspection_coordination_status = CASE
          WHEN inspection_scheduled_date IS NOT NULL THEN 'accepted'
          WHEN inspection_proposed_date IS NOT NULL THEN 'pending_review'
          WHEN inspection_request_id IS NOT NULL THEN 'pending_proposal'
          ELSE COALESCE(inspection_coordination_status, 'pending_proposal')
        END
      WHERE inspection_coordination_status IS NULL`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_coordination_notes TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_coordinated_at TIMESTAMPTZ`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_coordinated_by INTEGER`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS inspection_coordinated_by_email TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '{}'::jsonb`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS delivery_dates_requested_at TIMESTAMPTZ`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS delivery_dates_requested_by INTEGER`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS delivery_dates_requested_by_email TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS delivery_start_at DATE`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS delivery_end_at DATE`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS delivery_notes TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS equipment_arrived_at TIMESTAMPTZ`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS equipment_arrived_by INTEGER`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS equipment_arrived_by_email TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS dispatch_ready_at TIMESTAMPTZ`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS dispatch_ready_by INTEGER`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS dispatch_ready_by_email TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS delivered_by INTEGER`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS delivered_by_email TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS delivery_confirmed_notes TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS contract_reminder_email_sent_at TIMESTAMPTZ`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS contract_reminder_email_to TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ`,
  );
  // Back-fill: if reservation was already sent but no expiry, set expiry = sent_at + VALIDITY_DAYS
  await db.query(`
    UPDATE equipment_purchase_requests
       SET reservation_expires_at = reservation_email_sent_at + INTERVAL '${RESERVATION_VALIDITY_DAYS} days'
     WHERE reservation_email_sent_at IS NOT NULL
       AND reservation_expires_at IS NULL
  `);

  // â”€â”€ Columnas de disponibilidad (availability) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS availability_status TEXT`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests ADD COLUMN IF NOT EXISTS availability_source TEXT`,
  );
  // Back-fill: derivar availability_status a partir de data existente para registros
  // que fueron guardados ANTES de que existiera la columna.
  await db.query(`
    UPDATE equipment_purchase_requests
       SET availability_status = CASE
             -- Proveedor respondiÃ³ y el flujo avanzÃ³ â†’ disponibilidad confirmada
             WHEN provider_response_at IS NOT NULL
              AND status NOT IN ('no_stock', 'waiting_client_cu_approval', 'waiting_acp_import_confirmation', 'cancelled', 'rejected')
             THEN 'availability_confirmed'
             -- Sin stock (proveedor rechazÃ³)
             WHEN status = 'no_stock' AND provider_response_at IS NOT NULL
             THEN 'supplier_rejected'
             -- CU pendiente de aprobaciÃ³n cliente
             WHEN status = 'waiting_client_cu_approval'
             THEN 'cu_available_pending_approval'
             -- ImportaciÃ³n pendiente de confirmaciÃ³n ACP
             WHEN status = 'waiting_acp_import_confirmation'
             THEN 'import_pending_acp_confirmation'
             -- Email enviado al proveedor pero aÃºn sin respuesta
             WHEN availability_email_sent_at IS NOT NULL AND provider_response_at IS NULL
             THEN 'supplier_requested'
             ELSE NULL
           END
     WHERE availability_status IS NULL
       AND (provider_response_at IS NOT NULL OR availability_email_sent_at IS NOT NULL)
  `);
  // Back-fill: availability_source
  await db.query(`
    UPDATE equipment_purchase_requests
       SET availability_source = 'supplier'
     WHERE availability_source IS NULL
       AND availability_email_sent_at IS NOT NULL
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS equipment_purchase_provider_contacts (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT,
      created_by INTEGER,
      created_by_email TEXT,
      last_used_at TIMESTAMPTZ,
      use_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(
    `DELETE FROM equipment_purchase_provider_contacts a
      USING equipment_purchase_provider_contacts b
      WHERE a.id < b.id
        AND lower(trim(a.email)) = lower(trim(b.email))`,
  );
  await db.query(
    `UPDATE equipment_purchase_provider_contacts
        SET email = lower(trim(email)),
            updated_at = now()
      WHERE email IS NOT NULL
        AND email <> lower(trim(email))`,
  );
  await db.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_purchase_provider_contacts_email_norm
      ON equipment_purchase_provider_contacts ((lower(trim(email))))`,
  );
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_equipment_purchase_provider_contacts_email_norm'
      ) THEN
        ALTER TABLE equipment_purchase_provider_contacts
          ADD CONSTRAINT chk_equipment_purchase_provider_contacts_email_norm
          CHECK (email = lower(trim(email)));
      END IF;
    END
    $$;
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_equipment_purchase_provider_contacts_last_used
      ON equipment_purchase_provider_contacts (last_used_at DESC, updated_at DESC)`,
  );
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.cronograma_actividades_tecnicas (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      activity_date DATE NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'programado',
      source_type TEXT NOT NULL DEFAULT 'manual',
      source_id TEXT,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_cronograma_actividades_tecnicas_activity_date
      ON servicio.cronograma_actividades_tecnicas (activity_date, status)`,
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_cronograma_actividades_tecnicas_user_date
      ON servicio.cronograma_actividades_tecnicas (user_id, activity_date)`,
  );
  initialized = true;
}

function normalizeProviderEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function upsertProviderContact({
  email,
  displayName = null,
  user = null,
  markUsed = false,
}) {
  await ensureTables();
  const normalizedEmail = normalizeProviderEmail(email);
  if (!normalizedEmail) {
    throw createAppError("El correo del proveedor es obligatorio", {
      code: "PROVIDER_EMAIL_REQUIRED",
    });
  }
  const safeDisplayName = String(displayName || "").trim() || null;
  const createdBy = Number.isFinite(Number(user?.id)) ? Number(user.id) : null;
  const createdByEmail = user?.email ? String(user.email).trim().toLowerCase() : null;
  const touchUsedSql = markUsed
    ? `last_used_at = now(), use_count = equipment_purchase_provider_contacts.use_count + 1,`
    : "";

  const { rows } = await db.query(
    `INSERT INTO equipment_purchase_provider_contacts (
        email,
        display_name,
        created_by,
        created_by_email,
        last_used_at,
        use_count,
        updated_at
      ) VALUES ($1, $2, $3, $4, ${markUsed ? "now()" : "NULL"}, ${markUsed ? "1" : "0"}, now())
      ON CONFLICT (email) DO UPDATE
      SET
        display_name = COALESCE(EXCLUDED.display_name, equipment_purchase_provider_contacts.display_name),
        ${touchUsedSql}
        updated_at = now()
      RETURNING id, email, display_name, created_by, created_by_email, last_used_at, use_count, created_at, updated_at`,
    [normalizedEmail, safeDisplayName, createdBy, createdByEmail],
  );

  return rows[0] || null;
}

async function getRootFolder() {
  const rootId = DEFAULT_ROOT_ENV_KEYS.map((key) => process.env[key]).find(Boolean);
  if (rootId) return { id: rootId };
  return ensureFolder(ROOT_FOLDER_NAME);
}

async function getClientDetails(clientId) {
  if (!clientId) return null;
  const { rows } = await db.query(
    `SELECT id, commercial_name, client_email, shipping_contact_name, shipping_phone, shipping_cellphone, shipping_address
       FROM client_requests
      WHERE id = $1
      LIMIT 1`,
    [clientId],
  );
  return rows[0] || null;
}

async function resolveInspectionEquipmentNames(equipment = []) {
  const normalized = Array.isArray(equipment) ? equipment : [];
  if (!normalized.length) return {};

  const numericIds = Array.from(
    new Set(
      normalized
        .flatMap((item) => [item?.id, item?.unidad_id, item?.model_id, item?.modelo_id])
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value)),
    ),
  );
  if (!numericIds.length) return {};

  const namesById = {};

  try {
    const { rows } = await db.query(
      `SELECT id, nombre, modelo
         FROM public.equipos_modelo
        WHERE id = ANY($1::int[])`,
      [numericIds],
    );
    for (const row of rows) {
      const display = row?.nombre || row?.modelo || null;
      if (!display) continue;
      namesById[String(row.id)] = display;
    }
  } catch (error) {
    logger.warn({ error }, "No se pudieron resolver nombres de equipos desde equipos_modelo");
  }

  try {
    const { rows } = await db.query(
      `SELECT u.id, m.nombre, m.modelo
         FROM public.equipos_unidad u
         JOIN public.equipos_modelo m ON m.id = u.modelo_id
        WHERE u.id = ANY($1::int[])`,
      [numericIds],
    );
    for (const row of rows) {
      const display = row?.nombre || row?.modelo || null;
      if (!display) continue;
      namesById[String(row.id)] = display;
    }
  } catch (error) {
    logger.warn({ error }, "No se pudieron resolver nombres de equipos desde equipos_unidad");
  }

  return namesById;
}

async function buildInspectionPayload({ request, clientInfo, inspection_min_date, inspection_max_date, includes_starter_kit }) {
  const equipment = Array.isArray(request.equipment) ? request.equipment : [];
  const extra = request?.extra || {};
  const requiresLis = Boolean(extra.requires_lis || extra.requiere_lis);
  // El esquema espera un booleano para requiere_lis
  const lisValue = requiresLis;
  const equipmentNamesById = await resolveInspectionEquipmentNames(equipment);
  const equipos = equipment.map((item) => ({
    nombre_equipo:
      item.name ||
      item.nombre ||
      item.equipo_nombre ||
      item.label ||
      equipmentNamesById[String(item.unidad_id)] ||
      equipmentNamesById[String(item.id)] ||
      item.sku ||
      "Equipo",
    estado: item.type || item.estado || item.serial || "",
  }));

  const anotaciones = includes_starter_kit
    ? "Incluye kit de arranque"
    : "No incluye kit de arranque";

  return {
    nombre_cliente: request.client_name || clientInfo?.commercial_name || "",
    direccion_cliente: clientInfo?.shipping_address || "",
    email_cliente: request.client_email || clientInfo?.client_email || "",
    persona_contacto: clientInfo?.shipping_contact_name || "",
    celular_contacto: clientInfo?.shipping_phone || clientInfo?.shipping_cellphone || "",
    fecha_instalacion: inspection_min_date,
    fecha_tope_instalacion: inspection_max_date || "",
    requiere_lis: lisValue,
    equipos,
    anotaciones,
    accesorios: "",
    observaciones: request.notes || "",
    // La inspeccion disparada desde el workspace de compras es operativa
    // (instalacion real), no es una eleccion del usuario -- es fija segun el
    // origen del flujo. "origen" permite a la bandeja "Independientes" de
    // Solicitudes excluir esta fila (ya se gestiona en la pestana "De Compras").
    tipo_inspeccion: "normal",
    origen: "compras",
  };
}

function buildPurchaseDocumentName(request) {
  const datePart = new Date().toISOString().slice(0, 10);
  const clientPart = String(request?.client_name || "Cliente")
    .trim()
    .replace(/[\\\\/:*?"<>|]/g, "-")
    .slice(0, 80);
  return `Proceso de compra - ${clientPart || "Cliente"} - ${datePart}`;
}

async function ensurePurchaseProcessDocument({ request, clientInfo }) {
  if (request?.process_doc_id) return request;
  if (!request?.drive_folder_id || !PURCHASE_PROCESS_TEMPLATE_ID) return request;

  try {
    const name = buildPurchaseDocumentName(request);
    const copy = await copyTemplate(PURCHASE_PROCESS_TEMPLATE_ID, name, request.drive_folder_id);
    const prefills = {
      CLIENTE: request?.client_name || clientInfo?.commercial_name || "",
      CONTACTO: clientInfo?.shipping_contact_name || "",
      CORREO_CLIENTE: request?.client_email || clientInfo?.client_email || "",
      DIRECCION: clientInfo?.shipping_address || "",
    };

    try {
      await replaceTags(copy.id, prefills);
    } catch (tagError) {
      logger.warn("No se pudieron aplicar etiquetas en documento de compra: %s", tagError.message);
    }

    await db.query(
      `UPDATE equipment_purchase_requests
          SET process_doc_id = $1,
              process_doc_url = $2,
              process_doc_created_at = now(),
              updated_at = now()
        WHERE id = $3`,
      [copy.id, copy.webViewLink || null, request.id],
    );

    return { ...request, process_doc_id: copy.id, process_doc_url: copy.webViewLink };
  } catch (error) {
    logger.warn("No se pudo generar documento de proceso: %s", error.message);
    return request;
  }
}

async function ensureActaForInspection({ inspectionRequest, user }) {
  const requestId = inspectionRequest?.request?.id;
  const existingDocument = inspectionRequest?.document || null;
  const isTemplateActa = existingDocument?.source === "local_pdf_template";
  const hasActaStatus = Boolean(inspectionRequest?.request?.acta_generada);

  if (!requestId) return inspectionRequest;
  if (isTemplateActa) {
    if (!hasActaStatus) {
      await markRequestActaGenerated(requestId);
    }
    return inspectionRequest;
  }

  try {
    const document = await generateActa(requestId, user.id, "inspection");
    await markRequestActaGenerated(requestId);
    if (document?.source !== "local_pdf_template") {
      throw new Error("El acta F.ST-20 no se generÃ³ desde la plantilla PDF local");
    }
    return { ...inspectionRequest, document };
  } catch (error) {
    logger.error(
      "No se pudo generar acta de inspecciÃ³n automÃ¡tica para solicitud %s: %s",
      requestId,
      error.message,
    );
    return inspectionRequest;
  }
}

async function markRequestActaGenerated(requestId) {
  if (!requestId) return;
  try {
    const { rows } = await db.query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'requests'
           AND column_name = 'acta_generada'
       ) AS has_column`,
    );
    if (rows?.[0]?.has_column) {
      await db.query(
        `UPDATE requests
            SET acta_generada = TRUE,
                updated_at = now()
          WHERE id = $1`,
        [requestId],
      );
    }
  } catch (error) {
    logger.warn({ error, requestId }, "No se pudo marcar acta_generada en requests");
  }
}

function formatDateEsLabel(value) {
  const normalized = normalizeDateOnlyInput(value);
  if (!normalized) return "N/D";
  const [yyyy, mm, dd] = normalized.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function buildFst07ChecklistDisplayRows(checklist = {}) {
  return FST07_CHECKLIST_QUESTIONS.map((question) => ({
    label: question.label,
    answer: normalizeChecklistAnswer(checklist[question.key]) || "N/D",
  }));
}

async function generateFst07InspectionDocument({
  request,
  user,
  result,
  checklist,
  observations,
  recommendations,
  responsibleName,
  clientSignerName,
  followUpDate,
  isReinspection,
}) {
  const folderId = request?.drive_folder_id || null;
  if (!folderId) {
    throw createAppError("La compra no tiene carpeta de Drive configurada para generar F.ST-07", {
      status: 409,
      code: "SITE_INSPECTION_REPORT_FAILED",
    });
  }

  const now = new Date();
  const checklistRows = buildFst07ChecklistDisplayRows(checklist);
  const equipmentNamesById = await resolveInspectionEquipmentNames(request?.equipment || []);
  const equipmentName =
    (Array.isArray(request?.equipment) ? request.equipment : [])
      .map(
        (item) =>
          item?.name ||
          item?.nombre ||
          equipmentNamesById[String(item?.unidad_id)] ||
          equipmentNamesById[String(item?.id)] ||
          item?.sku,
      )
      .filter(Boolean)
      .join(", ") || "Equipo no especificado";

  const clientName = request?.client_name || "Cliente";
  const inspectionDate = formatDateEsLabel(request?.inspection_scheduled_date);
  const responsible = String(responsibleName || user?.fullname || user?.name || user?.email || "").trim() || "N/D";
  const clientSigner = String(clientSignerName || "").trim() || "N/D";
  const resultLabel =
    result === "compliant"
      ? "AREA LISTA PARA INSTALACION: SI"
      : "AREA LISTA PARA INSTALACION: NO (REQUIERE REINSPECCION)";
  const subtitle = isReinspection
    ? "F.ST-07 - INSPECCION DE AMBIENTE (REINSPECCION)"
    : "F.ST-07 - INSPECCION DE AMBIENTE";

  const pdfBuffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fontSize(13).font("Helvetica-Bold").text(subtitle, { align: "center" });
    doc.moveDown(0.6);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Fecha: ${inspectionDate}`);
    doc.text(`Cliente: ${clientName}`);
    doc.text(`Equipo: ${equipmentName}`);
    doc.text(`Responsable: ${responsible}`);
    doc.text(`Representante cliente: ${clientSigner}`);
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").text("Checklist de inspecciÃ³n");
    doc.moveDown(0.3);
    doc.font("Helvetica");

    checklistRows.forEach((row, index) => {
      doc.text(`${index + 1}. ${row.label}`, { continued: true });
      doc.font("Helvetica-Bold").text(`  [${row.answer}]`);
      doc.font("Helvetica");
    });

    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").text("Observaciones y recomendaciones");
    doc.font("Helvetica").text(observations || "Sin observaciones");
    doc.moveDown(0.2);
    doc.text(recommendations || "Sin recomendaciones");
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").text("Resultado de inspecciÃ³n");
    doc.font("Helvetica").text(resultLabel);

    if (result !== "compliant") {
      doc.text(`Fecha propuesta para seguimiento: ${formatDateEsLabel(followUpDate)}`);
    }

    doc.moveDown(0.6);
    doc.text("Firma Famproject: ________________________________");
    doc.text("Firma Cliente: __________________________________");
    doc.text("Sello Cliente: __________________________________");
    doc.moveDown(0.2);
    doc.fontSize(8).fillColor("#475569").text(`Generado por SPI el ${now.toISOString()}`);
    doc.end();
  });

  const safeClient = String(clientName).trim().replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80) || "Cliente";
  const fileName = `F.ST-07 - ${safeClient} - ${now.toISOString().slice(0, 10)}.pdf`;
  const stored = await uploadBase64File(fileName, pdfBuffer.toString("base64"), "application/pdf", folderId);
  const fileId = stored?.id || null;
  if (!fileId) {
    throw createAppError("No se pudo almacenar el documento F.ST-07 en Drive", {
      status: 500,
      code: "SITE_INSPECTION_REPORT_FAILED",
    });
  }

  const link = stored?.webViewLink || driveLink(fileId);
  if (request?.inspection_request_id) {
    try {
      await addDriveAttachment({
        request_id: request.inspection_request_id,
        drive_file_id: fileId,
        title: "F.ST-07 InspecciÃ³n de Ambiente",
      });
    } catch (attachmentError) {
      logger.warn(
        { attachmentError, purchaseRequestId: request?.id, inspectionRequestId: request?.inspection_request_id },
        "No se pudo adjuntar F.ST-07 a la solicitud tÃ©cnica",
      );
    }
  }

  return {
    file_id: fileId,
    link,
    generated_at: now.toISOString(),
  };
}

async function upsertReinspectionTechnicalActivity({ request, followUpDate, user }) {
  if (!request?.id || !followUpDate) return;
  const sourceType = "public_purchase_reinspection";
  const sourceId = String(request.id);
  const title = `ReinspecciÃ³n de ambiente - ${request.client_name || "cliente"}`;
  const notes = `ReinspecciÃ³n F.ST-07 para compra pÃºblica #${request.id}`;
  const { rows } = await db.query(
    `SELECT id
       FROM servicio.cronograma_actividades_tecnicas
      WHERE source_type = $1
        AND source_id = $2
      ORDER BY id DESC
      LIMIT 1`,
    [sourceType, sourceId],
  );
  if (rows[0]?.id) {
    await db.query(
      `UPDATE servicio.cronograma_actividades_tecnicas
          SET activity_date = $1,
              title = $2,
              notes = $3,
              status = 'programado',
              updated_at = now()
        WHERE id = $4`,
      [followUpDate, title, notes, rows[0].id],
    );
    return;
  }
  await db.query(
    `INSERT INTO servicio.cronograma_actividades_tecnicas (
        user_id, activity_date, title, notes, status, source_type, source_id, created_by, created_by_email, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'programado', $5, $6, $7, $8, now(), now())`,
    [
      Number.isFinite(Number(request?.inspection_coordinated_by)) ? Number(request.inspection_coordinated_by) : null,
      followUpDate,
      title,
      notes,
      sourceType,
      sourceId,
      Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
      user?.email || null,
    ],
  );
}

async function closeReinspectionTechnicalActivity(requestId) {
  if (!requestId) return;
  await db.query(
    `UPDATE servicio.cronograma_actividades_tecnicas
        SET status = 'completado',
            updated_at = now()
      WHERE source_type = 'public_purchase_reinspection'
        AND source_id = $1
        AND COALESCE(lower(status), 'programado') IN ('programado', 'confirmado', 'en_proceso')`,
    [String(requestId)],
  );
}

async function ensureAutoBusinessCaseForPurchase({ purchaseRequest, user, inspectionId }) {
  if (!purchaseRequest?.id) return null;
  const existingBcId = purchaseRequest.business_case_id || null;
  if (existingBcId) return existingBcId;

  const businessCaseService = require("../business-case/businessCase.service");
  const flowMetadata = {
    source_module: "equipment_purchases",
    source_trigger: "auto_after_signed_proforma_inspection",
    source_purchase_request_id: purchaseRequest.id,
    source_request_type: purchaseRequest.request_type || "purchase",
    source_client_name: purchaseRequest.client_name || null,
    source_inspection_request_id: inspectionId || null,
    source_inspection_min_date: purchaseRequest.inspection_min_date || null,
    source_inspection_max_date: purchaseRequest.inspection_max_date || null,
    auto_created: true,
  };

  const bc = await businessCaseService.createBusinessCase(
    {
      client_name: purchaseRequest.client_name || "Cliente",
      client_id: purchaseRequest.client_id || null,
      bc_purchase_type: "public",
      status: "draft",
      bc_stage: "pending_comercial",
      bc_progress: {
        source: "equipment_purchase",
        purchase_request_id: purchaseRequest.id,
      },
      assigned_to_email: purchaseRequest.assigned_to_email || user?.email || null,
      assigned_to_name: purchaseRequest.assigned_to_name || user?.fullname || user?.name || null,
      extra: {
        process_source: "equipment_purchase_auto",
        purchase_request_id: purchaseRequest.id,
        inspection_request_id: inspectionId || null,
        inspection_window: {
          min: purchaseRequest.inspection_min_date || null,
          max: purchaseRequest.inspection_max_date || null,
        },
      },
      modern_bc_metadata: flowMetadata,
    },
    user,
  );

  const bcId = bc?.business_case_id || bc?.id || null;
  if (!bcId) return null;

  await db.query(
    `UPDATE equipment_purchase_requests
        SET business_case_id = $1,
            updated_at = now()
      WHERE id = $2`,
    [bcId, purchaseRequest.id],
  );

  return bcId;
}

async function ensurePurchaseFolder(clientName) {
  const root = await getRootFolder();
  const comercialFolder = await ensureFolder(COMMERCIAL_FOLDER_NAME, root.id);
  const purchaseFolder = await ensureFolder(PURCHASE_FOLDER_NAME, comercialFolder.id);

  const safeName = (() => {
    const cleaned = String(clientName || "Cliente").trim().replace(/[\/\\:*?"<>|]/g, "-");
    return cleaned.length ? cleaned : "Cliente";
  })();

  const clientFolder = await ensureFolder(safeName, purchaseFolder.id);
  return clientFolder.id;
}

async function archiveEmail({ html, subject, folderId, prefix = "correo", request, actionLabel, user }) {
  const report = await buildReport({ subject, html, request, actionLabel, user });
  const base64 = report.toString("base64");
  const stored = await uploadBase64File(
    `${prefix}-${new Date().toISOString()}.pdf`,
    base64,
    "application/pdf",
    folderId,
  );
  return stored?.id || null;
}

// threadContext encadena los correos de una misma solicitud como respuestas
// del mismo hilo de Gmail en vez de crear un correo nuevo en cada etapa.
async function sendAndArchive({
  user,
  to,
  subject,
  html,
  cc,
  folderId,
  prefix,
  request,
  actionLabel,
  threadContext = null,
}) {
  const sendResult = await sendMail({
    to,
    cc,
    subject,
    html,
    gmailUserId: user?.id,
    from: user?.email,
    replyTo: user?.email,
    threadId: threadContext?.threadId || undefined,
    inReplyTo: threadContext?.lastMessageId || undefined,
    references: threadContext?.lastMessageId || undefined,
  });
  const fileId = await archiveEmail({ html, subject, folderId, prefix, request, actionLabel, user });
  return {
    fileId,
    threadId: sendResult?.providerThreadId || threadContext?.threadId || null,
    lastMessageId: sendResult?.rfc822MessageId || threadContext?.lastMessageId || null,
  };
}

async function getApprovedClients() {
  await ensureTables();
  const { rows } = await db.query(
    `SELECT id, commercial_name AS name, client_email, shipping_contact_name, shipping_phone, shipping_address
       FROM client_requests
      WHERE status = 'approved'
      ORDER BY commercial_name ASC`
  );
  return rows;
}

async function getAcpCommercialUsers() {
  const { rows } = await db.query(
    `SELECT id, email, fullname, name
       FROM users
      WHERE lower(role) = 'acp_comercial'
      ORDER BY fullname NULLS LAST, email ASC`,
  );

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.fullname || row.name || row.email,
  }));
}

async function getTechnicalInspectionUsers() {
  const { rows } = await db.query(
    `SELECT id, email, fullname, name, role
       FROM users
      WHERE active = true
        AND lower(role) IN ('tecnico', 'ing_servicio', 'jefe_tecnico', 'jefe_servicio', 'jefe_servicio_tecnico')
      ORDER BY
        CASE
          WHEN lower(role) IN ('jefe_tecnico', 'jefe_servicio', 'jefe_servicio_tecnico') THEN 0
          ELSE 1
        END,
        fullname NULLS LAST,
        email ASC`,
  );

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.fullname || row.name || row.email,
  }));
}

async function listProviderContacts({ user, query = "", limit = 50 }) {
  await ensureTables();
  if (!canManageAll(user)) {
    return [];
  }

  const normalizedQuery = String(query || "").trim().toLowerCase();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const params = [];
  let whereSql = "";

  if (normalizedQuery) {
    params.push(`%${normalizedQuery}%`);
    whereSql = `
      WHERE lower(email) LIKE $1
         OR lower(COALESCE(display_name, '')) LIKE $1
    `;
  }
  params.push(safeLimit);
  const limitParam = params.length;

  const { rows } = await db.query(
    `SELECT
        id,
        email,
        display_name,
        created_by,
        created_by_email,
        last_used_at,
        use_count,
        created_at,
        updated_at
      FROM equipment_purchase_provider_contacts
      ${whereSql}
      ORDER BY
        last_used_at DESC NULLS LAST,
        use_count DESC,
        updated_at DESC
      LIMIT $${limitParam}`,
    params,
  );

  return rows;
}

async function saveProviderContact({ user, email, display_name }) {
  if (!canManageAll(user)) {
    throw createAppError("Solo ACP Comercial puede registrar proveedores", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }
  return upsertProviderContact({
    email,
    displayName: display_name,
    user,
    markUsed: false,
  });
}

async function getEquipmentCatalog() {
  try {
    const modelos = await inventarioService.listModelos();
    if (Array.isArray(modelos) && modelos.length) {
      return modelos.map((row) => ({
        id: row.id,
        name: row.nombre || row.modelo || "Equipo",
        sku: row.sku,
        maker: row.fabricante || null,
        model: row.modelo || row.nombre || null,
        category: row.categoria || null,
      }));
    }
  } catch (error) {
    logger.warn("No se pudieron cargar modelos de equipos: %s", error.message);
  }

  const { rows } = await db.query(
    `SELECT u.id      AS unidad_id,
            u.serial,
            u.estado,
            m.nombre  AS modelo,
            m.sku,
            m.fabricante,
            m.categoria
       FROM public.equipos_unidad u
       JOIN public.equipos_modelo m ON m.id = u.modelo_id
      ORDER BY m.nombre ASC, u.id ASC`
  );

  if (rows.length) {
    return rows.map((row) => ({
      id: row.unidad_id,
      name: row.modelo,
      sku: row.sku,
      maker: row.fabricante,
      model: row.modelo,
      category: row.categoria,
      serial: row.serial,
      status: row.estado,
    }));
  }

  const items = await inventarioService.getAllInventario({ cliente_id: null, estado: "no_asignado" });
  return items.map((item) => ({
    id: item.inventory_id || item.id,
    name: item.item_name,
    sku: item.sku,
    serial: item.serial_number || item.serial || null,
    type: item.tipo || item.tipo_ultimo_movimiento || null,
  }));
}

async function listByUser(user) {
  await ensureTables();
  const params = [];
  // Los Business Cases viven en la misma tabla (request_type='business_case')
  // -- sin este filtro, cualquier BC en borrador se listaba mezclado con los
  // procesos de compra reales en el workspace de compras publicas.
  let query = `SELECT * FROM equipment_purchase_requests WHERE COALESCE(request_type, 'purchase') <> 'business_case'`;
  if (!canManageAll(user) && canCoordinateInspection(user)) {
    // BUG-05 (CP-04): jefe_tecnico ve toda la cola de inspecciÃ³n
    query += ` AND status = ANY($1::text[])
      AND (
        status = $2
        OR
        inspection_request_id IS NOT NULL
        OR (inspection_min_date IS NOT NULL AND inspection_max_date IS NOT NULL)
      )`;
    params.push([
      STATUS.WAITING_SIGNED_PROFORMA,
      STATUS.PENDING_CONTRACT,
      STATUS.CONTRACT_AVAILABLE,
      STATUS.DELIVERY_DATES_REQUESTED,
      STATUS.DELIVERY_DATES_SUBMITTED,
      STATUS.WAITING_DISPATCH,
      STATUS.DISPATCH_READY,
    ]);
    params.push(STATUS.WAITING_SIGNED_PROFORMA);
  } else if (!canManageAll(user) && canViewInspectionQueue(user)) {
    // BUG-05 (CP-04): tecnico (base) SOLO ve los expedientes que tiene asignados
    query += ` AND assigned_to = $1`;
    params.push(user.id);
  } else if (!canManageAll(user)) {
    query += ` AND (created_by = $1 OR assigned_to = $1)`;
    params.push(user.id);
  }

  query += ` ORDER BY created_at DESC`;

  const { rows } = await db.query(query, params);
  const mapped = rows.map(mapRequestRow);
  const withBusinessCase = await enrichRequestsWithAutoBusinessCaseStatus(mapped);
  const remapped = withBusinessCase.map(mapRequestRow);
  return enrichRequestsWithClientDocuments(remapped);
}

async function listTechnicalSchedule({ from, to, excludePublicRequestId = null, excludeInspectionRequestId = null }) {
  await ensureTables();
  const fromDate = String(from || "").slice(0, 10);
  const toDate = String(to || "").slice(0, 10);
  if (!fromDate || !toDate) return [];

  const relationExists = async (qualifiedName) => {
    const { rows } = await db.query(`SELECT to_regclass($1) IS NOT NULL AS exists`, [qualifiedName]);
    return Boolean(rows?.[0]?.exists);
  };

  const hasTechActivities = await relationExists("servicio.cronograma_actividades_tecnicas");
  const hasMaintenances = await relationExists("servicio.cronograma_mantenimientos");
  const hasTrainings = await relationExists("servicio.cronograma_capacitacion");
  const hasPublicPurchases = await relationExists("public.equipment_purchase_requests");
  const hasPrivatePurchases = await relationExists("public.private_purchase_requests");
  const hasRequests = await relationExists("public.requests");
  const hasRequestTypes = await relationExists("public.request_types");

  const unions = [];
  if (hasTechActivities) {
    unions.push(`
      SELECT
        a.activity_date::date AS activity_date,
        'actividad_tecnica'::text AS source_type,
        COALESCE(a.title, 'Actividad tÃ©cnica') AS summary
      FROM servicio.cronograma_actividades_tecnicas a
      WHERE a.activity_date BETWEEN $1::date AND $2::date
        AND COALESCE(lower(a.status), 'programado') IN ('programado', 'confirmado', 'en_proceso')
    `);
  }

  if (hasMaintenances) {
    unions.push(`
      SELECT
        m.fecha_programada::date AS activity_date,
        'mantenimiento'::text AS source_type,
        COALESCE(m.descripcion, 'Mantenimiento programado') AS summary
      FROM servicio.cronograma_mantenimientos m
      WHERE m.fecha_programada BETWEEN $1::date AND $2::date
        AND COALESCE(lower(m.estado), 'pendiente') IN ('pendiente', 'en proceso')
    `);
  }

  if (hasTrainings) {
    unions.push(`
      SELECT
        c.fecha::date AS activity_date,
        'capacitacion'::text AS source_type,
        COALESCE(c.titulo, 'CapacitaciÃ³n tÃ©cnica') AS summary
      FROM servicio.cronograma_capacitacion c
      WHERE c.fecha BETWEEN $1::date AND $2::date
        AND COALESCE(lower(c.estado), 'programado') NOT IN ('cancelada', 'cancelado')
    `);
  }

  if (hasPublicPurchases) {
    unions.push(`
      SELECT
        epr.inspection_scheduled_date::date AS activity_date,
        'inspeccion_compra_publica'::text AS source_type,
        COALESCE(epr.client_name, 'InspecciÃ³n compra pÃºblica') AS summary
      FROM equipment_purchase_requests epr
      WHERE epr.inspection_scheduled_date BETWEEN $1::date AND $2::date
        AND ($3::uuid IS NULL OR epr.id <> $3::uuid)
        AND (epr.status IS NULL OR epr.status::text NOT IN ('completed'))
    `);
  }

  if (hasPrivatePurchases) {
    unions.push(`
      SELECT
        ppr.inspection_scheduled_date::date AS activity_date,
        'inspeccion_compra_privada'::text AS source_type,
        COALESCE(
          to_jsonb(ppr)->>'client_name',
          to_jsonb(ppr)->'client_snapshot'->>'commercial_name',
          to_jsonb(ppr)->'client_snapshot'->>'client_name',
          'InspecciÃ³n compra privada'
        ) AS summary
      FROM private_purchase_requests ppr
      WHERE ppr.inspection_scheduled_date BETWEEN $1::date AND $2::date
        AND (ppr.status IS NULL OR ppr.status::text NOT IN ('completed', 'cancelled'))
    `);
  }

  if (hasRequests && hasRequestTypes) {
    unions.push(`
      SELECT
        (r.payload->>'fecha_instalacion')::date AS activity_date,
        'solicitud_inspeccion'::text AS source_type,
        COALESCE(r.payload->>'nombre_cliente', 'Solicitud de inspecciÃ³n') AS summary
      FROM requests r
      JOIN request_types rt ON rt.id = r.request_type_id
      WHERE rt.code = 'F.ST-20'
        AND (r.payload->>'fecha_instalacion') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        AND (r.payload->>'fecha_instalacion')::date BETWEEN $1::date AND $2::date
        AND ($4::int IS NULL OR r.id <> $4::int)
        AND COALESCE(r.status, '') NOT IN ('rechazado', 'cancelado')
    `);
  }

  if (!unions.length) return [];

  const { rows } = await db.query(
    `
      SELECT activity_date, source_type, summary
      FROM (
        ${unions.join("\nUNION ALL\n")}
      ) AS timeline
      WHERE ($3::uuid IS NULL OR $3::uuid IS NOT NULL)
        AND ($4::int IS NULL OR $4::int IS NOT NULL)
      ORDER BY activity_date ASC, source_type ASC
    `,
    [fromDate, toDate, excludePublicRequestId, excludeInspectionRequestId],
  );

  return rows;
}

function groupTechnicalScheduleByDate(rows = []) {
  const grouped = new Map();
  rows.forEach((row) => {
    const dateKey = String(row.activity_date || "").slice(0, 10);
    if (!dateKey) return;
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey).push({
      source_type: row.source_type,
      summary: row.summary,
    });
  });
  return Array.from(grouped.entries())
    .map(([date, items]) => ({ date, items }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function getTechnicalScheduleCalendar({ user, from, to }) {
  if (!canViewInspectionQueue(user) && !canCoordinateInspection(user) && !canManageAll(user)) {
    throw createAppError("No autorizado para consultar cronograma tÃ©cnico", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }
  let rows = [];
  try {
    rows = await listTechnicalSchedule({ from, to });
  } catch (error) {
    logger.error(
      { error: error?.message, from, to, user_id: user?.id },
      "Error consultando cronograma tÃ©cnico. Se devuelve calendario vacÃ­o",
    );
    rows = [];
  }
  return {
    from: String(from || "").slice(0, 10),
    to: String(to || "").slice(0, 10),
    days: groupTechnicalScheduleByDate(rows),
  };
}

async function getById(id, user) {
  await ensureTables();
  const { rows } = await db.query(`SELECT * FROM equipment_purchase_requests WHERE id = $1 LIMIT 1`, [id]);
  const row = rows[0];
  const isCreator = row?.created_by === user?.id;
  const isAssignee = row?.assigned_to === user?.id;
  const isInspectionViewer =
    canViewInspectionQueue(user) &&
    Boolean(
      row?.inspection_request_id ||
      (row?.inspection_min_date && row?.inspection_max_date),
    );
  if (!row || (!isCreator && !isAssignee && !canManageAll(user) && !isInspectionViewer)) return null;
  let mapped = mapRequestRow(row);

  if (!mapped.process_doc_link && PURCHASE_PROCESS_TEMPLATE_ID) {
    const clientInfo = await getClientDetails(row.client_id);
    mapped = await ensurePurchaseProcessDocument({ request: mapped, clientInfo });
  }

  const [withBusinessCase] = await enrichRequestsWithAutoBusinessCaseStatus([mapped]);
  const recalculated = mapRequestRow(withBusinessCase || mapped);
  const [withClientDocs] = await enrichRequestsWithClientDocuments([recalculated]);
  return withClientDocs || { ...mapped, client_documents: [] };
}

async function getUserById(id) {
  if (!id) return null;
  try {
    const { rows } = await db.query(
      `SELECT id, email, fullname, name, role
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  } catch (error) {
    logger.warn("No se pudo obtener datos de usuario %s: %s", id, error.message);
    return null;
  }
}

async function createPurchaseRequest({
  user,
  clientId,
  clientName,
  clientBusinessName,
  clientEmail,
  assignedTo,
  equipment = [],
  notes,
  extra,
  requestType = "purchase",
}) {
  await ensureTables();
  const normalizedClientName = String(clientName || clientBusinessName || "").trim();
  if (!normalizedClientName) {
    throw new Error("El cliente es obligatorio");
  }

  if (!equipment.length) {
    throw new Error("Cliente y al menos un equipo son obligatorios");
  }

  const canSendAvailability = canManageAll(user);
  const provider = null;

  const assigneeUser = assignedTo ? await getUserById(assignedTo) : null;
  const resolvedAssignee = assigneeUser || (canSendAvailability ? user : null);

  if (!resolvedAssignee) {
    throw new Error("Debes asignar la solicitud a un ACP Comercial");
  }

  const id = uuidv4();
  const createdAt = new Date();
  const folderId = await ensurePurchaseFolder(normalizedClientName);

  const extraPayload = {
    ...(extra || {}),
    requires_lis: Boolean(extra?.requires_lis),
    lis_system: extra?.requires_lis ? (extra?.lis_system || null) : null,
  };

  const emailFileId = null;
  const status = STATUS.PENDING_PROVIDER;

  const { rows } = await db.query(
    `INSERT INTO equipment_purchase_requests (
        id, created_by, created_by_email, assigned_to, assigned_to_email, assigned_to_name,
        client_id, client_name, client_email, notes, provider_email,
        equipment, status, availability_email_sent_at, availability_email_file_id, drive_folder_id, extra, request_type
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      id,
      user.id,
      user.email,
      resolvedAssignee?.id || null,
      resolvedAssignee?.email || null,
      resolvedAssignee?.fullname || resolvedAssignee?.name || resolvedAssignee?.email || null,
      clientId || null,
      normalizedClientName,
      clientEmail || null,
      notes || null,
      provider,
      JSON.stringify(equipment),
      status,
      null,
      emailFileId,
      folderId,
      JSON.stringify(extraPayload || {}),
      requestType || "purchase",
    ],
  );

  let created = mapRequestRow(rows[0]);

  let clientInfo = null;
  try {
    clientInfo = await getClientDetails(clientId);
  } catch (error) {
    logger.warn("No se pudieron obtener los datos del cliente %s: %s", clientId, error.message);
  }

  try {
    created = await ensurePurchaseProcessDocument({ request: created, clientInfo });
  } catch (error) {
    logger.warn("No se pudo crear documento base del proceso de compra: %s", error.message);
  }

  try {
    await notifyUsers({
      userIds: [created.created_by, created.assigned_to].filter((id) => id && id !== created.created_by),
      title: "Nueva solicitud de compra pÃºblica",
      message: `${created.client_name || "Cliente"} Â· Solicitud creada`,
      type: "task",
      source: "equipment_purchases",
      priority: 1,
      email: false,
      chat: false,
      meta: {
        request_id: created.id,
        client_name: created.client_name,
        queue_start_event: "business_case_general_saved",
      },
    });
    await notifyUsers({
      userIds: [created.created_by],
      title: "Solicitud enviada",
      message: "Tu solicitud de compra pÃºblica fue enviada para aprobaciÃ³n.",
      type: "info",
      source: "equipment_purchases",
      priority: 0,
      email: false,
      chat: false,
      meta: {
        request_id: created.id,
        client_name: created.client_name,
        queue_start_event: "business_case_general_saved",
      },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: created.id }, "No se pudieron enviar notificaciones de creaciÃ³n");
  }

  return created;
}

async function startAvailabilityRequest({ id, user, providerEmail, notes, expected_updated_at }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);
  const isAssignee = String(request?.assigned_to || "") === String(user?.id || "");
  if (!canManageAll(user) && !isAssignee) {
    throw createAppError("Solo el ACP Comercial asignado puede enviar el correo de disponibilidad", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }
  assertNoStaleWrite(request, expected_updated_at);
  if (!providerEmail) throw createAppError("El correo del proveedor es obligatorio", { code: "PROVIDER_EMAIL_REQUIRED" });
  assertActionStatus(request, "start_availability");

  const equipment = Array.isArray(request.equipment) ? request.equipment : [];
  if (!equipment.length) throw createAppError("No hay equipos registrados para solicitar disponibilidad", {
    code: "EMPTY_EQUIPMENT_LIST",
  });
  // Permite validar checklist con el correo/notas que ACP estÃ¡ ingresando en esta misma acciÃ³n.
  const requestForChecklist = {
    ...request,
    provider_email: providerEmail || request.provider_email,
    notes: notes || request.notes,
  };
  // Para iniciar disponibilidad ACP solo requiere datos base de solicitud + correo proveedor.
  // No bloquear este paso por checklist dinÃ¡mico.
  if (!requestForChecklist.client_name) {
    throw createAppError("La solicitud debe tener cliente para enviar disponibilidad", {
      status: 409,
      code: "CHECKLIST_INCOMPLETE",
      details: { action: "start_availability", pending: ["client_confirmed"] },
    });
  }

  const equipmentList = equipment
    .map((item) => {
      const typeLabel = item.type === "cu"
        ? " (CU)"
        : item.type === "new_import"
          ? " (Nuevo para importaciÃ³n)"
          : item.type === "installed_client"
            ? " (Instalado en cliente)"
            : " (Nuevo disponible)";
      const name = item.name || item.sku || "Equipo";
      return `â€¢ ${name}${typeLabel}`;
    })
    .join("<br>");

  const html = renderProviderEmail({
    title: "Solicitud de disponibilidad de equipos",
    bodyHtml: `
      <p>Nos gustaría confirmar la disponibilidad de los siguientes equipos para la solicitud <strong>#${request.id}</strong>:</p>
      <p>${equipmentList}</p>
      ${notes ? `<p><strong>Notas:</strong> ${notes}</p>` : request.notes ? `<p><strong>Notas:</strong> ${request.notes}</p>` : ""}
    `,
    user,
    requestId: request.id,
  });

  const requestSnapshot = {
    id: request.id,
    client_name: request.client_name,
    provider_email: providerEmail,
    equipment,
    created_at: request.created_at,
    notes: notes || request.notes,
  };

  const { fileId: emailFileId, threadId, lastMessageId } = await sendAndArchive({
    user,
    to: providerEmail,
    subject: `Solicitud de equipos - ${request.client_name || "Cliente pendiente"} (#${String(request.id).slice(0, 8)})`,
    html,
    folderId: request.drive_folder_id,
    prefix: "disponibilidad",
    request: requestSnapshot,
    actionLabel: "Informe de disponibilidad de equipos",
  });

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET provider_email = $1,
            notes = $2,
            status = $3,
            availability_email_sent_at = now(),
            availability_email_file_id = $4,
            availability_status = 'supplier_requested',
            provider_email_thread_id = $6,
            provider_email_last_message_id = $7,
            disponibilidad_last_actor_email = $8,
            updated_at = now()
      WHERE id = $5
      RETURNING *`,
    [providerEmail, notes || request.notes || null, STATUS.WAITING_PROVIDER, emailFileId, id, threadId, lastMessageId, user?.email || null],
  );
  await upsertProviderContact({
    email: providerEmail,
    user,
    markUsed: true,
  });

  return mapRequestRow(rows[0]);
}

async function saveProviderResponse({ id, user, outcome, items = [], notes, expected_updated_at }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  if (!request.availability_email_sent_at) {
    throw createAppError("Debe enviar el correo de disponibilidad antes de registrar respuesta", {
      status: 409,
      code: "AVAILABILITY_EMAIL_NOT_SENT",
    });
  }
  assertActionStatus(request, "save_provider_response");

  /*
   * outcome values:
   *   'none' | 'unavailable' â†’ sin stock         â†’ NO_STOCK / supplier_rejected
   *   'cu_only'              â†’ solo en CU         â†’ WAITING_CLIENT_CU_APPROVAL / cu_available_pending_approval
   *   'import_new'           â†’ solo vÃ­a importaciÃ³n â†’ WAITING_ACP_IMPORT_CONFIRMATION / import_pending_acp_confirmation
   *   anything else ('new')  â†’ stock disponible  â†’ WAITING_PROFORMA / availability_confirmed
   */
  const isUnavailable = outcome === "none" || outcome === "unavailable";
  const isCuOnly      = outcome === "cu_only";
  const isImportNew   = outcome === "import_new";

  const normalizedOutcome = isUnavailable
    ? STATUS.NO_STOCK
    : isCuOnly
      ? STATUS.WAITING_CLIENT_CU_APPROVAL
      : isImportNew
        ? STATUS.WAITING_ACP_IMPORT_CONFIRMATION
        : STATUS.WAITING_PROFORMA;

  const availabilityStatus = isUnavailable
    ? "supplier_rejected"
    : isCuOnly
      ? "cu_available_pending_approval"
      : isImportNew
        ? "import_pending_acp_confirmation"
        : "availability_confirmed";

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET provider_response = $1,
            provider_response_at = now(),
            status = $2,
            availability_status = $4,
            disponibilidad_last_actor_email = $5,
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [
      { outcome, items, notes },
      normalizedOutcome,
      id,
      availabilityStatus,
      user?.email || null,
    ],
  );
  const updated = rows[0];
  try {
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title: "Respuesta de disponibilidad",
      message: `Proveedor respondiÃ³ disponibilidad para ${updated.client_name || "cliente"}.`,
      type: "info",
      source: "equipment_purchases",
      priority: 1,
      meta: { request_id: updated.id },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated.id }, "No se pudieron enviar notificaciones de disponibilidad");
  }
  return updated;
}

/**
 * DecisiÃ³n del cliente (vÃ­a comercial) sobre disponibilidad en CU.
 *   decision === 'approve' â†’ availability_confirmed / WAITING_PROFORMA  (flujo continÃºa)
 *   decision === 'reject'  â†’ supplier_rejected    / rejected            (flujo termina)
 */
async function confirmCuAvailability({ id, user, decision, expected_updated_at }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "confirm_cu_availability");

  const approved = String(decision || "").toLowerCase() === "approve";

  const newStatus             = approved ? STATUS.WAITING_PROFORMA : "rejected";
  const newAvailabilityStatus = approved ? "availability_confirmed" : "supplier_rejected";

  // Fetch current extra to preserve it
  const currentExtra = request.extra || {};
  const nextExtra = {
    ...currentExtra,
    cu_approval_decision: approved ? "approve" : "reject",
    cu_approved_at: new Date().toISOString(),
    cu_approved_by_email: user?.email || null,
  };

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET status              = $1,
            availability_status = $2,
            extra               = $4::jsonb,
            updated_at          = now()
      WHERE id = $3
      RETURNING *`,
    [newStatus, newAvailabilityStatus, id, JSON.stringify(nextExtra)],
  );
  const updated = rows[0];

  try {
    const msgSuffix = approved
      ? "El cliente aceptÃ³ disponibilidad en condiciÃ³n de uso. Registra la respuesta del proveedor para continuar."
      : "El cliente rechazÃ³ la disponibilidad en condiciÃ³n de uso. Flujo finalizado.";

    // Notify the purchase creator + assigned user
    const baseUserIds = [updated.created_by, updated.assigned_to].filter(Boolean);

    // On approval, also notify all acp_comercial users so they can re-register the provider response
    if (approved) {
      try {
        const acpUsers = await getAcpCommercialUsers();
        const acpIds = acpUsers.map((u) => u.id).filter(Boolean);
        const allIds = Array.from(new Set([...baseUserIds, ...acpIds]));
        await notifyUsers({
          userIds: allIds,
          title: "Cliente aceptÃ³ CU â€” acciÃ³n requerida",
          message: `El cliente aprobÃ³ disponibilidad en condiciÃ³n de uso para ${updated.client_name || "un expediente"}. Registra la respuesta del proveedor para continuar con la proforma.`,
          type: "info",
          source: "equipment_purchases",
          priority: 2,
          meta: { request_id: updated.id },
        });
      } catch (notifyError) {
        logger.warn({ notifyError, requestId: updated.id }, "No se pudieron enviar notificaciones CU a ACP");
      }
    } else {
      await notifyUsers({
        userIds: baseUserIds,
        title: "DecisiÃ³n disponibilidad CU",
        message: msgSuffix,
        type: "warning",
        source: "equipment_purchases",
        priority: 1,
        meta: { request_id: updated.id },
      });
    }
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated.id }, "No se pudieron enviar notificaciones de decisiÃ³n CU");
  }

  return updated;
}

/**
 * ACP confirma que es consciente del compromiso de importaciÃ³n y que tiene al cliente
 * suficientemente asegurado para proceder.
 * No hay "rechazo" â€” si ACP no estÃ¡ seguro simplemente no confirma.
 * Al confirmar â†’ WAITING_PROFORMA / availability_confirmed + flag extra.import_is_confirmed_by_acp
 */
async function confirmAcpImportAwareness({ id, user, expected_updated_at }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "confirm_acp_import_awareness");

  const nextExtra = {
    ...(request.extra || {}),
    import_is_confirmed_by_acp: true,
    import_acp_confirmed_at: new Date().toISOString(),
    import_acp_confirmed_by_email: user?.email || null,
  };

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET status              = $1,
            availability_status = $2,
            extra               = $4::jsonb,
            updated_at          = now()
      WHERE id = $3
      RETURNING *`,
    [STATUS.WAITING_PROFORMA, "availability_confirmed", id, JSON.stringify(nextExtra)],
  );
  const updated = rows[0];

  // Notify all ACP commercial users of the commitment
  try {
    const acpUsers = await getAcpCommercialUsers();
    const acpIds   = acpUsers.map((u) => u.id).filter(Boolean);
    const allIds   = Array.from(new Set([updated.created_by, updated.assigned_to, ...acpIds].filter(Boolean)));
    await notifyUsers({
      userIds: allIds,
      title: "âš ï¸ ImportaciÃ³n confirmada â€” compromiso ACP",
      message: `ACP confirmÃ³ proceder con importaciÃ³n para ${updated.client_name || "un expediente"}. Esta acciÃ³n es irreversible â€” se debe tener al cliente comprometido.`,
      type: "warning",
      source: "equipment_purchases",
      priority: 3,
      meta: { request_id: updated.id },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated.id }, "No se pudo notificar confirmaciÃ³n de importaciÃ³n ACP");
  }

  return updated;
}

async function requestProforma({ id, user, expected_updated_at }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "request_or_upload_proforma");

  const acceptedItems = getAcceptedItems(request);

  if (acceptedItems.length === 0) {
    throw createAppError("No hay equipos aceptados para solicitar proforma", {
      code: "NO_ACCEPTED_EQUIPMENT",
    });
  }
  assertChecklistReady(request, "request_or_upload_proforma");
  const lastRequestedAt = request.proforma_requested_at ? new Date(request.proforma_requested_at) : null;
  if (lastRequestedAt && !Number.isNaN(lastRequestedAt.getTime())) {
    const retryAt = new Date(lastRequestedAt.getTime() + PROFORMA_REQUEST_COOLDOWN_MS);
    const now = Date.now();
    if (!request.proforma_file_id && now < retryAt.getTime()) {
      const remainingMinutes = Math.ceil((retryAt.getTime() - now) / 60000);
      throw createAppError(
        `La proforma ya fue solicitada recientemente. Reintenta en ${remainingMinutes} minuto(s).`,
        {
          status: 409,
          code: "PROFORMA_REQUEST_LOCKED",
          details: {
            retry_available_at: retryAt.toISOString(),
            retry_in_seconds: Math.ceil((retryAt.getTime() - now) / 1000),
          },
          retryable: true,
        },
      );
    }
  }

  const html = renderProviderEmail({
    title: "Solicitud de proforma",
    bodyHtml: `
      <p>Por favor envíanos la proforma de los siguientes equipos para la solicitud <strong>#${request.id}</strong>:</p>
      ${formatEquipmentList(acceptedItems)}
    `,
    user,
    requestId: request.id,
  });

  const { fileId: emailFileId, threadId, lastMessageId } = await sendAndArchive({
    user,
    to: request.provider_email,
    subject: `${request.provider_email_thread_id ? "Re: " : ""}Solicitud de equipos - ${request.client_name || "Cliente pendiente"} (#${String(request.id).slice(0, 8)})`,
    html,
    folderId: request.drive_folder_id,
    prefix: "proforma",
    request,
    actionLabel: "Solicitud de proforma",
    threadContext: {
      threadId: request.provider_email_thread_id,
      lastMessageId: request.provider_email_last_message_id,
    },
  });

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET status = $1,
            proforma_requested_at = now(),
            proforma_request_email_file_id = $2,
            provider_email_thread_id = $4,
            provider_email_last_message_id = $5,
            disponibilidad_last_actor_email = $6,
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [STATUS.WAITING_PROFORMA, emailFileId, id, threadId, lastMessageId, user?.email || null],
  );
  const updated = rows[0];
  try {
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title: "Proforma solicitada",
      message: `Se solicitÃ³ la proforma para ${updated.client_name || "cliente"}.`,
      type: "info",
      source: "equipment_purchases",
      priority: 1,
      meta: { request_id: updated.id },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated.id }, "No se pudieron enviar notificaciones de proforma solicitada");
  }
  return mapRequestRow(updated);
}

async function uploadDocument(file, folderId, prefix) {
  if (!file) throw createAppError("Archivo requerido", { code: "FILE_REQUIRED" });
  const base64 = file.buffer.toString("base64");
  const saved = await uploadBase64File(file.originalname || `${prefix}.pdf`, base64, file.mimetype, folderId);
  return saved?.id;
}

async function uploadProforma({ id, user, file, expected_updated_at }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "request_or_upload_proforma");
  // La carga de proforma es precisamente la acciÃ³n que completa este paso.
  // No se debe bloquear por checklist previo en este punto.

  const fileId = await uploadDocument(file, request.drive_folder_id, "proforma");
  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET proforma_file_id = $1,
            proforma_uploaded_at = now(),
            status = $2,
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [fileId, STATUS.PROFORMA_RECEIVED, id],
  );
  const updated = mapRequestRow(rows[0]);
  const commercialUser = updated?.created_by ? await getUserById(updated.created_by) : null;

  try {
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title: "Proforma recibida",
      message: `Se recibiÃ³ la proforma para ${updated.client_name || "cliente"}.`,
      type: "info",
      source: "equipment_purchases",
      priority: 1,
      meta: { request_id: updated.id },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated.id }, "No se pudieron enviar notificaciones de proforma");
  }

  return updated;
}

async function reserveEquipment({ id, user, expected_updated_at }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "reserve_equipment");

  const acceptedItems = getAcceptedItems(request);
  if (!acceptedItems.length) {
    throw createAppError("No hay equipos aceptados para enviar reserva", { code: "NO_ACCEPTED_EQUIPMENT" });
  }
  assertChecklistReady(request, "reserve_equipment");

  const html = renderProviderEmail({
    title: "Confirmación de reserva de equipos",
    bodyHtml: `
      <p>Solicitamos reservar los equipos cotizados para la solicitud <strong>#${request.id}</strong>.</p>
      <p>Adjuntamos la proforma recibida y confirmamos reserva para:</p>
      ${formatEquipmentList(acceptedItems)}
    `,
    user,
    requestId: request.id,
  });

  const { fileId: emailFileId, threadId, lastMessageId } = await sendAndArchive({
    user,
    to: request.provider_email,
    subject: `${request.provider_email_thread_id ? "Re: " : ""}Solicitud de equipos - ${request.client_name || "Cliente pendiente"} (#${String(request.id).slice(0, 8)})`,
    html,
    folderId: request.drive_folder_id,
    prefix: "reserva",
    request,
    actionLabel: "ConfirmaciÃ³n de reserva",
    threadContext: {
      threadId: request.provider_email_thread_id,
      lastMessageId: request.provider_email_last_message_id,
    },
  });

  const reservationExpiresAt = new Date();
  reservationExpiresAt.setDate(reservationExpiresAt.getDate() + RESERVATION_VALIDITY_DAYS);

  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() + RESERVATION_REMINDER_OFFSET_DAYS);
  let calendarEvent = {};
  try {
    calendarEvent = await createAllDayEvent({
      summary: `âš ï¸ Reserva por vencer â€” ${request.client_name}`,
      description: `La reserva de equipo vence el ${reservationExpiresAt.toLocaleDateString('es-EC')}. Confirma proforma firmada o renueva la reserva con el proveedor.`,
      date: reminderDate,
      attendees: [user.email].filter(Boolean),
    });
  } catch (error) {
    logger.warn("No se pudo crear recordatorio de reserva en Calendar: %s", error.message);
  }

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET status = $1,
            reservation_email_sent_at = now(),
            reservation_expires_at = $2,
            reservation_email_file_id = $3,
            reservation_calendar_event_id = $4,
            reservation_calendar_event_link = $5,
            provider_email_thread_id = $7,
            provider_email_last_message_id = $8,
            disponibilidad_last_actor_email = $9,
            updated_at = now()
      WHERE id = $6
      RETURNING *`,
    [
      STATUS.WAITING_SIGNED_PROFORMA,
      reservationExpiresAt,
      emailFileId,
      calendarEvent.id || null,
      calendarEvent.htmlLink || null,
      id,
      threadId,
      lastMessageId,
      user?.email || null,
    ],
  );
  const updated = rows[0];
  try {
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title: "Reserva enviada",
      message: `Se enviÃ³ la reserva para ${updated.client_name || "cliente"}.`,
      type: "info",
      source: "equipment_purchases",
      priority: 1,
      meta: { request_id: updated.id },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated.id }, "No se pudieron enviar notificaciones de reserva");
  }
  return updated;
}

async function uploadSignedProforma({
  id,
  user,
  file,
  inspection_min_date,
  inspection_max_date,
  includes_starter_kit,
  expected_updated_at,
}) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "submit_signed_with_inspection");

  const fileId = await uploadDocument(file, request.drive_folder_id, "proforma-firmada");

  const acceptedItems = getAcceptedItems(request);
  const arrivalHtml = renderProviderEmail({
    title: "Confirmación de tiempo de llegada",
    bodyHtml: `
      <p>Hemos recibido la proforma firmada asociada a la solicitud <strong>#${request.id}</strong>.</p>
      <p>Por favor confirma el tiempo de llegada de los siguientes equipos:</p>
      ${formatEquipmentList(acceptedItems)}
    `,
    user,
    requestId: request.id,
  });

  const { fileId: arrivalFileId, threadId: arrivalThreadId, lastMessageId: arrivalLastMessageId } = await sendAndArchive({
    user,
    to: request.provider_email,
    subject: `${request.provider_email_thread_id ? "Re: " : ""}Solicitud de equipos - ${request.client_name || "Cliente pendiente"} (#${String(request.id).slice(0, 8)})`,
    html: arrivalHtml,
    folderId: request.drive_folder_id,
    prefix: "tiempo-llegada",
    request,
    actionLabel: "Solicitud de tiempo de llegada",
    threadContext: {
      threadId: request.provider_email_thread_id,
      lastMessageId: request.provider_email_last_message_id,
    },
  });

  const signedAt = new Date();
  const dueDate = new Date(signedAt);
  dueDate.setUTCDate(dueDate.getUTCDate() + CONTRACT_MAX_DAYS);
  const reminderAttendees = Array.from(
    new Set(
      [request.assigned_to_email, request.created_by_email, user?.email]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  let contractReminder = {};
  try {
    contractReminder = await createAllDayEvent({
      summary: `Vencimiento contrato firmado - ${request.client_name}`,
      description: `La proforma firmada tiene ${CONTRACT_MAX_DAYS} dias para completar contrato. Recordatorio ${CONTRACT_REMINDER_DAYS_BEFORE} dias antes.`,
      date: dueDate,
      reminderMinutesBefore: CONTRACT_REMINDER_MINUTES_BEFORE,
      attendees: reminderAttendees,
    });
  } catch (error) {
    logger.warn("No se pudo crear recordatorio de contrato en Calendar: %s", error.message);
  }

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET signed_proforma_file_id = $1,
            signed_proforma_uploaded_at = now(),
            arrival_eta_email_sent_at = now(),
            arrival_eta_email_file_id = $2,
            includes_starter_kit = $3,
            contract_reminder_event_id = $4,
            contract_reminder_event_link = $5,
            contract_reminder_email_sent_at = NULL,
            contract_reminder_email_to = NULL,
            status = $6,
            provider_email_thread_id = $8,
            provider_email_last_message_id = $9,
            disponibilidad_last_actor_email = $10,
            updated_at = now()
      WHERE id = $7
      RETURNING *`,
    [
      fileId,
      arrivalFileId,
      includes_starter_kit === true,
      contractReminder.id || null,
      contractReminder.htmlLink || null,
      STATUS.PENDING_CONTRACT,
      id,
      arrivalThreadId,
      arrivalLastMessageId,
      user?.email || null,
    ],
  );
  const updated = rows[0];
  try {
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title: "Proforma firmada",
      message: `Se subiÃ³ la proforma firmada para ${updated.client_name || "cliente"}.`,
      type: "info",
      source: "equipment_purchases",
      priority: 1,
      meta: { request_id: updated.id },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated.id }, "No se pudieron enviar notificaciones de proforma firmada");
  }
  return updated;
}

async function submitSignedProformaWithInspection({
  id,
  user,
  file,
  includes_starter_kit,
  expected_updated_at,
}) {
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "submit_signed_with_inspection");
  assertChecklistReady(request, "submit_signed_with_inspection");

  const signedResult = await uploadSignedProforma({
    id,
    user,
    file,
    includes_starter_kit,
    expected_updated_at,
  });

  try {
    const autoBusinessCaseId = await ensureAutoBusinessCaseForPurchase({
      purchaseRequest: signedResult,
      user,
      inspectionId: null,
    });
    if (autoBusinessCaseId) {
      await notifyUsers({
        userIds: [signedResult?.created_by, signedResult?.assigned_to],
        title: "Business Case creado automaticamente",
        message: `Se creo el BC ${autoBusinessCaseId} para ${signedResult?.client_name || "cliente"}. La inspeccion de ambiente se gestiona en el BC.`,
        type: "task",
        source: "equipment_purchases",
        priority: 1,
        meta: {
          request_id: signedResult?.id,
          business_case_id: autoBusinessCaseId,
          auto_created: true,
          inspection_source: "business_case",
        },
      });
    }
  } catch (bcError) {
    logger.error({ bcError, requestId: signedResult?.id }, "No se pudo crear BC automatico para compra publica");
  }

  return { purchase_request: signedResult, inspection_request: null };
}
async function requestInspectionEnvironment({
  id,
  user,
  inspection_min_date,
  inspection_max_date,
  includes_starter_kit,
  expected_updated_at,
}) {
  await ensureTables();
  if (!inspection_min_date || !inspection_max_date) {
    throw createAppError("Las fechas de inspecciÃ³n mÃ­nima y mÃ¡xima son obligatorias", {
      code: "INSPECTION_WINDOW_REQUIRED",
    });
  }

  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "request_inspection");
  assertChecklistReady(request, "request_inspection");

  let inspectionId = request.inspection_request_id || null;
  let inspectionActaFileId = request.extra?.inspection_acta_file_id || null;
  let inspectionActaLink = request.extra?.inspection_acta_link || null;
  let inspectionWithActa = null;

  if (!inspectionId) {
    const clientInfo = await getClientDetails(request.client_id);
    const payload = await buildInspectionPayload({
      request,
      clientInfo,
      inspection_min_date,
      inspection_max_date,
      includes_starter_kit,
    });

    const inspectionRequest = await createServiceRequest({
      requester_id: user.id,
      requester_email: user.email,
      requester_name: user.fullname || user.name || null,
      request_type_id: "F.ST-20",
      payload,
    });

    inspectionWithActa = await ensureActaForInspection({
      inspectionRequest,
      user,
    });

    inspectionId = inspectionWithActa?.request?.id || inspectionRequest?.request?.id || null;
    inspectionActaFileId =
      inspectionWithActa?.document?.pdfId ||
      inspectionWithActa?.document?.id ||
      inspectionRequest?.document?.pdfId ||
      inspectionRequest?.document?.id ||
      null;
    inspectionActaLink =
      inspectionWithActa?.document?.pdfLink ||
      inspectionWithActa?.document?.link ||
      inspectionRequest?.document?.pdfLink ||
      inspectionRequest?.document?.link ||
      null;

    if (request?.signed_proforma_file_id && inspectionId) {
      await addDriveAttachment({
        request_id: inspectionId,
        drive_file_id: request.signed_proforma_file_id,
        title: "Proforma firmada",
      });
    }
  } else if (!inspectionActaFileId || !inspectionActaLink) {
    try {
      const regeneratedActa = await generateActa(inspectionId, user.id, "inspection");
      await markRequestActaGenerated(inspectionId);
      inspectionActaFileId =
        regeneratedActa?.pdfId ||
        regeneratedActa?.id ||
        inspectionActaFileId ||
        null;
      inspectionActaLink =
        regeneratedActa?.pdfLink ||
        regeneratedActa?.link ||
        inspectionActaLink ||
        null;
    } catch (actaError) {
      logger.error(
        { actaError, purchaseRequestId: id, inspectionRequestId: inspectionId },
        "No se pudo regenerar F.ST-20 para solicitud de inspeccion existente",
      );
    }
  }

  const mergedExtra = mergeExtra(request?.extra, {
    inspection_acta_file_id: inspectionActaFileId,
    inspection_acta_link: inspectionActaLink,
    inspection_acta_generated_at: new Date().toISOString(),
  });

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET inspection_request_id = COALESCE($1, inspection_request_id),
            inspection_min_date = $2,
            inspection_max_date = $3,
            includes_starter_kit = $4,
            inspection_recorded_at = now(),
            inspection_proposed_date = NULL,
            inspection_proposed_notes = NULL,
            inspection_proposed_at = NULL,
            inspection_proposed_by = NULL,
            inspection_proposed_by_email = NULL,
            inspection_coordination_status = 'pending_proposal',
            inspection_review_notes = NULL,
            inspection_reviewed_at = NULL,
            inspection_reviewed_by = NULL,
            inspection_reviewed_by_email = NULL,
            inspection_scheduled_date = NULL,
            inspection_coordinated_at = NULL,
            inspection_coordinated_by = NULL,
            inspection_coordinated_by_email = NULL,
            extra = $5::jsonb,
            updated_at = now()
      WHERE id = $6
      RETURNING *`,
    [
      inspectionId,
      inspection_min_date,
      inspection_max_date,
      includes_starter_kit === true,
      JSON.stringify(mergedExtra),
      id,
    ],
  );

  const updated = rows[0];
  try {
    await notifyUsers({
      userIds: [updated?.created_by, updated?.assigned_to],
      title: "InspecciÃ³n de ambiente solicitada",
      message: `Se registrÃ³ solicitud de inspecciÃ³n para ${updated?.client_name || "cliente"}.`,
      type: "info",
      source: "equipment_purchases",
      priority: 1,
      meta: { request_id: updated?.id, inspection_id: inspectionId || null },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated?.id }, "No se pudieron enviar notificaciones de solicitud de inspecciÃ³n");
  }

  try {
    const autoBusinessCaseId = await ensureAutoBusinessCaseForPurchase({
      purchaseRequest: updated,
      user,
      inspectionId,
    });
    if (autoBusinessCaseId) {
      await notifyUsers({
        userIds: [updated?.created_by, updated?.assigned_to],
        title: "Business Case creado automÃ¡ticamente",
        message: `Se creÃ³ el BC ${autoBusinessCaseId} para ${updated?.client_name || "cliente"}.`,
        type: "task",
        source: "equipment_purchases",
        priority: 1,
        meta: {
          request_id: updated?.id,
          business_case_id: autoBusinessCaseId,
          auto_created: true,
        },
      });
    }
  } catch (bcError) {
    logger.error({ bcError, requestId: updated?.id }, "No se pudo crear BC automÃ¡tico al solicitar inspecciÃ³n");
  }

  return {
    purchase_request: mapRequestRow(updated),
    inspection_request: inspectionWithActa,
  };
}

async function coordinateInspectionDate({
  id,
  user,
  inspection_date,
  notes,
  assigned_technician_id,
  expected_updated_at,
}) {
  await ensureTables();

  if (!canCoordinateInspection(user)) {
    throw createAppError("No autorizado para coordinar fecha de inspecciÃ³n", {
      status: 403,
      code: "FORBIDDEN_COORDINATION",
    });
  }

  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "coordinate_inspection_date");
  if (!request.inspection_min_date || !request.inspection_max_date) {
    throw createAppError("Primero define la ventana mÃ­nima y mÃ¡xima de inspecciÃ³n", {
      status: 409,
      code: "INSPECTION_WINDOW_REQUIRED",
    });
  }
  if (!inspection_date) {
    throw createAppError("La fecha coordinada de inspecciÃ³n es obligatoria", {
      status: 400,
      code: "INSPECTION_DATE_REQUIRED",
    });
  }

  const normalizedInspectionDate = normalizeDateOnlyInput(inspection_date);
  const normalizedMinDate = normalizeDateOnlyInput(request.inspection_min_date);
  const normalizedMaxDate = normalizeDateOnlyInput(request.inspection_max_date);
  const scheduled = new Date(`${normalizedInspectionDate}T00:00:00`);
  const minDate = new Date(`${normalizedMinDate}T00:00:00`);
  const maxDate = new Date(`${normalizedMaxDate}T00:00:00`);
  if (
    !normalizedInspectionDate ||
    !normalizedMinDate ||
    !normalizedMaxDate ||
    Number.isNaN(scheduled.getTime()) ||
    Number.isNaN(minDate.getTime()) ||
    Number.isNaN(maxDate.getTime())
  ) {
    throw createAppError("Formato de fecha invÃ¡lido para coordinaciÃ³n", {
      status: 400,
      code: "INVALID_DATE_FORMAT",
    });
  }

  if (scheduled.getTime() < minDate.getTime() || scheduled.getTime() > maxDate.getTime()) {
    throw createAppError("La fecha coordinada debe estar dentro de la ventana de inspecciÃ³n", {
      status: 409,
      code: "INSPECTION_DATE_OUT_OF_WINDOW",
      details: {
        min_date: normalizedMinDate,
        max_date: normalizedMaxDate,
      },
    });
  }

  const conflictRows = await listTechnicalSchedule({
    from: normalizedInspectionDate,
    to: normalizedInspectionDate,
    excludePublicRequestId: id,
    excludeInspectionRequestId: request.inspection_request_id || null,
  });
  if (conflictRows.length >= TECHNICAL_DAILY_CAPACITY) {
    throw createAppError(
      "El cronograma tÃ©cnico estÃ¡ lleno para esa fecha. Selecciona otro dÃ­a.",
      {
        status: 409,
        code: "TECHNICAL_SCHEDULE_FULL",
        details: {
          date: inspection_date,
          normalized_date: normalizedInspectionDate,
          capacity: TECHNICAL_DAILY_CAPACITY,
          conflicts_count: conflictRows.length,
          conflicts: conflictRows.map((item) => ({
            source_type: item.source_type,
            summary: item.summary,
          })),
        },
      },
    );
  }

  if (!request.inspection_request_id) {
    throw createAppError("No existe solicitud de inspecciÃ³n asociada para coordinar la fecha", {
      status: 409,
      code: "INSPECTION_REQUEST_REQUIRED",
    });
  }

  const parsedAssignedId = Number.parseInt(assigned_technician_id, 10);
  const resolvedAssignedId =
    Number.isFinite(parsedAssignedId) && parsedAssignedId > 0
      ? parsedAssignedId
      : (Number.isFinite(Number(user?.id)) ? Number(user.id) : null);
  if (!resolvedAssignedId) {
    throw createAppError("Debes asignar un tÃ©cnico para la visita de inspecciÃ³n", {
      status: 400,
      code: "TECHNICAL_ASSIGNEE_REQUIRED",
    });
  }
  const assignedTechnician = await getUserById(resolvedAssignedId);
  if (!assignedTechnician || !canRegisterSiteInspection(assignedTechnician)) {
    throw createAppError("El usuario asignado no pertenece al equipo tÃ©cnico", {
      status: 409,
      code: "TECHNICAL_ASSIGNEE_INVALID",
    });
  }

  const extraBase = request?.extra || {};
  const mergedExtra = mergeExtra(extraBase, {
    inspection_request_id: request.inspection_request_id,
    inspection_coordination_confirmed_at: new Date().toISOString(),
    inspection_assigned_technician_id: assignedTechnician.id || null,
    inspection_assigned_technician_email: assignedTechnician.email || null,
    inspection_assigned_technician_name:
      assignedTechnician.fullname || assignedTechnician.name || assignedTechnician.email || null,
    inspection_assignment_by_id: user?.id || null,
    inspection_assignment_by_email: user?.email || null,
  });

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET inspection_proposed_date = $1,
            inspection_proposed_notes = $2,
            inspection_proposed_at = now(),
            inspection_proposed_by = $3,
            inspection_proposed_by_email = $4,
            inspection_coordination_status = 'accepted',
            inspection_scheduled_date = $1,
            inspection_coordinated_at = now(),
            inspection_coordinated_by = $3,
            inspection_coordinated_by_email = $4,
            inspection_review_notes = NULL,
            inspection_reviewed_at = now(),
            inspection_reviewed_by = $3,
            inspection_reviewed_by_email = $4,
            inspection_coordination_notes = $2,
            extra = $5::jsonb,
            updated_at = now()
      WHERE id = $6
      RETURNING *`,
    [
      normalizedInspectionDate,
      notes || null,
      user?.id || null,
      user?.email || null,
      JSON.stringify(mergedExtra),
      id,
    ],
  );
  const updated = mapRequestRow(rows[0]);

  try {
    await db.query(
      `UPDATE requests
          SET payload = jsonb_set(
            COALESCE(payload, '{}'::jsonb),
            '{fecha_instalacion}',
            to_jsonb($1::text),
            true
          ),
          updated_at = now()
        WHERE id = $2`,
      [normalizedInspectionDate, request.inspection_request_id],
    );
    const regeneratedActa = await generateActa(request.inspection_request_id, user.id, "inspection");
    await markRequestActaGenerated(request.inspection_request_id);

    if (regeneratedActa) {
      const mergedAfterActa = mergeExtra(updated?.extra, {
        inspection_acta_file_id:
          regeneratedActa?.pdfId ||
          regeneratedActa?.id ||
          updated?.extra?.inspection_acta_file_id ||
          null,
        inspection_acta_link:
          regeneratedActa?.pdfLink ||
          regeneratedActa?.link ||
          updated?.extra?.inspection_acta_link ||
          null,
        inspection_acta_generated_at: new Date().toISOString(),
      });
      const actaUpdateRes = await db.query(
        `UPDATE equipment_purchase_requests
            SET extra = $1::jsonb,
                updated_at = now()
          WHERE id = $2
          RETURNING *`,
        [JSON.stringify(mergedAfterActa), id],
      );
      if (actaUpdateRes.rows?.[0]) {
        Object.assign(updated, mapRequestRow(actaUpdateRes.rows[0]));
      }
    }
  } catch (actaError) {
    logger.error(
      { actaError, purchaseRequestId: id, inspectionRequestId: request.inspection_request_id },
      "No se pudo regenerar/actualizar el acta al coordinar inspeccion",
    );
  }

  try {
    await upsertInspectionTechnicalActivity({
      request: updated,
      inspectionDate: normalizedInspectionDate,
      assignedTechnician,
      chiefUser: user,
      commercialUser,
    });
  } catch (scheduleError) {
    logger.warn(
      { scheduleError, requestId: updated?.id },
      "No se pudo registrar la inspecciÃ³n en cronograma tÃ©cnico",
    );
  }

  try {
    const attendees = [
      assignedTechnician?.email || null,
      user?.email || null,
      updated?.created_by_email || commercialUser?.email || null,
    ].filter(Boolean);
    const calendarEvent = await createAllDayEvent({
      summary: `InspecciÃ³n ambiente - ${updated.client_name || "cliente"}`,
      description: [
        `Compra pÃºblica #${updated.id}`,
        `Cliente: ${updated.client_name || "N/D"}`,
        `Jefe tÃ©cnico: ${user?.fullname || user?.name || user?.email || "N/D"}`,
        `TÃ©cnico asignado: ${assignedTechnician?.fullname || assignedTechnician?.name || assignedTechnician?.email || "N/D"}`,
        `Comercial: ${updated?.created_by_email || commercialUser?.email || "N/D"}`,
      ].join("\n"),
      date: normalizedInspectionDate,
      attendees,
    });
    if (calendarEvent?.id || calendarEvent?.htmlLink) {
      const withCalendarExtra = mergeExtra(updated?.extra, {
        inspection_calendar_event_id: calendarEvent.id || null,
        inspection_calendar_event_link: calendarEvent.htmlLink || null,
      });
      const calendarRes = await db.query(
        `UPDATE equipment_purchase_requests
            SET extra = $1::jsonb,
                updated_at = now()
          WHERE id = $2
          RETURNING *`,
        [JSON.stringify(withCalendarExtra), id],
      );
      if (calendarRes.rows?.[0]) {
        Object.assign(updated, mapRequestRow(calendarRes.rows[0]));
      }
    }
  } catch (calendarError) {
    logger.warn(
      { calendarError, requestId: updated?.id },
      "No se pudo crear evento de calendario para inspecciÃ³n",
    );
  }

  try {
    const recipientIds = [updated.created_by, updated.assigned_to, assignedTechnician?.id].filter(Boolean);
    await notifyUsers({
      userIds: recipientIds,
      title: "Fecha de inspecciÃ³n coordinada",
      message: `Jefe TÃ©cnico coordinÃ³ inspecciÃ³n para ${updated.client_name || "cliente"} el ${normalizedInspectionDate}.`,
      type: "task",
      source: "equipment_purchases",
      priority: 1,
      meta: {
        request_id: updated.id,
        inspection_date: normalizedInspectionDate,
        assigned_technician_id: assignedTechnician?.id || null,
      },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated.id }, "No se pudieron enviar notificaciones de coordinaciÃ³n");
  }

  return updated;
}

async function upsertInspectionTechnicalActivity({
  request,
  inspectionDate,
  assignedTechnician,
  chiefUser,
  commercialUser,
}) {
  if (!request?.id || !inspectionDate) return;
  const sourceType = "public_purchase_inspection";
  const sourceId = String(request.id);
  const techLabel = assignedTechnician?.name || assignedTechnician?.email || "Por definir";
  const chiefLabel = chiefUser?.fullname || chiefUser?.name || chiefUser?.email || "Jefatura tÃ©cnica";
  const commercialLabel = commercialUser?.fullname || commercialUser?.name || commercialUser?.email || "Comercial";
  const title = `InspecciÃ³n de ambiente - ${request.client_name || "cliente"}`;
  const notes = `Compra pÃºblica #${request.id} Â· TÃ©cnico: ${techLabel} Â· Jefe tÃ©cnico: ${chiefLabel} Â· Comercial: ${commercialLabel}`;

  const { rows } = await db.query(
    `SELECT id
       FROM servicio.cronograma_actividades_tecnicas
      WHERE source_type = $1
        AND source_id = $2
      ORDER BY id DESC
      LIMIT 1`,
    [sourceType, sourceId],
  );

  if (rows[0]?.id) {
    await db.query(
      `UPDATE servicio.cronograma_actividades_tecnicas
          SET user_id = $1,
              activity_date = $2,
              title = $3,
              notes = $4,
              status = 'programado',
              updated_at = now()
        WHERE id = $5`,
      [
        Number.isFinite(Number(assignedTechnician?.id)) ? Number(assignedTechnician.id) : null,
        inspectionDate,
        title,
        notes,
        rows[0].id,
      ],
    );
    return;
  }

  await db.query(
    `INSERT INTO servicio.cronograma_actividades_tecnicas (
        user_id, activity_date, title, notes, status, source_type, source_id, created_by, created_by_email, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'programado', $5, $6, $7, $8, now(), now())`,
    [
      Number.isFinite(Number(assignedTechnician?.id)) ? Number(assignedTechnician.id) : null,
      inspectionDate,
      title,
      notes,
      sourceType,
      sourceId,
      Number.isFinite(Number(chiefUser?.id)) ? Number(chiefUser.id) : null,
      chiefUser?.email || null,
    ],
  );
}

async function registerSiteInspection({
  id,
  user,
  result,
  checklist,
  observations,
  recommendations,
  client_signer_name,
  follow_up_date,
  is_reinspection,
  expected_updated_at,
}) {
  await ensureTables();
  if (!canRegisterSiteInspection(user)) {
    throw createAppError("No autorizado para registrar F.ST-07", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }

  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);

  if (!request.inspection_request_id || !request.inspection_scheduled_date) {
    throw createAppError("Primero se debe coordinar la fecha exacta de inspecciÃ³n (F.ST-20)", {
      status: 409,
      code: "SITE_INSPECTION_NOT_COORDINATED",
    });
  }

  const normalizedResult = String(result || "").trim().toLowerCase();
  const responsibleName = getInspectionResponsibleName(user);
  if (!["compliant", "non_compliant"].includes(normalizedResult)) {
    throw createAppError("Debes indicar un resultado vÃ¡lido para la inspecciÃ³n en sitio", {
      status: 400,
      code: "SITE_INSPECTION_RESULT_REQUIRED",
    });
  }

  const normalizedChecklist = normalizeFst07Checklist(checklist);
  const clientSignerName = String(client_signer_name || "").trim();
  if (!clientSignerName) {
    throw createAppError("Debes registrar el nombre de quien firma por parte del cliente", {
      status: 400,
      code: "CLIENT_SIGNATURE_REQUIRED",
    });
  }
  const scheduledDate = normalizeDateOnlyInput(request.inspection_scheduled_date);
  const normalizedFollowUpDate = normalizeDateOnlyInput(follow_up_date);

  if (normalizedResult === "non_compliant" && !normalizedFollowUpDate) {
    throw createAppError("Debes registrar una fecha de reinspecciÃ³n cuando el Ã¡rea no cumple", {
      status: 400,
      code: "SITE_INSPECTION_FOLLOW_UP_REQUIRED",
    });
  }

  if (normalizedResult === "non_compliant" && normalizedFollowUpDate) {
    const scheduledDateTs = new Date(`${scheduledDate}T00:00:00`).getTime();
    const followUpDateTs = new Date(`${normalizedFollowUpDate}T00:00:00`).getTime();
    if (!Number.isFinite(followUpDateTs) || followUpDateTs < scheduledDateTs) {
      throw createAppError("La fecha de reinspecciÃ³n debe ser igual o posterior a la fecha de inspecciÃ³n", {
        status: 409,
        code: "INSPECTION_DATE_OUT_OF_WINDOW",
      });
    }

    const conflicts = await listTechnicalSchedule({
      from: normalizedFollowUpDate,
      to: normalizedFollowUpDate,
      excludePublicRequestId: id,
      excludeInspectionRequestId: request.inspection_request_id || null,
    });
    if (conflicts.length >= TECHNICAL_DAILY_CAPACITY) {
      throw createAppError("El cronograma tÃ©cnico estÃ¡ lleno para la reinspecciÃ³n en esa fecha", {
        status: 409,
        code: "TECHNICAL_SCHEDULE_FULL",
        details: {
          date: normalizedFollowUpDate,
          capacity: TECHNICAL_DAILY_CAPACITY,
          conflicts_count: conflicts.length,
        },
      });
    }
  }

  const report = await generateFst07InspectionDocument({
    request,
    user,
    result: normalizedResult,
    checklist: normalizedChecklist,
    observations,
    recommendations,
    responsibleName,
    clientSignerName,
    followUpDate: normalizedFollowUpDate,
    isReinspection: Boolean(is_reinspection),
  });

  const prevExtra = request?.extra || {};
  const prevSite = getInspectionSiteState(prevExtra);
  const nowIso = new Date().toISOString();
  const historyEntry = {
    result: normalizedResult,
    is_reinspection: Boolean(is_reinspection),
    scheduled_date: scheduledDate || null,
    follow_up_date: normalizedResult === "non_compliant" ? normalizedFollowUpDate || null : null,
    observations: String(observations || "").trim() || null,
    recommendations: String(recommendations || "").trim() || null,
    responsible_name: responsibleName,
    client_signer_name: clientSignerName,
    updated_at: nowIso,
    updated_by: Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
    updated_by_email: user?.email || null,
    report_file_id: report?.file_id || null,
    report_link: report?.link || null,
  };

  const nextSiteState = {
    ...prevSite,
    status:
      normalizedResult === "compliant"
        ? SITE_INSPECTION_STATUS.READY_FOR_INSTALLATION
        : SITE_INSPECTION_STATUS.NON_COMPLIANT_REINSPECTION_PENDING,
    result: normalizedResult,
    follow_up_date: normalizedResult === "non_compliant" ? normalizedFollowUpDate || null : null,
    report_file_id: report?.file_id || prevSite.report_file_id || null,
    report_link: report?.link || prevSite.report_link || null,
    report_generated_at: report?.generated_at || prevSite.report_generated_at || nowIso,
    ready_for_installation: normalizedResult === "compliant",
    requires_reinspection: normalizedResult !== "compliant",
    checklist: normalizedChecklist,
    observations: String(observations || "").trim() || null,
    recommendations: String(recommendations || "").trim() || null,
    responsible_name: responsibleName,
    client_signer_name: clientSignerName,
    updated_at: nowIso,
    updated_by: Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
    updated_by_email: user?.email || null,
    history: [...prevSite.history, historyEntry].slice(-40),
  };

  const nextExtra = mergeExtra(prevExtra, {
    inspection_site: nextSiteState,
  });

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET extra = $1::jsonb,
            updated_at = now()
      WHERE id = $2
      RETURNING *`,
    [JSON.stringify(nextExtra), id],
  );

  if (normalizedResult === "non_compliant" && normalizedFollowUpDate) {
    await upsertReinspectionTechnicalActivity({
      request: rows[0],
      followUpDate: normalizedFollowUpDate,
      user,
    });
  } else if (normalizedResult === "compliant") {
    await closeReinspectionTechnicalActivity(id);
    if (rows[0]?.inspection_request_id) {
      markRequestCompleted(rows[0].inspection_request_id, {
        actorUser: user,
        resultMeta: { source: "public_purchase_site_inspection", result: normalizedResult },
      }).catch((err) => logger.warn({ err }, "No se pudo completar la solicitud F.ST-20 (compra publica)"));
    }
  }

  const updated = mapRequestRow(rows[0]);
  await trackFst07WorkflowDocument({
    sourceType: "public_purchase",
    sourceId: String(updated.id),
    requestId: updated.inspection_request_id || null,
    driveFileId: report?.file_id || null,
    driveFolderId: updated.drive_folder_id || null,
    driveLink: report?.link || null,
    result: normalizedResult,
    followUpDate: normalizedResult === "non_compliant" ? normalizedFollowUpDate || null : null,
    isReinspection: Boolean(is_reinspection),
    clientName: updated.client_name || null,
    equipmentName: Array.isArray(updated?.equipment)
      ? updated.equipment.map((item) => item?.name || item?.sku).filter(Boolean).join(", ")
      : null,
    user,
    metadata: {
      source_module: "equipment_purchases",
      public_purchase_id: updated.id,
    },
  });
  try {
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title:
        normalizedResult === "compliant"
          ? "InspecciÃ³n en sitio completada"
          : "InspecciÃ³n en sitio con observaciones",
      message:
        normalizedResult === "compliant"
          ? `Se completÃ³ F.ST-07 para ${updated.client_name || "cliente"}.`
          : `F.ST-07 detectÃ³ pendientes para ${updated.client_name || "cliente"}. ReinspecciÃ³n requerida.`,
      type: "task",
      source: "equipment_purchases",
      priority: 1,
      meta: {
        request_id: updated.id,
        inspection_site_status: updated.inspection_site_status,
        follow_up_date: updated.inspection_site_follow_up_date || null,
      },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated.id }, "No se pudieron enviar notificaciones de F.ST-07");
  }

  return updated;
}

async function storeFst14EvidencePhoto(folderId, photo, index = 0) {
  const source = typeof photo === "string" ? { raw: photo } : (photo || {});
  const fileId = source.file_id || source.id || null;
  const link = source.link || source.url || null;
  if (fileId || link) {
    return { file_id: fileId || null, link: link || driveLink(fileId) };
  }

  const rawImage = source.raw || source.base64 || source.data || null;
  if (!rawImage || typeof rawImage !== "string") return null;
  if (!rawImage.startsWith("data:image")) return null;

  const mimeTypeMatch = rawImage.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  const mimeType = mimeTypeMatch?.[1] || "image/png";
  const extension = mimeType.includes("jpeg") ? "jpg" : mimeType.split("/")[1] || "png";
  const base64 = rawImage.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  if (!base64) return null;

  const evidenceFolder = await ensureFolder("F.ST-14 Evidencias", folderId);
  const fileName = `F.ST-14-evidencia-${Date.now()}-${index + 1}.${extension}`;
  const stored = await uploadBase64File(
    fileName,
    base64,
    mimeType,
    evidenceFolder?.id || folderId,
  );
  return {
    file_id: stored?.id || null,
    link: stored?.webViewLink || (stored?.id ? driveLink(stored.id) : null),
  };
}

async function upsertInstallationWorkflow({
  id,
  user,
  action,
  payload = {},
  expected_updated_at,
}) {
  await ensureTables();
  if (!canManageDelivery(user) && !canRegisterSiteInspection(user)) {
    throw createAppError("Tu rol no puede actualizar el workflow de instalacion", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }

  const normalizedAction = String(action || payload?.action || "").trim().toLowerCase();
  if (!normalizedAction) {
    throw createInstallationWorkflowError("Debe indicar la accion del workflow de instalacion", {
      status: 400,
      code: "INSTALLATION_ACTION_REQUIRED",
    });
  }

  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  const extraBase = request?.extra || {};
  const currentWorkflow = normalizeInstallationWorkflowState(extraBase.installation_workflow || {}, {
    equipment: request?.equipment || [],
  });
  let nextWorkflow = currentWorkflow;

  if (normalizedAction === "dispatch_request") {
    nextWorkflow = buildDispatchRequestPatch({
      workflow: currentWorkflow,
      payload,
      user,
      defaults: {
        client_name: request.client_name || "Cliente",
        client_address: payload.client_address || "Pendiente",
        contact_name: request.client_name || null,
        contact_phone: null,
      },
    });
  } else if (normalizedAction === "logistics_validation") {
    nextWorkflow = buildLogisticsValidationPatch({
      workflow: currentWorkflow,
      payload,
      user,
    });
  } else if (normalizedAction === "visual_inspection_fst14") {
    if (!canRegisterSiteInspection(user)) {
      throw createInstallationWorkflowError("Solo el equipo tecnico puede registrar F.ST-14", {
        status: 403,
        code: "FORBIDDEN_ROLE_ACTION",
      });
    }
    const folderId = request?.drive_folder_id || null;
    if (!folderId) {
      throw createInstallationWorkflowError(
        "La compra no tiene carpeta de Drive para registrar F.ST-14",
        {
          status: 409,
          code: "FST14_DRIVE_FOLDER_MISSING",
        },
      );
    }

    const installationFolder = await ensureFolder("InstalaciÃ³n y entrega", folderId);
    const reportFolder = await ensureFolder("F.ST-14", installationFolder?.id || folderId);
    const photoPayload = Array.isArray(payload.photos) ? payload.photos : [];
    const storedPhotos = [];
    for (let i = 0; i < photoPayload.length; i += 1) {

      const stored = await storeFst14EvidencePhoto(folderId, photoPayload[i], i);
      if (stored) storedPhotos.push(stored);
    }

    const equipmentName = Array.isArray(request?.equipment)
      ? request.equipment.map((item) => item?.name || item?.label || item?.sku).filter(Boolean).join(", ")
      : "Equipo";
    const validatorName =
      currentWorkflow?.logistics_validation?.validated_by_email ||
      currentWorkflow?.logistics_validation?.validated_by ||
      "Pendiente";

    const { buffer: fst14Buffer, generatedAt } = await generateFst14PdfBuffer({
      clientName: request.client_name || "Cliente",
      clientAddress: payload.client_address || "Pendiente",
      equipmentName,
      inspectionDate: payload.inspection_date || new Date().toISOString(),
      responsibleName: user?.fullname || user?.name || user?.email || "Tecnico",
      logisticsValidatorName: validatorName,
      dispatchRequiredDate: currentWorkflow?.dispatch_request?.required_date || null,
      guideReference:
        payload.guide_reference ||
        currentWorkflow?.logistics_validation?.guide_reference ||
        null,
      proformaReference:
        payload.proforma_reference ||
        currentWorkflow?.logistics_validation?.proforma_reference ||
        null,
      checklist: payload.checklist || {},
      findings: payload.findings || "",
      correctiveActions: payload.corrective_actions || "",
      logisticsChainNotes: payload.logistics_chain_notes || "",
      result: payload.result || "pass",
      photos: storedPhotos,
      isPreinstallation: true,
    });
    const fileName = buildFst14FileName({
      clientName: request.client_name || "Cliente",
      generatedAt: new Date(generatedAt),
    });
    const storedReport = await uploadBase64File(
      fileName,
      fst14Buffer.toString("base64"),
      "application/pdf",
      reportFolder?.id || folderId,
    );
    const reportFileId = storedReport?.id || null;
    if (!reportFileId) {
      throw createInstallationWorkflowError("No se pudo almacenar F.ST-14 en Drive", {
        status: 500,
        code: "FST14_REPORT_STORE_FAILED",
      });
    }
    const reportLink = storedReport?.webViewLink || driveLink(reportFileId);

    nextWorkflow = buildVisualReceptionPatch({
      workflow: currentWorkflow,
      payload: {
        ...payload,
        photos: storedPhotos,
      },
      user,
      report: {
        file_id: reportFileId,
        link: reportLink,
        generated_at: generatedAt,
      },
    });

    await trackFst14WorkflowDocument({
      sourceType: "public_purchase",
      sourceId: String(id),
      requestId: request.inspection_request_id || null,
      driveFileId: reportFileId,
      driveFolderId: reportFolder?.id || folderId || null,
      driveLink: reportLink,
      clientName: request.client_name || null,
      equipmentName,
      user,
      metadata: {
        source_module: "equipment_purchases",
        purchase_id: id,
        result: nextWorkflow?.visual_reception?.result || null,
      },
    });
  } else if (normalizedAction === "verification_decision") {
    if (!canReviewInspectionCoordination(user)) {
      throw createInstallationWorkflowError("Solo jefatura tecnica puede decidir la verificacion", {
        status: 403,
        code: "FORBIDDEN_ROLE_ACTION",
      });
    }
    nextWorkflow = buildVerificationDecisionPatch({
      workflow: currentWorkflow,
      payload,
      user,
    });
  } else if (normalizedAction === "verification_remediation_review") {
    nextWorkflow = buildVerificationRemediationPatch({
      workflow: currentWorkflow,
      payload,
      user,
    });
  } else if (normalizedAction === "verification_attempt") {
    // Registra un intento del ciclo de verificacion F.ST-09 (solo aplica si
    // verification_decision.applies === true). appendVerificationAttempt ya
    // estaba implementado pero nunca se conecto a ninguna accion -- no habia
    // forma de registrar un intento (mismo gap que en private-purchases).
    if (!canRegisterSiteInspection(user)) {
      throw createInstallationWorkflowError("Solo el equipo tecnico puede registrar la verificacion F.ST-09", {
        status: 403,
        code: "FORBIDDEN_ROLE_ACTION",
      });
    }

    let attemptFileId = payload.document_file_id || payload.file_id || null;
    let attemptFileLink = payload.document_link || payload.link || null;
    if (!attemptFileId && payload.file_base64 && payload.file_name) {
      const folderId = request?.drive_folder_id || null;
      if (!folderId) {
        throw createInstallationWorkflowError("No hay carpeta de Drive para almacenar el reporte de verificacion", {
          status: 409,
          code: "VERIFICATION_DRIVE_FOLDER_MISSING",
        });
      }
      const verificationFolder = await ensureFolder("F.ST-09", folderId);
      const stored = await uploadBase64File(
        payload.file_name,
        String(payload.file_base64).includes(",")
          ? String(payload.file_base64).split(",")[1]
          : String(payload.file_base64),
        payload.mime_type || "application/pdf",
        verificationFolder?.id || folderId,
      );
      attemptFileId = stored?.id || null;
      attemptFileLink = stored?.webViewLink || (attemptFileId ? driveLink(attemptFileId) : null);
    }

    nextWorkflow = appendVerificationAttempt({
      workflow: currentWorkflow,
      payload,
      user,
      document: { file_id: attemptFileId, link: attemptFileLink },
    });
  } else if (normalizedAction === "cu_provider_report") {
    let fileId = payload.provider_repair_report_file_id || payload.file_id || null;
    let link = payload.provider_repair_report_link || payload.link || null;
    if (!fileId && payload.file_base64 && payload.file_name) {
      const folderId = request?.drive_folder_id || null;
      if (!folderId) {
        throw createInstallationWorkflowError("No hay carpeta de Drive para almacenar reporte CU", {
          status: 409,
          code: "CU_REPORT_DRIVE_FOLDER_MISSING",
        });
      }
      const cuFolder = await ensureFolder("CU Reportes proveedor", folderId);
      const stored = await uploadBase64File(
        payload.file_name,
        String(payload.file_base64).includes(",")
          ? String(payload.file_base64).split(",")[1]
          : String(payload.file_base64),
        payload.mime_type || "application/pdf",
        cuFolder?.id || folderId,
      );
      fileId = stored?.id || null;
      link = stored?.webViewLink || (fileId ? driveLink(fileId) : null);
    }
    nextWorkflow = buildCuProviderReportPatch({
      workflow: currentWorkflow,
      payload: {
        ...payload,
        provider_repair_report_file_id: fileId,
        provider_repair_report_link: link,
      },
      user,
    });
  } else {
    throw createInstallationWorkflowError("Accion de workflow de instalacion no soportada", {
      status: 400,
      code: "INSTALLATION_ACTION_INVALID",
      details: { action: normalizedAction },
    });
  }

  nextWorkflow = enrichInstallationWorkflowWithGate({
    workflow: nextWorkflow,
    siteReady: Boolean(request?.inspection_site_ready_for_installation),
    requiresSiteInspection: Boolean(request?.inspection_request_id || request?.inspection_scheduled_date),
  });
  const mergedExtra = mergeExtra(extraBase, {
    installation_workflow: nextWorkflow,
  });

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET extra = $1::jsonb,
            updated_at = now()
      WHERE id = $2
      RETURNING *`,
    [JSON.stringify(mergedExtra), id],
  );
  const updatedRequest = mapRequestRow(rows[0]);

  // Ninguna de las 7 acciones del workflow de instalacion avisaba a nadie
  // (solo quedaba el SSE generico para quien tuviera la pantalla abierta).
  const INSTALLATION_ACTION_LABELS = {
    dispatch_request: "Despacho solicitado formalmente",
    logistics_validation: "Validacion logistica completada",
    visual_inspection_fst14: "Recepcion visual F.ST-14 registrada",
    verification_decision: nextWorkflow?.verification_decision?.applies
      ? "Verificacion tecnica F.ST-09 requerida"
      : "Verificacion tecnica no requerida",
    verification_remediation_review: "Revision de remediacion registrada",
    verification_attempt: "Intento de verificacion F.ST-09 registrado",
    cu_provider_report: "Reporte de reparacion del proveedor (CU) registrado",
  };
  const actionTitle = INSTALLATION_ACTION_LABELS[normalizedAction];
  if (actionTitle) {
    try {
      await notifyUsers({
        userIds: [updatedRequest.created_by, updatedRequest.assigned_to],
        title: actionTitle,
        message: `${actionTitle} para ${updatedRequest.client_name || "cliente"}.`,
        type: "task",
        source: "equipment_purchases.installation_workflow",
        priority: 1,
        meta: { request_id: updatedRequest.id, installation_action: normalizedAction },
      });
    } catch (notifyError) {
      logger.warn(
        { notifyError, requestId: updatedRequest.id, action: normalizedAction },
        "No se pudo notificar la accion del workflow de instalacion",
      );
    }
  }

  return updatedRequest;
}

async function reviewInspectionDateProposal({ id, user, decision, review_notes, expected_updated_at }) {
  await ensureTables();
  if (!canReviewInspectionCoordination(user)) {
    throw createAppError("No autorizado para revisar la coordinaciÃ³n de inspecciÃ³n", {
      status: 403,
      code: "FORBIDDEN_COORDINATION_REVIEW",
    });
  }

  const normalizedDecision = String(decision || "").toLowerCase();
  if (!["accept", "reject"].includes(normalizedDecision)) {
    throw createAppError("DecisiÃ³n invÃ¡lida. Usa 'accept' o 'reject'.", {
      status: 400,
      code: "INVALID_REVIEW_DECISION",
    });
  }

  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "coordinate_inspection_date");
  if (!request.inspection_request_id) {
    throw createAppError("No existe solicitud de inspecciÃ³n asociada", {
      status: 409,
      code: "INSPECTION_REQUEST_REQUIRED",
    });
  }
  if (!request.inspection_proposed_date) {
    throw createAppError("No hay una fecha propuesta para revisar", {
      status: 409,
      code: "INSPECTION_PROPOSAL_REQUIRED",
    });
  }

  const proposalDate = String(request.inspection_proposed_date).slice(0, 10);

  if (normalizedDecision === "reject") {
    const { rows } = await db.query(
      `UPDATE equipment_purchase_requests
          SET inspection_coordination_status = 'rejected',
              inspection_review_notes = $1,
              inspection_reviewed_at = now(),
              inspection_reviewed_by = $2,
              inspection_reviewed_by_email = $3,
              inspection_scheduled_date = NULL,
              inspection_coordinated_at = NULL,
              inspection_coordinated_by = NULL,
              inspection_coordinated_by_email = NULL,
              updated_at = now()
        WHERE id = $4
        RETURNING *`,
      [review_notes || null, user.id || null, user.email || null, id],
    );
    const rejected = mapRequestRow(rows[0]);
    try {
      await notifyUsers({
        userIds: [rejected.created_by, rejected.assigned_to],
        title: "Fecha de inspeccion rechazada",
        message: `Jefe Tecnico rechazo la fecha propuesta para ${rejected.client_name || "cliente"}.${review_notes ? ` Motivo: ${review_notes}` : ""}`,
        type: "alert",
        source: "equipment_purchases",
        priority: 2,
        meta: { request_id: rejected.id },
      });
    } catch (notifyError) {
      logger.warn({ notifyError, requestId: rejected.id }, "No se pudo notificar el rechazo de fecha de inspeccion");
    }
    return rejected;
  }

  const conflictRows = await listTechnicalSchedule({
    from: proposalDate,
    to: proposalDate,
    excludePublicRequestId: id,
    excludeInspectionRequestId: request.inspection_request_id || null,
  });
  if (conflictRows.length >= TECHNICAL_DAILY_CAPACITY) {
    throw createAppError("El cronograma tÃ©cnico estÃ¡ lleno para esa fecha.", {
      status: 409,
      code: "TECHNICAL_SCHEDULE_FULL",
      details: {
        date: proposalDate,
        capacity: TECHNICAL_DAILY_CAPACITY,
        conflicts_count: conflictRows.length,
        conflicts: conflictRows.map((item) => ({
          source_type: item.source_type,
          summary: item.summary,
        })),
      },
    });
  }

  let regeneratedActa = null;
  try {
    await db.query(
      `UPDATE requests
          SET payload = jsonb_set(
            COALESCE(payload, '{}'::jsonb),
            '{fecha_instalacion}',
            to_jsonb($1::text),
            true
          ),
          updated_at = now()
        WHERE id = $2`,
      [proposalDate, request.inspection_request_id],
    );
    regeneratedActa = await generateActa(request.inspection_request_id, user.id, "inspection");
    await markRequestActaGenerated(request.inspection_request_id);
  } catch (actaError) {
    logger.error(
      { actaError, purchaseRequestId: id, inspectionRequestId: request.inspection_request_id },
      "No se pudo regenerar/actualizar el acta al aprobar inspecciÃ³n",
    );
  }

  const extraBase = request?.extra || {};
  const mergedExtra = mergeExtra(extraBase, {
    inspection_request_id: request.inspection_request_id,
    inspection_acta_file_id:
      regeneratedActa?.pdfId ||
      regeneratedActa?.id ||
      extraBase?.inspection_acta_file_id ||
      null,
    inspection_acta_link:
      regeneratedActa?.pdfLink ||
      regeneratedActa?.link ||
      extraBase?.inspection_acta_link ||
      null,
    inspection_acta_generated_at: new Date().toISOString(),
    inspection_assigned_technician_id: user?.id || null,
    inspection_assigned_technician_email: user?.email || null,
    inspection_assigned_technician_name:
      user?.fullname || user?.name || user?.email || null,
    inspection_assignment_by_id: user?.id || null,
    inspection_assignment_by_email: user?.email || null,
  });

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET inspection_scheduled_date = $1,
            inspection_coordination_notes = COALESCE($2, inspection_coordination_notes),
            inspection_coordination_status = 'accepted',
            inspection_review_notes = $3,
            inspection_reviewed_at = now(),
            inspection_reviewed_by = $4,
            inspection_reviewed_by_email = $5,
            inspection_coordinated_at = now(),
            inspection_coordinated_by = $4,
            inspection_coordinated_by_email = $5,
            extra = $6::jsonb,
            updated_at = now()
      WHERE id = $7
      RETURNING *`,
    [
      proposalDate,
      request.inspection_proposed_notes || null,
      review_notes || null,
      user.id || null,
      user.email || null,
      JSON.stringify(mergedExtra),
      id,
    ],
  );
  const updated = mapRequestRow(rows[0]);
  const commercialUser = updated?.created_by ? await getUserById(updated.created_by) : null;

  try {
    await upsertInspectionTechnicalActivity({
      request: updated,
      inspectionDate: proposalDate,
      assignedTechnician: user,
      chiefUser: user,
      commercialUser,
    });
  } catch (scheduleError) {
    logger.warn(
      { scheduleError, requestId: updated?.id },
      "No se pudo registrar la inspecciÃ³n aprobada en cronograma tÃ©cnico",
    );
  }

  try {
    const attendees = [
      user?.email || null,
      user?.email || null,
      updated?.created_by_email || commercialUser?.email || null,
    ].filter(Boolean);
    const calendarEvent = await createAllDayEvent({
      summary: `InspecciÃ³n ambiente - ${updated.client_name || "cliente"}`,
      description: [
        `Compra pÃºblica #${updated.id}`,
        `Cliente: ${updated.client_name || "N/D"}`,
        `Jefe tÃ©cnico: ${user?.fullname || user?.name || user?.email || "N/D"}`,
        `TÃ©cnico asignado: ${user?.fullname || user?.name || user?.email || "N/D"}`,
        `Comercial: ${updated?.created_by_email || commercialUser?.email || "N/D"}`,
      ].join("\n"),
      date: proposalDate,
      attendees,
    });
    if (calendarEvent?.id || calendarEvent?.htmlLink) {
      const withCalendarExtra = mergeExtra(updated?.extra, {
        inspection_calendar_event_id: calendarEvent.id || null,
        inspection_calendar_event_link: calendarEvent.htmlLink || null,
      });
      const calendarRes = await db.query(
        `UPDATE equipment_purchase_requests
            SET extra = $1::jsonb,
                updated_at = now()
          WHERE id = $2
          RETURNING *`,
        [JSON.stringify(withCalendarExtra), id],
      );
      if (calendarRes.rows?.[0]) {
        Object.assign(updated, mapRequestRow(calendarRes.rows[0]));
      }
    }
  } catch (calendarError) {
    logger.warn(
      { calendarError, requestId: updated?.id },
      "No se pudo crear evento calendario al aprobar la coordinaciÃ³n",
    );
  }

  try {
    await notifyUsers({
      userIds: [updated.created_by, user?.id],
      title: "Fecha de inspecciÃ³n aprobada",
      message: `Jefe TÃ©cnico confirmÃ³ inspecciÃ³n para ${updated.client_name || "cliente"} el ${proposalDate}.`,
      type: "task",
      source: "equipment_purchases",
      priority: 1,
      meta: { request_id: updated.id, inspection_date: proposalDate },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated.id }, "No se pudieron enviar notificaciones de aprobaciÃ³n");
  }

  return updated;
}

function isResolvedBusinessCaseStage(stage) {
  const normalized = String(stage || "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith("pending")) return false;
  if (["draft", "en_proceso", "in_progress"].includes(normalized)) return false;
  return true;
}

async function registerPublicPortalOutcome({ id, user, outcome, notes, expected_updated_at }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "register_public_portal_outcome");

  const isAssignee = String(request?.assigned_to || "") === String(user?.id || "");
  if (!canManageAll(user) && !isAssignee) {
    throw createAppError("Solo ACP Comercial asignado puede registrar resultado del portal pÃºblico", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }

  const normalizedOutcome = String(outcome || "").trim().toLowerCase();
  // Outcomes del workflow: ganado=won, perdido=lost, desierto=deserted, cancelado=cancelled
  if (!["won", "lost", "deserted", "cancelled"].includes(normalizedOutcome)) {
    throw createAppError("Resultado invÃ¡lido. Usa: won, lost, deserted o cancelled.", {
      status: 400,
      code: "INVALID_PORTAL_OUTCOME",
    });
  }

  let autoBusinessCaseId = request?.business_case_id || null;
  if (!autoBusinessCaseId) {
    try {
      autoBusinessCaseId = await ensureAutoBusinessCaseForPurchase({
        purchaseRequest: request,
        user,
        inspectionId: request?.inspection_request_id || null,
      });
    } catch (bcCreateError) {
      logger.error(
        { bcCreateError, requestId: request?.id },
        "No se pudo crear/enlazar BC automÃ¡tico al registrar resultado del portal",
      );
    }
  }
  if (!autoBusinessCaseId) {
    throw createAppError("No se encontrÃ³ el Business Case automÃ¡tico asociado", {
      status: 409,
      code: "BUSINESS_CASE_REQUIRED",
    });
  }

  const bcRes = await db.query(
    `SELECT id, status, bc_stage
       FROM equipment_purchase_requests
      WHERE id = $1
        AND COALESCE(request_type, 'purchase') = 'business_case'
      LIMIT 1`,
    [autoBusinessCaseId],
  );
  const bc = bcRes.rows[0] || null;
  if (!bc) {
    throw createAppError("El Business Case asociado no existe o no es vÃ¡lido", {
      status: 409,
      code: "BUSINESS_CASE_INVALID",
    });
  }

  if (!isResolvedBusinessCaseStage(bc.bc_stage)) {
    throw createAppError(
      "Primero debes resolver el Business Case antes de registrar el resultado del portal pÃºblico",
      {
        status: 409,
        code: "BUSINESS_CASE_NOT_RESOLVED",
        details: {
          business_case_id: autoBusinessCaseId,
          bc_stage: bc.bc_stage || null,
          bc_status: bc.status || null,
        },
      },
    );
  }

  if (normalizedOutcome === "won" && String(bc.bc_stage || "").toLowerCase() !== "factible") {
    throw createAppError(
      "No puedes marcar como ganado: el Business Case no estÃ¡ resuelto como factible",
      {
        status: 409,
        code: "BUSINESS_CASE_NOT_READY",
        details: {
          business_case_id: autoBusinessCaseId,
          bc_stage: bc.bc_stage || null,
          bc_status: bc.status || null,
        },
      },
    );
  }

  const nowIso = new Date().toISOString();
  const isTerminal = ["lost", "deserted", "cancelled"].includes(normalizedOutcome);
  const mergedExtra = mergeExtra(request?.extra, {
    public_portal_outcome: {
      outcome: normalizedOutcome,
      notes: String(notes || "").trim() || null,
      recorded_at: nowIso,
      recorded_by: user?.id || null,
      recorded_by_email: user?.email || null,
    },
    ...(isTerminal
      ? {
          cancellation: {
            by_user_id: user?.id || null,
            by_user_email: user?.email || null,
            reason:
              String(notes || "").trim() ||
              (normalizedOutcome === "deserted"
                ? "Proceso desierto en portal de compras pÃºblicas"
                : normalizedOutcome === "cancelled"
                  ? "Proceso cancelado en portal de compras pÃºblicas"
                  : "Proceso no adjudicado en portal de compras pÃºblicas"),
            cancelled_at: nowIso,
          },
        }
      : {}),
  });

  const nextStatus = normalizedOutcome === "won" ? STATUS.PENDING_CONTRACT : STATUS.NO_STOCK;

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET status = $1,
            extra = $2::jsonb,
            disponibilidad_last_actor_email = $4,
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [nextStatus, JSON.stringify(mergedExtra), id, user?.email || null],
  );

  const updated = mapRequestRow(rows[0]);

  const OUTCOME_LABELS = {
    won: "Proceso ganado en portal pÃºblico",
    lost: "Proceso perdido en portal pÃºblico",
    deserted: "Proceso declarado desierto",
    cancelled: "Proceso cancelado en portal pÃºblico",
  };
  const OUTCOME_MESSAGES = {
    won: `ContinÃºa con contrato e inspecciÃ³n para ${updated.client_name || "cliente"}.`,
    lost: `Solicitud cerrada para ${updated.client_name || "cliente"}: proceso perdido.`,
    deserted: `Solicitud cerrada para ${updated.client_name || "cliente"}: proceso desierto.`,
    cancelled: `Solicitud cerrada para ${updated.client_name || "cliente"}: proceso cancelado.`,
  };

  try {
    // Notificar con chat=true para resultados de portal (eventos clave del negocio).
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title: OUTCOME_LABELS[normalizedOutcome] || "Resultado del portal pÃºblico registrado",
      message: OUTCOME_MESSAGES[normalizedOutcome] || `Resultado: ${normalizedOutcome}`,
      type: normalizedOutcome === "won" ? "success" : "warning",
      source: "equipment_purchases_portal",
      priority: 2,
      meta: { request_id: updated.id, public_portal_outcome: normalizedOutcome },
      email: true,
      chat: true,
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated.id }, "No se pudieron enviar notificaciones de resultado portal");
  }

  return updated;
}

async function uploadContract({ id, user, file, expected_updated_at }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "upload_contract");
  assertChecklistReady(request, "upload_contract");

  let autoBusinessCaseId = request?.business_case_id || null;
  if (!autoBusinessCaseId) {
    try {
      autoBusinessCaseId = await ensureAutoBusinessCaseForPurchase({
        purchaseRequest: request,
        user,
        inspectionId: request?.inspection_request_id || null,
      });
    } catch (bcCreateError) {
      logger.error(
        { bcCreateError, requestId: request?.id },
        "No se pudo crear/enlazar BC automÃ¡tico al subir contrato",
      );
    }
  }
  if (!autoBusinessCaseId) {
    throw createAppError("No se encontrÃ³ el Business Case automÃ¡tico asociado", {
      status: 409,
      code: "BUSINESS_CASE_REQUIRED",
    });
  }

  const bcRes = await db.query(
    `SELECT id, bc_stage
       FROM equipment_purchase_requests
      WHERE id = $1
        AND COALESCE(request_type, 'purchase') = 'business_case'
      LIMIT 1`,
    [autoBusinessCaseId],
  );
  const bc = bcRes.rows[0] || null;
  if (!bc) {
    throw createAppError("El Business Case asociado no existe o no es vÃ¡lido", {
      status: 409,
      code: "BUSINESS_CASE_INVALID",
    });
  }
  if (String(bc.bc_stage || "").toLowerCase() !== "factible") {
    throw createAppError(
      "No puedes subir contrato: el Business Case aÃºn no estÃ¡ resuelto como factible",
      {
        status: 409,
        code: "BUSINESS_CASE_NOT_READY",
        details: {
          business_case_id: autoBusinessCaseId,
          bc_stage: bc.bc_stage || null,
        },
      },
    );
  }

  const fileId = await uploadDocument(file, request.drive_folder_id, "contrato");
  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET contract_file_id = $1,
            contract_uploaded_at = now(),
            status = $2,
            contrato_last_actor_email = $4,
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [fileId, STATUS.CONTRACT_AVAILABLE, id, user?.email || null],
  );

  const completed = rows[0];

  try {
    const gerencia = await getUsersByRole("gerencia_general");
    await notifyUsers({
      userIds: [completed.created_by, completed.assigned_to, ...gerencia.map((u) => u.id)],
      title: "Contrato subido",
      message: `Contrato subido para ${completed.client_name || "cliente"}. Solicita fechas de entrega para continuar.`,
      type: "info",
      source: "equipment_purchases",
      priority: 2,
      meta: { request_id: completed.id },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: completed.id }, "No se pudieron enviar notificaciones de contrato");
  }

  // Nota: antes se enviaba aqui un segundo correo con el template
  // "equipment_available" ("Equipo Disponible... listo para entrega"), pero el
  // equipo aun no ha llegado fisicamente en este punto del flujo (eso ocurre en
  // markEquipmentArrived) -- era contenido duplicado y enganoso, se elimino.

  return completed;
}

async function markEquipmentArrived({ id, user, notes, expected_updated_at }) {
  await ensureTables();
  if (!canManageDelivery(user)) {
    throw createAppError("Tu rol no puede marcar arribo de equipo", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "mark_equipment_arrived");
  assertChecklistReady(request, "mark_equipment_arrived");

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET equipment_arrived_at = now(),
            status = $1,
            equipment_arrived_by = $2,
            equipment_arrived_by_email = $3,
            delivery_notes = COALESCE($4, delivery_notes),
            serial_status = CASE
              WHEN COALESCE(serial_status, 'not_applicable_yet') IN ('not_applicable_yet', 'pending_reception')
              THEN 'received_pending_serial'
              ELSE serial_status
            END,
            updated_at = now()
      WHERE id = $5
      RETURNING *`,
    [STATUS.WAITING_DISPATCH, user?.id || null, user?.email || null, notes || null, id],
  );
  const updated = mapRequestRow(rows[0]);
  await notifyDeliveryStage({
    request: updated,
    title: "Equipo arribado â€” registrar serial",
    message: `Equipo de ${updated.client_name || "cliente"} recibido fÃ­sicamente. Procede a registrar el nÃºmero de serie (F.ST-14).`,
    meta: { status: updated.status, equipment_arrived_at: updated.equipment_arrived_at || null, form_reference: "F.ST-14" },
  });
  return updated;
}

async function requestDeliveryDates({ id, user, notes, expected_updated_at }) {
  await ensureTables();
  if (!canPlanDelivery(user)) {
    throw createAppError("Tu rol no puede solicitar fechas de entrega", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "request_delivery_dates");
  assertChecklistReady(request, "request_delivery_dates");

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET status = $1,
            delivery_dates_requested_at = now(),
            delivery_dates_requested_by = $2,
            delivery_dates_requested_by_email = $3,
            delivery_notes = COALESCE($4, delivery_notes),
            updated_at = now()
      WHERE id = $5
      RETURNING *`,
    [STATUS.DELIVERY_DATES_REQUESTED, user?.id || null, user?.email || null, notes || null, id],
  );
  const updated = mapRequestRow(rows[0]);
  await notifyDeliveryStage({
    request: updated,
    title: "Fechas de entrega solicitadas",
    message: `Se solicitaron fechas de entrega para ${updated.client_name || "el cliente"}.`,
    meta: { status: updated.status, delivery_dates_requested_at: updated.delivery_dates_requested_at || null },
  });
  return updated;
}

async function submitDeliveryDates({ id, user, delivery_start_at, delivery_end_at, notes, expected_updated_at }) {
  await ensureTables();
  if (!canPlanDelivery(user)) {
    throw createAppError("Tu rol no puede registrar fechas de entrega", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "submit_delivery_dates");
  assertChecklistReady(request, "submit_delivery_dates");

  const start = String(delivery_start_at || "").slice(0, 10);
  const end = String(delivery_end_at || "").slice(0, 10);
  if (!start || !end) {
    throw createAppError("Debes registrar fecha inicio y fin de entrega", {
      status: 400,
      code: "DELIVERY_DATES_REQUIRED",
    });
  }
  if (new Date(end).getTime() < new Date(start).getTime()) {
    throw createAppError("La fecha fin no puede ser menor a la fecha inicio", {
      status: 400,
      code: "DELIVERY_DATES_INVALID_RANGE",
    });
  }

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET status = $1,
            delivery_start_at = $2::date,
            delivery_end_at = $3::date,
            delivery_notes = COALESCE($4, delivery_notes),
            updated_at = now()
      WHERE id = $5
      RETURNING *`,
    [STATUS.DELIVERY_DATES_SUBMITTED, start, end, notes || null, id],
  );
  const updated = mapRequestRow(rows[0]);
  await notifyDeliveryStage({
    request: updated,
    title: "Fechas de entrega registradas",
    message: `Se registraron fechas de entrega para ${updated.client_name || "el cliente"}.`,
    meta: {
      status: updated.status,
      delivery_start_at: updated.delivery_start_at || null,
      delivery_end_at: updated.delivery_end_at || null,
    },
  });
  return updated;
}

async function markDispatchReady({ id, user, notes, expected_updated_at }) {
  await ensureTables();
  if (!canManageDelivery(user)) {
    throw createAppError("Tu rol no puede marcar despacho listo", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "mark_dispatch_ready");
  assertChecklistReady(request, "mark_dispatch_ready");

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET status = $1,
            dispatch_ready_at = now(),
            dispatch_ready_by = $2,
            dispatch_ready_by_email = $3,
            delivery_notes = COALESCE($4, delivery_notes),
            updated_at = now()
      WHERE id = $5
      RETURNING *`,
    [STATUS.DISPATCH_READY, user?.id || null, user?.email || null, notes || null, id],
  );
  const updated = mapRequestRow(rows[0]);
  await notifyDeliveryStage({
    request: updated,
    title: "Despacho listo",
    message: `El despacho estÃ¡ listo para ${updated.client_name || "el cliente"}.`,
    meta: { status: updated.status, dispatch_ready_at: updated.dispatch_ready_at || null },
  });
  return updated;
}

async function completeDelivery({ id, user, notes, expected_updated_at }) {
  await ensureTables();
  if (!canManageDelivery(user)) {
    throw createAppError("Tu rol no puede completar la entrega", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "complete_delivery");
  assertChecklistReady(request, "complete_delivery");
  if (request?.inspection_request_id || request?.inspection_scheduled_date) {
    assertSiteReadyForInstallation(request);
  }
  if (!request?.installation_can_close) {
    throw createAppError("No se puede cerrar la instalacion: existen prerequisitos pendientes", {
      status: 409,
      code: "INSTALLATION_CLOSURE_BLOCKED",
      details: {
        blocked_reasons: Array.isArray(request?.installation_blocked_reasons)
          ? request.installation_blocked_reasons
          : [],
      },
    });
  }

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET status = $1,
            delivered_at = now(),
            delivered_by = $2,
            delivered_by_email = $3,
            delivery_confirmed_notes = COALESCE($4, delivery_confirmed_notes),
            -- GAP-03: desactivar techo de insumos al cerrar expediente para bloquear nuevas DRs
            supply_control_type = 'none',
            updated_at = now()
      WHERE id = $5
      RETURNING *`,
    [STATUS.COMPLETED, user?.id || null, user?.email || null, notes || null, id],
  );
  const updated = mapRequestRow(rows[0]);
  await notifyDeliveryStage({
    request: updated,
    title: "Entrega completada",
    message: `Se completÃ³ la entrega para ${updated.client_name || "el cliente"}.`,
    meta: { status: updated.status, delivered_at: updated.delivered_at || null },
    priority: 2,
  });
  return updated;
}

async function renewReservation({ id, user, expected_updated_at }) {
  await ensureTables();
  if (!canManageAll(user)) {
    throw createAppError("Solo ACP Comercial puede renovar la reserva", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }

  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);

  if (request.status !== STATUS.WAITING_SIGNED_PROFORMA) {
    throw createAppError("La reserva solo puede renovarse cuando se espera proforma firmada", {
      status: 409,
      code: "INVALID_TRANSITION",
      details: {
        action: "renew_reservation",
        current_status: request.status,
        allowed_statuses: [STATUS.WAITING_SIGNED_PROFORMA],
      },
    });
  }

  const renewedExpiresAt = new Date();
  renewedExpiresAt.setDate(renewedExpiresAt.getDate() + RESERVATION_VALIDITY_DAYS);

  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() + RESERVATION_REMINDER_OFFSET_DAYS);
  let calendarEvent = {};
  try {
    calendarEvent = await createAllDayEvent({
      summary: `âš ï¸ Reserva renovada por vencer â€” ${request.client_name}`,
      description: `Reserva renovada. Nuevo vencimiento: ${renewedExpiresAt.toLocaleDateString('es-EC')}. Confirma proforma firmada o vuelve a renovar antes de que venza.`,
      date: reminderDate,
      attendees: [user.email].filter(Boolean),
    });
  } catch (error) {
    logger.warn("No se pudo crear recordatorio de reserva renovada en Calendar: %s", error.message);
  }

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET reservation_email_sent_at = now(),
            reservation_expires_at    = $1,
            reservation_calendar_event_id = $2,
            reservation_calendar_event_link = $3,
            updated_at = now()
      WHERE id = $4
      RETURNING *`,
    [renewedExpiresAt, calendarEvent.id || null, calendarEvent.htmlLink || null, id],
  );
  return mapRequestRow(rows[0]);
}

async function cancelOrder({ id, user, reason, expected_updated_at }) {
  await ensureTables();
  if (!canManageAll(user)) {
    throw createAppError("Solo ACP Comercial puede cancelar la solicitud", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }

  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);

  if ([STATUS.COMPLETED, STATUS.NO_STOCK].includes(request.status)) {
    throw createAppError("La solicitud ya estÃ¡ cerrada", {
      status: 409,
      code: "INVALID_TRANSITION",
      details: {
        action: "cancel_order",
        current_status: request.status,
      },
    });
  }

  const now = new Date();
  const reservationIsActive =
    request.reservation_email_sent_at &&
    request.reservation_expires_at &&
    new Date(request.reservation_expires_at) > now;

  const nextExtra = {
    ...(request.extra || {}),
    cancellation: {
      by_user_id: user?.id || null,
      by_user_email: user?.email || null,
      reason: String(reason || "").trim() || "Sin motivo especificado",
      cancelled_at: now.toISOString(),
    },
    ...(reservationIsActive && {
      reservation_freed: {
        freed_at: now.toISOString(),
        freed_by_user_id: user?.id || null,
        freed_by_user_email: user?.email || null,
        original_reservation_at: request.reservation_email_sent_at,
        reservation_expires_at: request.reservation_expires_at,
        equipment: request.equipment || [],
        reason: "client_cancelled",
      },
    }),
  };

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET status = $1,
            extra = $2::jsonb,
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [STATUS.NO_STOCK, JSON.stringify(nextExtra), id],
  );
  return mapRequestRow(rows[0]);
}

/**
 * Lists purchases that were cancelled while having an active reservation
 * AND whose reservation window has not yet expired (reservation_expires_at > now).
 * ACP uses this to reassign an existing reservation to a new purchase.
 */
async function getFreedReservations({ user } = {}) {
  await ensureTables();
  const { rows } = await db.query(
    `SELECT
        id,
        client_name,
        equipment,
        provider_email,
        reservation_email_sent_at,
        reservation_expires_at,
        reservation_calendar_event_link,
        extra,
        status,
        updated_at
       FROM equipment_purchase_requests
      WHERE reservation_email_sent_at IS NOT NULL
        AND reservation_expires_at > now()
        AND extra->'reservation_freed' IS NOT NULL
      ORDER BY reservation_expires_at ASC`,
  );
  return rows;
}

async function getActiveReservations({ user } = {}) {
  await ensureTables();
  if (!canManageAll(user)) {
    throw createAppError("Solo ACP Comercial puede ver las reservas activas", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }

  const { rows } = await db.query(
    `SELECT
        id,
        status,
        client_name,
        equipment,
        reservation_email_sent_at,
        reservation_expires_at,
        reservation_calendar_event_link,
        soce_process_code,
        pac_code,
        orden_compra_number
       FROM equipment_purchase_requests
      WHERE reservation_email_sent_at IS NOT NULL
        AND status NOT IN ('completed', 'cancelled', 'lost', 'deserted', 'rejected')
      ORDER BY reservation_expires_at ASC NULLS LAST`,
  );

  const now = new Date();
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    purchase_type: "public",
    client_name: row.client_name || "Cliente",
    process_number: row.soce_process_code || row.pac_code || row.orden_compra_number || null,
    equipment: Array.isArray(row.equipment) ? row.equipment : [],
    reservation_email_sent_at: row.reservation_email_sent_at,
    reservation_expires_at: row.reservation_expires_at,
    reservation_calendar_event_link: row.reservation_calendar_event_link || null,
    is_expired: row.reservation_expires_at ? new Date(row.reservation_expires_at) < now : false,
    days_remaining: row.reservation_expires_at
      ? Math.ceil((new Date(row.reservation_expires_at) - now) / (1000 * 60 * 60 * 24))
      : null,
  }));
}

/**
 * Transfer a freed reservation from a cancelled purchase (fromId) to a pending purchase (toId).
 * The provider already has the reservation; this just records the reassignment internally
 * so ACP knows the new purchase is covered by the existing reservation.
 */
async function transferReservation({ fromId, toId, user }) {
  await ensureTables();
  if (!canManageAll(user)) {
    throw createAppError("Solo ACP Comercial puede transferir reservas", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }

  const [sourceReq, targetReq] = await Promise.all([
    getById(fromId, user),
    getById(toId, user),
  ]);
  if (!sourceReq) throw createAppError("Solicitud origen no encontrada", { status: 404 });
  if (!targetReq) throw createAppError("Solicitud destino no encontrada", { status: 404 });

  const now = new Date();
  if (!sourceReq.reservation_expires_at || new Date(sourceReq.reservation_expires_at) <= now) {
    throw createAppError("La reserva origen ya estÃ¡ vencida", {
      status: 409,
      code: "RESERVATION_EXPIRED",
    });
  }
  if (!sourceReq.extra?.reservation_freed) {
    throw createAppError("La solicitud origen no tiene una reserva liberada disponible", {
      status: 409,
      code: "NO_FREED_RESERVATION",
    });
  }

  // Mark source as transferred
  const sourceNextExtra = {
    ...(sourceReq.extra || {}),
    reservation_freed: {
      ...(sourceReq.extra.reservation_freed || {}),
      transferred_to: toId,
      transferred_at: now.toISOString(),
      transferred_by_email: user?.email || null,
    },
  };

  // Mark target as having received a transferred reservation
  const targetNextExtra = {
    ...(targetReq.extra || {}),
    reservation_transferred_from: {
      from_id: fromId,
      from_client_name: sourceReq.client_name,
      transferred_at: now.toISOString(),
      transferred_by_email: user?.email || null,
      original_reservation_at: sourceReq.reservation_email_sent_at,
      reservation_expires_at: sourceReq.reservation_expires_at,
    },
  };

  const client = await db.connect();
  let updatedTarget;
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE equipment_purchase_requests
          SET extra = $1::jsonb, updated_at = now()
        WHERE id = $2`,
      [JSON.stringify(sourceNextExtra), fromId],
    );

    const { rows } = await client.query(
      `UPDATE equipment_purchase_requests
          SET reservation_email_sent_at   = $1,
              reservation_expires_at      = $2,
              reservation_calendar_event_id   = $3,
              reservation_calendar_event_link = $4,
              extra = $5::jsonb,
              updated_at = now()
        WHERE id = $6
        RETURNING *`,
      [
        sourceReq.reservation_email_sent_at,
        sourceReq.reservation_expires_at,
        sourceReq.reservation_calendar_event_id || null,
        sourceReq.reservation_calendar_event_link || null,
        JSON.stringify(targetNextExtra),
        toId,
      ],
    );

    await client.query("COMMIT");
    updatedTarget = rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  try {
    await notifyUsers({
      userIds: [updatedTarget.created_by, updatedTarget.assigned_to].filter(Boolean),
      title: "Reserva transferida",
      message: `Se asignÃ³ una reserva existente (de ${sourceReq.client_name || "compra cancelada"}) a este expediente. Vence: ${new Date(sourceReq.reservation_expires_at).toLocaleDateString("es-EC")}.`,
      type: "info",
      source: "equipment_purchases",
      priority: 2,
      meta: { request_id: toId, from_id: fromId },
    });
  } catch (notifyError) {
    logger.warn({ notifyError }, "No se pudo notificar transferencia de reserva");
  }

  return updatedTarget;
}

async function updateChecklistItem({ id, user, itemKey, checked, note }) {
  throw createAppError("Checklist automÃ¡tico: no editable manualmente", {
    status: 409,
    code: "CHECKLIST_AUTO_ONLY",
  });
}

async function getStats({ requestType = "purchase" } = {}) {
  await ensureTables();
  const [statusResult, inspectionCoordResult] = await Promise.all([
    db.query(
      `SELECT status, COUNT(*)::INT AS count
         FROM equipment_purchase_requests
        WHERE request_type = $1
        GROUP BY status`,
      [requestType],
    ),
    db.query(
      `SELECT
          COUNT(*) FILTER (
            WHERE status = $2
              AND inspection_request_id IS NOT NULL
              AND inspection_scheduled_date IS NULL
          )::INT AS pending_inspection_coordination,
          COUNT(*) FILTER (
            WHERE status = $2
              AND inspection_scheduled_date IS NOT NULL
          )::INT AS coordinated_pending_contract,
          COUNT(*) FILTER (
            WHERE status = $2
              AND inspection_scheduled_date IS NULL
              AND inspection_max_date IS NOT NULL
              AND inspection_max_date < CURRENT_DATE
          )::INT AS inspection_window_expired
         FROM equipment_purchase_requests
        WHERE request_type = $1`,
      [requestType, STATUS.PENDING_CONTRACT],
    ),
  ]);

  const rows = statusResult.rows || [];
  const summary = { total: 0 };
  STATUS_STATS_ORDER.forEach((status) => {
    summary[status] = 0;
  });
  rows.forEach(({ status, count }) => {
    const value = Number(count) || 0;
    if (STATUS_STATS_ORDER.includes(status)) {
      summary[status] = value;
    }
    summary.total += value;
  });

  const inspectionMetrics = inspectionCoordResult.rows?.[0] || {};
  summary.pending_inspection_coordination = Number(inspectionMetrics.pending_inspection_coordination || 0);
  summary.coordinated_pending_contract = Number(inspectionMetrics.coordinated_pending_contract || 0);
  summary.inspection_window_expired = Number(inspectionMetrics.inspection_window_expired || 0);
  return summary;
}

const SERCOP_PROCEDURE_TYPES = new Set([
  "catalogo_electronico",
  "infima_cuantia",
  "subasta_inversa_electronica",
  "menor_cuantia",
  "cotizacion",
  "licitacion",
  "regimen_especial",
]);

async function updateSercop({ id, user, fields = {} }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);

  const isAssignee = String(request?.assigned_to || "") === String(user?.id || "");
  if (!canManageAll(user) && !isAssignee) {
    throw createAppError("Solo el ACP Comercial asignado puede actualizar datos SERCOP", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }

  const updates = {};

  if (fields.procedure_type !== undefined) {
    const pt = String(fields.procedure_type || "").trim().toLowerCase();
    if (pt && !SERCOP_PROCEDURE_TYPES.has(pt)) {
      throw createAppError(`Tipo de procedimiento invÃ¡lido: ${pt}`, { status: 400, code: "INVALID_PROCEDURE_TYPE" });
    }
    updates.procedure_type = pt || null;
  }

  const textFields = [
    "soce_process_code",
    "entidad_contratante_name",
    "entidad_contratante_ruc",
    "adjudicacion_resolution_number",
    "adjudicacion_resolution_file_id",
    "orden_compra_number",
    "pac_code",
  ];
  for (const key of textFields) {
    if (fields[key] !== undefined) {
      updates[key] = String(fields[key] || "").trim() || null;
    }
  }

  const numericFields = ["presupuesto_referencial", "puja_final_price"];
  for (const key of numericFields) {
    if (fields[key] !== undefined) {
      const v = Number(fields[key]);
      updates[key] = Number.isFinite(v) && v >= 0 ? v : null;
    }
  }

  const dateFields = [
    "puja_date",
    "adjudicacion_resolution_date",
    "acta_recepcion_provisional_date",
    "acta_recepcion_definitiva_date",
  ];
  for (const key of dateFields) {
    if (fields[key] !== undefined) {
      updates[key] = normalizeDateOnlyInput(fields[key]);
    }
  }

  const tsFields = ["oferta_tecnica_submitted_at"];
  for (const key of tsFields) {
    if (fields[key] !== undefined) {
      const v = fields[key];
      updates[key] = v ? new Date(v).toISOString() : null;
    }
  }

  if (fields.garantia_fiel_cumplimiento_submitted !== undefined) {
    updates.garantia_fiel_cumplimiento_submitted = Boolean(fields.garantia_fiel_cumplimiento_submitted);
  }

  if (Object.keys(updates).length === 0) {
    return getById(id, user);
  }

  const setClauses = Object.keys(updates)
    .map((key, i) => `${key} = $${i + 2}`)
    .join(", ");
  const values = [id, ...Object.values(updates)];

  const { rows } = await db.query(
    `UPDATE public.equipment_purchase_requests
        SET ${setClauses}, updated_at = now()
      WHERE id = $1
      RETURNING *`,
    values,
  );

  return mapRequestRow(rows[0]);
}

async function getTimeline({ id, user }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);

  const events = [];
  const wf = request?.installation_workflow || {};

  const push = (type, label, timestamp, meta = {}) => {
    if (!timestamp) return;
    const ts = new Date(timestamp);
    if (Number.isNaN(ts.getTime())) return;
    events.push({ type, label, timestamp: ts.toISOString(), ...meta });
  };

  push("REQUEST_CREATED", "Solicitud creada", request.created_at, { actor_email: request.created_by_email || null });
  push("AVAILABILITY_REQUESTED", "Disponibilidad solicitada al proveedor", request.availability_requested_at);
  push("PROVIDER_RESPONSE", "Respuesta del proveedor registrada", request.provider_response_at);
  push("PROFORMA_REQUESTED", "Proforma solicitada al proveedor", request.proforma_requested_at);
  push("PROFORMA_RECEIVED", "Proforma recibida/subida", request.proforma_uploaded_at);
  push("RESERVATION_MADE", "Equipos reservados", request.reserved_at);
  push("SIGNED_PROFORMA_UPLOADED", "Proforma firmada cargada", request.signed_proforma_uploaded_at);
  push("PORTAL_OUTCOME_REGISTERED", "Resultado portal pÃºblico registrado", request.public_portal_outcome_at, {
    outcome: request.public_portal_outcome,
  });
  push("INSPECTION_REQUESTED", "InspecciÃ³n de ambiente solicitada (F.ST-20)", request.inspection_requested_at);
  push("INSPECTION_SCHEDULED", "Fecha de inspecciÃ³n coordinada", request.inspection_scheduled_date);
  push("CONTRACT_UPLOADED", "Contrato subido", request.contract_uploaded_at);
  push("SERCOP_OFERTA_SUBMITTED", "Oferta tÃ©cnica enviada al SOCE", request.oferta_tecnica_submitted_at);
  push("SERCOP_PUJA", "SesiÃ³n de puja SOCE", request.puja_date);
  push("SERCOP_ADJUDICACION", "ResoluciÃ³n de adjudicaciÃ³n", request.adjudicacion_resolution_date, {
    resolution_number: request.adjudicacion_resolution_number,
  });
  push("EQUIPMENT_ARRIVED", "Equipo llegÃ³ a bodega", request.equipment_arrived_at);
  push("DISPATCH_READY", "Despacho listo", request.dispatch_ready_at);
  push("DELIVERY_COMPLETED", "Entrega completada", request.delivered_at);
  push("INSTALLATION_DISPATCH_REQUEST", "Solicitud formal de despacho registrada", wf.dispatch_request?.requested_at, {
    actor_email: wf.dispatch_request?.requested_by_email || null,
  });
  push("LOGISTICS_VALIDATED", "ValidaciÃ³n logÃ­stica completada (guÃ­a/proforma)", wf.logistics_validation?.validated_at, {
    actor_email: wf.logistics_validation?.validated_by_email || null,
  });
  push("FST14_COMPLETED", "RecepciÃ³n visual F.ST-14 registrada", wf.visual_reception?.inspected_at, {
    result: wf.visual_reception?.result || null,
    actor_email: wf.visual_reception?.inspected_by_email || null,
    report_link: wf.visual_reception?.report_link || null,
  });
  push("VERIFICATION_DECIDED", "DecisiÃ³n de verificaciÃ³n F.ST-09 registrada", wf.verification_decision?.decided_at, {
    applies: wf.verification_decision?.applies,
    actor_email: wf.verification_decision?.decided_by_email || null,
  });
  push("SERCOP_ACTA_PROVISIONAL", "Acta de recepciÃ³n provisional (SERCOP)", request.acta_recepcion_provisional_date);
  push("SERCOP_ACTA_DEFINITIVA", "Acta de recepciÃ³n definitiva (SERCOP)", request.acta_recepcion_definitiva_date);

  events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return { events, request_id: id, status: request.status };
}

// ----------------------------------------------------------
// WORKFLOW ALIGNMENT â€” Parte 1+2
// ----------------------------------------------------------

async function registerParticipationDecision({ id, user, decision, notes, expected_updated_at }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);

  if (!canManageAll(user)) {
    throw createAppError("Solo jefe_comercial, gerencia o acp_comercial pueden registrar la decisiÃ³n de participar", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }

  const normalized = String(decision || "").trim().toLowerCase();
  if (!["participate", "not_participate"].includes(normalized)) {
    throw createAppError("DecisiÃ³n invÃ¡lida. Usa: participate o not_participate.", {
      status: 400,
      code: "INVALID_PARTICIPATION_DECISION",
    });
  }

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET participation_decision = $1,
            participation_decision_at = now(),
            participation_decision_by = $2,
            participation_decision_notes = $3,
            updated_at = now()
      WHERE id = $4
      RETURNING *`,
    [normalized, user?.id || null, String(notes || "").trim() || null, id],
  );

  const updated = mapRequestRow(rows[0]);
  const decisionLabel = normalized === "participate" ? "Se decidiÃ³ participar" : "Se decidiÃ³ NO participar";

  try {
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title: `DecisiÃ³n de participar: ${decisionLabel}`,
      message: `${decisionLabel} en el proceso de compra pÃºblica para ${updated.client_name || "cliente"}.${notes ? ` Notas: ${notes}` : ""}`,
      type: normalized === "participate" ? "success" : "warning",
      source: "equipment_purchases_participation",
      priority: 2,
      meta: { request_id: updated.id, participation_decision: normalized },
      email: true,
      chat: true,
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated.id }, "No se pudo notificar decisiÃ³n de participar");
  }

  return updated;
}

async function registerSerialPublic({ id, user, serialNumber, unitId = null }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);

  if (request.serial_status !== "received_pending_serial") {
    throw createAppError(
      `El serial solo se registra cuando el equipo ha sido recibido fÃ­sicamente. Estado actual: ${request.serial_status || "not_applicable_yet"}`,
      {
        status: 409,
        code: "SERIAL_NOT_ALLOWED_YET",
        details: {
          current_serial_status: request.serial_status || "not_applicable_yet",
          required_serial_status: "received_pending_serial",
          hint: "Primero registra la llegada fÃ­sica del equipo (mark-equipment-arrived).",
        },
      },
    );
  }

  if (!serialNumber || !String(serialNumber).trim()) {
    throw createAppError("El nÃºmero de serie es obligatorio", {
      status: 400,
      code: "SERIAL_NUMBER_REQUIRED",
    });
  }

  const mergedExtra = mergeExtra(request?.extra, {
    serial_number: String(serialNumber).trim(),
    serial_registered_at: new Date().toISOString(),
    serial_registered_by: user?.id || null,
    ...(unitId ? { unit_id: String(unitId) } : {}),
  });

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET serial_status = 'serial_registered',
            extra = $1::jsonb,
            updated_at = now()
      WHERE id = $2
      RETURNING *`,
    [JSON.stringify(mergedExtra), id],
  );

  const updated = mapRequestRow(rows[0]);
  try {
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title: "NÃºmero de serie registrado",
      message: `Serie ${serialNumber} registrada para ${updated.client_name || "cliente"}.`,
      type: "success",
      source: "equipment_purchases_serial",
      priority: 1,
      meta: { request_id: updated.id, serial_number: serialNumber },
      email: true,
      chat: false,
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated.id }, "No se pudo notificar registro de serial");
  }

  return updated;
}

// TambiÃ©n actualiza serial_status â†’ received_pending_serial al marcar equipo llegado.
// Se inyecta en markEquipmentArrived como post-step sin romper la funciÃ³n existente.
async function _advanceSerialStatusOnArrival(id) {
  try {
    await db.query(
      `UPDATE equipment_purchase_requests
          SET serial_status = 'received_pending_serial',
              updated_at = now()
        WHERE id = $1
          AND serial_status = 'pending_reception'`,
      [id],
    );
  } catch (err) {
    logger.warn({ err, id }, "No se pudo avanzar serial_status a received_pending_serial");
  }
}

// WORKFLOW ALIGNMENT â€” Nuevas funciones
async function setPurchaseType({ id, user, purchaseType, expected_updated_at }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);

  if (!canManageAll(user)) {
    throw createAppError("Solo jefe_comercial, backoffice_comercial o gerencia pueden establecer el tipo de compra", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }

  const normalizedType = String(purchaseType || "").trim().toLowerCase();
  if (!["public", "private"].includes(normalizedType)) {
    throw createAppError("Tipo de compra invÃ¡lido. Usa: public o private.", {
      status: 400,
      code: "INVALID_PURCHASE_TYPE",
    });
  }

  assertNoStaleWrite(request, expected_updated_at);

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET purchase_type = $1,
            private_modality = CASE WHEN $1 = 'public' THEN NULL ELSE private_modality END,
            updated_at = now()
      WHERE id = $2
      RETURNING *`,
    [normalizedType, id],
  );

  const updated = mapRequestRow(rows[0]);

  return updated;
}

async function setPrivateModality({ id, user, privateModality, expected_updated_at }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);

  if (!canManageAll(user)) {
    throw createAppError("Solo jefe_comercial, backoffice_comercial o gerencia pueden establecer la modalidad privada", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }

  if (request.purchase_type !== "private") {
    throw createAppError("La modalidad privada solo aplica cuando purchase_type = private", {
      status: 409,
      code: "MODALITY_NOT_ALLOWED",
    });
  }

  const normalizedModality = String(privateModality || "").trim().toLowerCase();
  if (!["direct_sale", "rental", "rental_with_domain_transfer", "comodato"].includes(normalizedModality)) {
    throw createAppError("Modalidad invÃ¡lida. Usa: direct_sale, rental, rental_with_domain_transfer o comodato.", {
      status: 400,
      code: "INVALID_PRIVATE_MODALITY",
    });
  }

  assertNoStaleWrite(request, expected_updated_at);

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET private_modality = $1,
            updated_at = now()
      WHERE id = $2
      RETURNING *`,
    [normalizedModality, id],
  );

  const updated = mapRequestRow(rows[0]);

  return updated;
}

async function setAvailability({ id, user, availabilitySource, availabilityStatus, expected_updated_at }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);

  const directRole = normalizeRole(user?.role);
  const userRoles = getRoleTokens(user);

  const isAcpComercial = directRole === "acp_comercial" || userRoles.includes("acp_comercial");
  const isBackofficeComercial = directRole === "backoffice_comercial" || userRoles.includes("backoffice_comercial");
  const isManager = canManageAll(user);

  if (request.purchase_type === "public" && !isAcpComercial && !isManager) {
    throw createAppError("Solo ACP Comercial o gerencia pueden establecer disponibilidad para compras pÃºblicas", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }

  if (request.purchase_type === "private" && !isBackofficeComercial && !isManager) {
    throw createAppError("Solo backoffice_comercial o gerencia pueden establecer disponibilidad para compras privadas", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }

  const normalizedSource = availabilitySource ? String(availabilitySource).trim().toLowerCase() : null;
  if (normalizedSource && !["internal", "supplier"].includes(normalizedSource)) {
    throw createAppError("Fuente de disponibilidad invÃ¡lida. Usa: internal o supplier.", {
      status: 400,
      code: "INVALID_AVAILABILITY_SOURCE",
    });
  }

  const normalizedStatus = availabilityStatus ? String(availabilityStatus).trim().toLowerCase() : null;
  const validStatuses = [
    "not_checked",
    "internal_available_ready",
    "supplier_requested",
    "supplier_confirmed",
    "supplier_rejected",
    "alternative_required",
    "availability_confirmed",
  ];
  if (normalizedStatus && !validStatuses.includes(normalizedStatus)) {
    throw createAppError(`Estado de disponibilidad invÃ¡lido. Usa: ${validStatuses.join(", ")}.`, {
      status: 400,
      code: "INVALID_AVAILABILITY_STATUS",
    });
  }

  assertNoStaleWrite(request, expected_updated_at);

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET availability_source = $1,
            availability_status = $2,
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [normalizedSource || null, normalizedStatus || null, id],
  );

  const updated = mapRequestRow(rows[0]);

  return updated;
}

async function activateSupplyControl({ id, user, supplyControlType, expected_updated_at }) {
  await ensureTables();
  const request = await getById(id, user);
  assertRequestExists(request);

  if (!canManageAll(user)) {
    throw createAppError("Solo jefe_comercial o gerencia pueden activar el control de insumos", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }

  const normalizedType = String(supplyControlType || "").trim().toLowerCase();
  if (!["bc_maximums", "commercial_deliverables", "none"].includes(normalizedType)) {
    throw createAppError("Tipo de control de insumos invÃ¡lido. Usa: bc_maximums, commercial_deliverables o none.", {
      status: 400,
      code: "INVALID_SUPPLY_CONTROL_TYPE",
    });
  }

  // GAP-01: bc_maximums requiere un Business Case vinculado al expediente.
  // business_case_id es la unica columna de vinculo (unificada para compra
  // publica y privada; comodato_business_case_id nunca se escribe en ningun
  // flujo real y no se usa).
  if (normalizedType === "bc_maximums") {
    const linkedBcId = request?.business_case_id || null;
    if (!linkedBcId) {
      throw createAppError("No se puede activar 'BC MÃ¡ximos' porque este expediente no tiene un Business Case vinculado.", {
        status: 409,
        code: "NO_LINKED_BUSINESS_CASE",
      });
    }
  }

  assertNoStaleWrite(request, expected_updated_at);

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET supply_control_type = $1,
            updated_at = now()
      WHERE id = $2
      RETURNING *`,
    [normalizedType, id],
  );

  const updated = mapRequestRow(rows[0]);

  return updated;
}

module.exports = {
  getApprovedClients,
  getAcpCommercialUsers,
  getTechnicalInspectionUsers,
  getEquipmentCatalog,
  listProviderContacts,
  saveProviderContact,
  listByUser,
  getById,
  createPurchaseRequest,
  startAvailabilityRequest,
  saveProviderResponse,
  confirmCuAvailability,
  confirmAcpImportAwareness,
  requestProforma,
  uploadProforma,
  reserveEquipment,
  uploadSignedProforma,
  submitSignedProformaWithInspection,
  requestInspectionEnvironment,
  coordinateInspectionDate,
  registerSiteInspection,
  upsertInstallationWorkflow,
  reviewInspectionDateProposal,
  registerPublicPortalOutcome,
  uploadContract,
  requestDeliveryDates,
  submitDeliveryDates,
  markEquipmentArrived,
  markDispatchReady,
  completeDelivery,
  renewReservation,
  cancelOrder,
  getActiveReservations,
  getFreedReservations,
  transferReservation,
  updateChecklistItem,
  updateSercop,
  getTimeline,
  getStats,
  getTechnicalScheduleCalendar,
  registerParticipationDecision,
  registerSerialPublic,
  _advanceSerialStatusOnArrival,
  setPurchaseType,
  setPrivateModality,
  setAvailability,
  activateSupplyControl,
  STATUS,
};
