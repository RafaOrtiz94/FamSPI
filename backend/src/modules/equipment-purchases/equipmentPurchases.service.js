const db = require("../../config/db");
const logger = require("../../config/logger");
const { v4: uuidv4 } = require("uuid");
const PDFDocument = require("pdfkit");
const { ensureFolder, uploadBase64File, copyTemplate, replaceTags } = require("../../utils/drive");
const { createAllDayEvent } = require("../../utils/calendar");
const { sendMail } = require("../../utils/mailer");
const inventarioService = require("../inventario/inventario.service");
const notificationManager = require("../notifications/notificationManager");
const {
  createRequest: createServiceRequest,
  generateActa,
  updateRequestStatus,
  addDriveAttachment,
} = require("../requests/requests.service");

const DEFAULT_ROOT_ENV_KEYS = ["DRIVE_ROOT_FOLDER_ID", "DRIVE_FOLDER_ID"];
const ROOT_FOLDER_NAME = process.env.EQUIPMENT_PURCHASE_ROOT_FOLDER || "Solicitudes de compra de equipos";
const COMMERCIAL_FOLDER_NAME = "Comercial";
const PURCHASE_FOLDER_NAME = "Compras";
const CONTRACT_MAX_DAYS = 110;
const RESERVATION_REMINDER_OFFSET_DAYS = 55; // Reserva caduca a los 60 días
const CONTRACT_REMINDER_OFFSET = CONTRACT_MAX_DAYS - 15; // Avisar 15 días antes
const PROFORMA_REQUEST_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 horas
const TECHNICAL_DAILY_CAPACITY = Number.parseInt(process.env.TECHNICAL_DAILY_CAPACITY || "3", 10);

let initialized = false;

const STATUS = {
  PENDING_PROVIDER: "pending_provider_assignment",
  WAITING_PROVIDER: "waiting_provider_response",
  NO_STOCK: "no_stock",
  WAITING_PROFORMA: "waiting_proforma",
  PROFORMA_RECEIVED: "proforma_received",
  WAITING_SIGNED_PROFORMA: "waiting_signed_proforma",
  PENDING_CONTRACT: "pending_contract",
  CONTRACT_AVAILABLE: "contract_available",
  DELIVERY_DATES_REQUESTED: "delivery_dates_requested",
  DELIVERY_DATES_SUBMITTED: "delivery_dates_submitted",
  WAITING_DISPATCH: "waiting_dispatch",
  DISPATCH_READY: "dispatch_ready",
  COMPLETED: "completed",
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

const MANAGER_ROLES = new Set(["acp_comercial", "gerencia", "gerencia_general", "jefe_comercial"]);
const ACTION_BY_STATUS = {
  [STATUS.PENDING_PROVIDER]: "start_availability",
  [STATUS.WAITING_PROVIDER]: "save_provider_response",
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
    label: "Términos de proforma validados",
    auto: true,
    validator: (request) => Boolean(request?.proforma_file_id || request?.proforma_uploaded_at),
  },
  inspection_date_coordinated: {
    label: "Fecha de inspección coordinada (comercial+técnico)",
    auto: true,
    validator: (request) => Boolean(request?.inspection_min_date && request?.inspection_max_date),
  },
  technical_window_confirmed: {
    label: "Ventana técnica confirmada",
    auto: true,
    validator: (request) => Boolean(request?.inspection_min_date && request?.inspection_max_date),
  },
  contract_ready_for_signature: {
    label: "Contrato listo para firma (fecha coordinada)",
    auto: true,
    validator: (request) => Boolean(
      request?.signed_proforma_file_id &&
      request?.inspection_request_id &&
      request?.inspection_scheduled_date,
    ),
  },
  signed_proforma_uploaded: {
    label: "Proforma firmada subida",
    auto: true,
    validator: (request) => Boolean(request?.signed_proforma_file_id),
  },
  inspection_date_confirmed: {
    label: "Fecha de inspección coordinada",
    auto: true,
    validator: (request) => Boolean(request?.inspection_scheduled_date),
  },
  delivery_dates_defined: {
    label: "Fechas de entrega definidas",
    auto: true,
    validator: (request) => Boolean(request?.delivery_start_at && request?.delivery_end_at),
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
    "assignee_confirmed",
    "provider_contact_verified",
    "commercial_context_validated",
  ],
  request_or_upload_proforma: ["accepted_items_validated"],
  reserve_equipment: ["proforma_terms_validated"],
  submit_signed_with_inspection: ["proforma_terms_validated"],
  request_inspection: ["signed_proforma_uploaded"],
  upload_contract: ["inspection_date_confirmed", "contract_ready_for_signature"],
  request_delivery_dates: ["inspection_date_confirmed"],
  submit_delivery_dates: [],
  mark_equipment_arrived: ["delivery_dates_defined"],
  mark_dispatch_ready: ["delivery_dates_defined", "equipment_arrived"],
  complete_delivery: ["dispatch_ready_confirmed"],
};
const ACTION_ALLOWED_STATUSES = {
  start_availability: [STATUS.PENDING_PROVIDER],
  save_provider_response: [STATUS.WAITING_PROVIDER],
  request_or_upload_proforma: [STATUS.WAITING_PROFORMA],
  reserve_equipment: [STATUS.PROFORMA_RECEIVED],
  submit_signed_with_inspection: [STATUS.WAITING_SIGNED_PROFORMA],
  request_inspection: [STATUS.WAITING_SIGNED_PROFORMA, STATUS.PENDING_CONTRACT],
  coordinate_inspection_date: [STATUS.WAITING_SIGNED_PROFORMA, STATUS.PENDING_CONTRACT],
  upload_contract: [STATUS.PENDING_CONTRACT],
  request_delivery_dates: [STATUS.CONTRACT_AVAILABLE],
  submit_delivery_dates: [STATUS.DELIVERY_DATES_REQUESTED],
  mark_equipment_arrived: [STATUS.DELIVERY_DATES_SUBMITTED],
  mark_dispatch_ready: [STATUS.WAITING_DISPATCH],
  complete_delivery: [STATUS.DISPATCH_READY],
};
const PURCHASE_PROCESS_TEMPLATE_ID =
  process.env.PURCHASE_PROCESS_TEMPLATE_ID || process.env.EQUIPMENT_PURCHASE_PROCESS_TEMPLATE_ID || null;

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function getRoleTokens(user) {
  const rawRole = user?.role;
  const rawScope = user?.scope;
  const roleValues = Array.isArray(rawRole) ? rawRole : [rawRole];
  const scopeValues = Array.isArray(rawScope) ? rawScope : [rawScope];
  return [...roleValues, ...scopeValues]
    .flatMap((value) => String(value || "").split(/[,\s]+/))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function hasRoleToken(user, token) {
  const normalizedToken = String(token || "").toLowerCase();
  return getRoleTokens(user).some((role) => role.includes(normalizedToken));
}

function canViewInspectionQueue(user) {
  return ["jefe_tecnico", "jefe_servicio_tecnico", "tecnico"].some((role) =>
    hasRoleToken(user, role),
  );
}

function canCoordinateInspection(user) {
  return [
    "jefe_tecnico",
    "jefe_servicio_tecnico",
  ].some((role) => hasRoleToken(user, role));
}

function canReviewInspectionCoordination(user) {
  return [
    "jefe_tecnico",
    "jefe_servicio_tecnico",
  ].some((role) => hasRoleToken(user, role));
}

function canManageDelivery(user) {
  return [
    "acp_comercial",
    "gerencia",
    "gerencia_general",
    "jefe_comercial",
    "jefe_operaciones",
    "jefe_logistica",
    "jefe_tecnico",
    "jefe_servicio_tecnico",
    "tecnico",
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
  throw createAppError("La solicitud no está en el estado requerido para esta acción", {
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
    throw createAppError("Marca de versión inválida para control de concurrencia", {
      status: 400,
      code: "INVALID_CONCURRENCY_TOKEN",
    });
  }

  // Tolerancia de 1 segundo para diferencias de serialización.
  if (Math.abs(expectedMs - currentMs) <= 1000) return;

  throw createAppError("La solicitud cambió en otra sesión. Refresca e intenta nuevamente.", {
    status: 409,
    code: "STALE_REQUEST_STATE",
    details: {
      expected_updated_at: new Date(expectedMs).toISOString(),
      current_updated_at: new Date(currentMs).toISOString(),
    },
    retryable: true,
  });
}

async function getSingleUserByRole(role) {
  if (!role) return null;
  try {
    const { rows } = await db.query(
      'SELECT id, email, fullname FROM users WHERE role = $1 AND active = true ORDER BY id ASC LIMIT 1',
      [role],
    );
    return rows[0] || null;
  } catch (error) {
    logger.warn({ error, role }, 'No se pudo resolver usuario por rol');
    return null;
  }
}

async function notifyUsers({ userIds = [], title, message, type = "info", source, priority = 1, meta = {} }) {
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
      email: true,
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

function mapRequestRow(row = {}) {
  const extra = typeof row.extra === "string" ? safeJsonParse(row.extra) : row.extra;
  const checklist = typeof row.checklist === "string" ? safeJsonParse(row.checklist, {}) : (row.checklist || {});
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
  return {
    ...row,
    extra,
    checklist,
    request_type: row.request_type || "purchase",
    proforma_file_link: driveLink(row.proforma_file_id),
    signed_proforma_file_link: driveLink(row.signed_proforma_file_id),
    contract_file_link: driveLink(row.contract_file_id),
    process_doc_link: row.process_doc_url || driveLink(row.process_doc_id),
    inspection_request_id: row.inspection_request_id || null,
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

function getAcceptedItems(request) {
  if (!request?.provider_response?.items) return [];
  return request.provider_response.items.filter(
    (item) => item && item.decision !== "reject" && item.available_type !== "none",
  );
}

function formatEquipmentList(items) {
  const list = (items || []).map((item) => {
    const label = item.available_type === "cu" ? "CU" : "Nuevo";
    const name = item.name || item.sku || item.id || "Equipo";
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
        const label = item.available_type === "cu" ? "CU" : "Nuevo";
        const name = item.name || item.sku || item.id || `Equipo ${idx + 1}`;
        const serial = item.serial ? ` - Serie: ${item.serial}` : "";
        doc.text(`• ${name}${serial} (${label})`);
      });
    } else {
      doc.text("Sin equipos aceptados registrados");
    }

    if (requestedItems.length) {
      doc.moveDown();
      doc.fontSize(14).text("Equipos solicitados");
      doc.fontSize(12);
      requestedItems.forEach((item, idx) => {
        const label = item.type === "cu" ? "CU" : "Nuevo";
        const name = item.name || item.sku || item.id || `Equipo ${idx + 1}`;
        const serial = item.serial ? ` - Serie: ${item.serial}` : "";
        doc.text(`• ${name}${serial} (${label})`);
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
      drive_folder_id TEXT,
      extra JSONB,
      request_type TEXT DEFAULT 'purchase',
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
    `UPDATE equipment_purchase_provider_contacts
        SET email = lower(trim(email)),
            updated_at = now()
      WHERE email IS NOT NULL
        AND email <> lower(trim(email))`,
  );
  await db.query(
    `DELETE FROM equipment_purchase_provider_contacts a
      USING equipment_purchase_provider_contacts b
      WHERE a.id < b.id
        AND lower(trim(a.email)) = lower(trim(b.email))`,
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

function buildInspectionPayload({ request, clientInfo, inspection_min_date, inspection_max_date, includes_starter_kit }) {
  const equipment = Array.isArray(request.equipment) ? request.equipment : [];
  const extra = request?.extra || {};
  const requiresLis = Boolean(extra.requires_lis || extra.requiere_lis);
  // El esquema espera un booleano para requiere_lis
  const lisValue = requiresLis;
  const equipos = equipment.map((item) => ({
    nombre_equipo: item.name || item.sku || item.id || "Equipo",
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
  const hasActa =
    inspectionRequest?.document || inspectionRequest?.request?.status === "acta_generada";

  if (!requestId || hasActa) return inspectionRequest;

  try {
    const document = await generateActa(requestId, user.id, "inspection");
    await updateRequestStatus(requestId, "acta_generada");
    return { ...inspectionRequest, document };
  } catch (error) {
    logger.error(
      "No se pudo generar acta de inspección automática para solicitud %s: %s",
      requestId,
      error.message,
    );
    return inspectionRequest;
  }
}

async function ensureAutoBusinessCaseForPurchase({ purchaseRequest, user, inspectionId }) {
  if (!purchaseRequest?.id) return null;
  const extra = purchaseRequest.extra || {};
  const existingBcId = extra.auto_business_case_id || null;
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

  const mergedExtra = {
    ...extra,
    auto_business_case_id: bcId,
    auto_business_case_created_at: new Date().toISOString(),
  };
  await db.query(
    `UPDATE equipment_purchase_requests
        SET extra = $1::jsonb,
            updated_at = now()
      WHERE id = $2`,
    [JSON.stringify(mergedExtra), purchaseRequest.id],
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

async function sendAndArchive({ user, to, subject, html, cc, folderId, prefix, request, actionLabel }) {
  await sendMail({
    to,
    cc,
    subject,
    html,
    gmailUserId: user?.id,
    from: user?.email,
    replyTo: user?.email,
  });
  return archiveEmail({ html, subject, folderId, prefix, request, actionLabel, user });
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
  let query = `SELECT * FROM equipment_purchase_requests`;
  if (!canManageAll(user) && canViewInspectionQueue(user)) {
    query += ` WHERE status = ANY($1::text[])
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
  } else if (!canManageAll(user)) {
    query += ` WHERE created_by = $1 OR assigned_to = $1`;
    params.push(user.id);
  }

  query += ` ORDER BY created_at DESC`;

  const { rows } = await db.query(query, params);
  return rows.map(mapRequestRow);
}

async function listTechnicalSchedule({ from, to, excludePublicRequestId = null, excludeInspectionRequestId = null }) {
  await ensureTables();
  const fromDate = String(from || "").slice(0, 10);
  const toDate = String(to || "").slice(0, 10);
  if (!fromDate || !toDate) return [];

  const { rows } = await db.query(
    `
      SELECT activity_date, source_type, summary
      FROM (
        SELECT
          a.activity_date::date AS activity_date,
          'actividad_tecnica'::text AS source_type,
          COALESCE(a.title, 'Actividad técnica') AS summary
        FROM servicio.cronograma_actividades_tecnicas a
        WHERE a.activity_date BETWEEN $1::date AND $2::date
          AND COALESCE(lower(a.status), 'programado') IN ('programado', 'confirmado', 'en_proceso')

        UNION ALL

        SELECT
          m.fecha_programada::date AS activity_date,
          'mantenimiento'::text AS source_type,
          COALESCE(m.descripcion, 'Mantenimiento programado') AS summary
        FROM servicio.cronograma_mantenimientos m
        WHERE m.fecha_programada BETWEEN $1::date AND $2::date
          AND COALESCE(lower(m.estado), 'pendiente') IN ('pendiente', 'en proceso')

        UNION ALL

        SELECT
          c.fecha::date AS activity_date,
          'capacitacion'::text AS source_type,
          COALESCE(c.titulo, 'Capacitación técnica') AS summary
        FROM servicio.cronograma_capacitacion c
        WHERE c.fecha BETWEEN $1::date AND $2::date
          AND COALESCE(lower(c.estado), 'programado') NOT IN ('cancelada', 'cancelado')

        UNION ALL

        SELECT
          epr.inspection_scheduled_date::date AS activity_date,
          'inspeccion_compra_publica'::text AS source_type,
          COALESCE(epr.client_name, 'Inspección compra pública') AS summary
        FROM equipment_purchase_requests epr
        WHERE epr.inspection_scheduled_date BETWEEN $1::date AND $2::date
          AND ($3::uuid IS NULL OR epr.id <> $3::uuid)
          AND COALESCE(epr.status, '') NOT IN ('completed')

        UNION ALL

        SELECT
          ppr.inspection_scheduled_date::date AS activity_date,
          'inspeccion_compra_privada'::text AS source_type,
          COALESCE(ppr.client_name, 'Inspección compra privada') AS summary
        FROM private_purchase_requests ppr
        WHERE ppr.inspection_scheduled_date BETWEEN $1::date AND $2::date
          AND COALESCE(ppr.status, '') NOT IN ('completed', 'cancelled')

        UNION ALL

        SELECT
          (r.payload->>'fecha_instalacion')::date AS activity_date,
          'solicitud_inspeccion'::text AS source_type,
          COALESCE(r.payload->>'nombre_cliente', 'Solicitud de inspección') AS summary
        FROM requests r
        JOIN request_types rt ON rt.id = r.request_type_id
        WHERE rt.code = 'F.ST-20'
          AND (r.payload->>'fecha_instalacion') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          AND (r.payload->>'fecha_instalacion')::date BETWEEN $1::date AND $2::date
          AND ($4::int IS NULL OR r.id <> $4::int)
          AND COALESCE(r.status, '') NOT IN ('rechazado', 'cancelado')
      ) AS timeline
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
    throw createAppError("No autorizado para consultar cronograma técnico", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }
  const rows = await listTechnicalSchedule({ from, to });
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

  return mapped;
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
  clientEmail,
  providerEmail,
  assignedTo,
  equipment = [],
  notes,
  extra,
  requestType = "purchase",
}) {
  await ensureTables();
  if (!clientName) {
    throw new Error("El cliente es obligatorio");
  }

  if (!equipment.length) {
    throw new Error("Cliente y al menos un equipo son obligatorios");
  }

  const canSendAvailability = canManageAll(user);
  const provider = canSendAvailability ? providerEmail : null;

  const assigneeUser = assignedTo ? await getUserById(assignedTo) : null;
  const resolvedAssignee = assigneeUser || (canSendAvailability ? user : null);

  if (!resolvedAssignee) {
    throw new Error("Debes asignar la solicitud a un ACP Comercial");
  }

  const id = uuidv4();
  const createdAt = new Date();
  const folderId = await ensurePurchaseFolder(clientName);

  const extraPayload = {
    ...(extra || {}),
    requires_lis: Boolean(extra?.requires_lis),
    lis_system: extra?.requires_lis ? (extra?.lis_system || null) : null,
  };

  let emailFileId = null;
  let status = STATUS.PENDING_PROVIDER;

  const equipmentList = equipment
    .map((item) => {
      const typeLabel = item.type === "cu" ? " (CU)" : " (Nuevo)";
      const name = item.name || item.sku || item.id || "Equipo";
      return `• ${name}${typeLabel}`;
    })
    .join("<br>");

  const html = `
      <h2>Solicitud de disponibilidad</h2>
      <p>Equipos requeridos para la solicitud #${id}:</p>
      <p>${equipmentList}</p>
      ${notes ? `<p>Notas: ${notes}</p>` : ""}
    `;

  const requestSnapshot = {
    id,
    client_name: clientName,
    provider_email: provider,
    equipment,
    created_at: createdAt,
    notes,
  };

  if (provider) {
    emailFileId = await sendAndArchive({
      user,
      to: provider,
      subject: `Disponibilidad de equipos - Solicitud #${id}`,
      html,
      folderId,
      prefix: "disponibilidad",
      request: requestSnapshot,
      actionLabel: "Informe de disponibilidad de equipos",
    });
    status = STATUS.WAITING_PROVIDER;
  }

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
      clientName,
      clientEmail || null,
      notes || null,
      provider,
      JSON.stringify(equipment),
      status,
      provider ? new Date() : null,
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
      title: "Nueva solicitud de compra pública",
      message: `${created.client_name || "Cliente"} · Solicitud creada`,
      type: "task",
      source: "equipment_purchases",
      priority: 1,
      meta: { request_id: created.id, client_name: created.client_name },
    });
    await notifyUsers({
      userIds: [created.created_by],
      title: "Solicitud enviada",
      message: "Tu solicitud de compra pública fue enviada para aprobación.",
      type: "info",
      source: "equipment_purchases",
      priority: 0,
      meta: { request_id: created.id, client_name: created.client_name },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: created.id }, "No se pudieron enviar notificaciones de creación");
  }

  return created;
}

async function startAvailabilityRequest({ id, user, providerEmail, notes, expected_updated_at }) {
  await ensureTables();
  if (!canManageAll(user)) {
    throw createAppError("Solo el ACP Comercial puede enviar el correo de disponibilidad", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }
  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  if (!providerEmail) throw createAppError("El correo del proveedor es obligatorio", { code: "PROVIDER_EMAIL_REQUIRED" });
  assertActionStatus(request, "start_availability");

  const equipment = Array.isArray(request.equipment) ? request.equipment : [];
  if (!equipment.length) throw createAppError("No hay equipos registrados para solicitar disponibilidad", {
    code: "EMPTY_EQUIPMENT_LIST",
  });
  // Permite validar checklist con el correo/notas que ACP está ingresando en esta misma acción.
  const requestForChecklist = {
    ...request,
    provider_email: providerEmail || request.provider_email,
    notes: notes || request.notes,
  };
  assertChecklistReady(requestForChecklist, "start_availability");

  const equipmentList = equipment
    .map((item) => {
      const typeLabel = item.type === "cu" ? " (CU)" : " (Nuevo)";
      const name = item.name || item.sku || item.id || "Equipo";
      return `• ${name}${typeLabel}`;
    })
    .join("<br>");

  const html = `
    <h2>Solicitud de disponibilidad</h2>
    <p>Equipos requeridos para la solicitud #${request.id}:</p>
    <p>${equipmentList}</p>
    ${notes ? `<p>Notas: ${notes}</p>` : request.notes ? `<p>Notas: ${request.notes}</p>` : ""}
  `;

  const requestSnapshot = {
    id: request.id,
    client_name: request.client_name,
    provider_email: providerEmail,
    equipment,
    created_at: request.created_at,
    notes: notes || request.notes,
  };

  const emailFileId = await sendAndArchive({
    user,
    to: providerEmail,
    subject: `Disponibilidad de equipos - Solicitud #${request.id}`,
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
            updated_at = now()
      WHERE id = $5
      RETURNING *`,
    [providerEmail, notes || request.notes || null, STATUS.WAITING_PROVIDER, emailFileId, id],
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

  const normalizedOutcome = outcome === "none" ? STATUS.NO_STOCK : STATUS.WAITING_PROFORMA;
  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET provider_response = $1,
            provider_response_at = now(),
            status = $2,
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [
      { outcome, items, notes },
      normalizedOutcome,
      id,
    ],
  );
  const updated = rows[0];
  try {
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title: "Respuesta de disponibilidad",
      message: `Proveedor respondió disponibilidad para ${updated.client_name || "cliente"}.`,
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

  const html = `
    <p>Hola,</p>
    <p>Por favor envíanos la proforma de los siguientes equipos para la solicitud #${request.id}:</p>
    ${formatEquipmentList(acceptedItems)}
  `;

  const emailFileId = await sendAndArchive({
    user,
    to: request.provider_email,
    subject: `Proforma requerida - Solicitud #${request.id}`,
    html,
    folderId: request.drive_folder_id,
    prefix: "proforma",
    request,
    actionLabel: "Solicitud de proforma",
  });

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET status = $1,
            proforma_requested_at = now(),
            proforma_request_email_file_id = $2,
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [STATUS.WAITING_PROFORMA, emailFileId, id],
  );
  const updated = rows[0];
  try {
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title: "Proforma solicitada",
      message: `Se solicitó la proforma para ${updated.client_name || "cliente"}.`,
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
  // La carga de proforma es precisamente la acción que completa este paso.
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

  try {
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title: "Proforma recibida",
      message: `Se recibió la proforma para ${updated.client_name || "cliente"}.`,
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

  const html = `
    <p>Solicitamos reservar los equipos cotizados para la solicitud #${request.id}.</p>
    <p>Adjuntamos la proforma recibida y confirmamos reserva para:</p>
    ${formatEquipmentList(acceptedItems)}
  `;

  const emailFileId = await sendAndArchive({
    user,
    to: request.provider_email,
    subject: `Reserva de equipos - Solicitud #${request.id}`,
    html,
    folderId: request.drive_folder_id,
    prefix: "reserva",
    request,
    actionLabel: "Confirmación de reserva",
  });

  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() + RESERVATION_REMINDER_OFFSET_DAYS);
  let calendarEvent = {};
  try {
    calendarEvent = await createAllDayEvent({
      summary: `Recordatorio de reserva - ${request.client_name}`,
      description: "La reserva caduca a los 60 días. Confirma cierre o renovación.",
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
            reservation_email_file_id = $2,
            reservation_calendar_event_id = $3,
            reservation_calendar_event_link = $4,
            updated_at = now()
      WHERE id = $5
      RETURNING *`,
    [
      STATUS.WAITING_SIGNED_PROFORMA,
      emailFileId,
      calendarEvent.id || null,
      calendarEvent.htmlLink || null,
      id,
    ],
  );
  const updated = rows[0];
  try {
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title: "Reserva enviada",
      message: `Se envió la reserva para ${updated.client_name || "cliente"}.`,
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
  const arrivalHtml = `
    <p>Hemos recibido la proforma firmada asociada a la solicitud #${request.id}.</p>
    <p>Por favor confirma el tiempo de llegada de los siguientes equipos:</p>
    ${formatEquipmentList(acceptedItems)}
  `;

  const arrivalFileId = await sendAndArchive({
    user,
    to: request.provider_email,
    subject: `Tiempo de llegada - Solicitud #${request.id}`,
    html: arrivalHtml,
    folderId: request.drive_folder_id,
    prefix: "tiempo-llegada",
    request,
    actionLabel: "Solicitud de tiempo de llegada",
  });

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + CONTRACT_REMINDER_OFFSET);
  let contractReminder = {};
  try {
    contractReminder = await createAllDayEvent({
      summary: `Subir contrato firmado - ${request.client_name}`,
      description: "El contrato debe estar firmado antes de vencer el plazo del proceso de compra.",
      date: dueDate,
      attendees: [user.email].filter(Boolean),
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
            inspection_min_date = $3,
            inspection_max_date = $4,
            includes_starter_kit = $5,
            inspection_recorded_at = now(),
            contract_reminder_event_id = $6,
            contract_reminder_event_link = $7,
            status = $8,
            updated_at = now()
      WHERE id = $9
      RETURNING *`,
    [
      fileId,
      arrivalFileId,
      inspection_min_date || null,
      inspection_max_date || null,
      includes_starter_kit === true,
      contractReminder.id || null,
      contractReminder.htmlLink || null,
      STATUS.PENDING_CONTRACT,
      id,
    ],
  );
  const updated = rows[0];
  try {
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title: "Proforma firmada",
      message: `Se subió la proforma firmada para ${updated.client_name || "cliente"}.`,
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
  inspection_min_date,
  inspection_max_date,
  includes_starter_kit,
  expected_updated_at,
}) {
  if (!inspection_min_date || !inspection_max_date) {
    throw createAppError("Las fechas de inspección mínima y máxima son obligatorias", {
      code: "INSPECTION_WINDOW_REQUIRED",
    });
  }

  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "submit_signed_with_inspection");
  assertChecklistReady(request, "submit_signed_with_inspection");

  const signedResult = await uploadSignedProforma({
    id,
    user,
    file,
    inspection_min_date,
    inspection_max_date,
    includes_starter_kit,
    expected_updated_at,
  });

  const clientInfo = await getClientDetails(request.client_id);
  const payload = buildInspectionPayload({
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

  const inspectionWithActa = await ensureActaForInspection({
    inspectionRequest,
    user,
  });

  const inspectionId = inspectionWithActa?.request?.id || inspectionRequest?.request?.id;
  const inspectionActaFileId =
    inspectionWithActa?.document?.pdfId ||
    inspectionWithActa?.document?.id ||
    inspectionRequest?.document?.pdfId ||
    inspectionRequest?.document?.id ||
    null;
  const inspectionActaLink =
    inspectionWithActa?.document?.pdfLink ||
    inspectionWithActa?.document?.link ||
    inspectionRequest?.document?.pdfLink ||
    inspectionRequest?.document?.link ||
    null;

  if (inspectionId) {
    const mergedExtra = mergeExtra(request?.extra, {
      inspection_request_id: inspectionId,
      inspection_acta_file_id: inspectionActaFileId,
      inspection_acta_link: inspectionActaLink,
      inspection_acta_generated_at: new Date().toISOString(),
    });
    await db.query(
      `UPDATE equipment_purchase_requests
          SET inspection_request_id = $1,
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
              extra = $2::jsonb,
              updated_at = now()
        WHERE id = $3`,
      [inspectionId, JSON.stringify(mergedExtra), id],
    );

    if (signedResult?.signed_proforma_file_id) {
      await addDriveAttachment({
        request_id: inspectionId,
        drive_file_id: signedResult.signed_proforma_file_id,
        title: "Proforma firmada",
      });
    }
  }

  try {
    await notifyUsers({
      userIds: [signedResult?.created_by, signedResult?.assigned_to],
      title: "Inspeccion creada",
      message: `Se genero la inspeccion para ${signedResult?.client_name || "cliente"}.`,
      type: "info",
      source: "equipment_purchases",
      priority: 1,
      meta: { request_id: signedResult?.id, inspection_id: inspectionId || null },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: signedResult?.id }, "No se pudieron enviar notificaciones de inspeccion");
  }

  try {
    const autoBusinessCaseId = await ensureAutoBusinessCaseForPurchase({
      purchaseRequest: signedResult,
      user,
      inspectionId,
    });
    if (autoBusinessCaseId) {
      await notifyUsers({
        userIds: [signedResult?.created_by, signedResult?.assigned_to],
        title: "Business Case creado automáticamente",
        message: `Se creó el BC ${autoBusinessCaseId} para ${signedResult?.client_name || "cliente"}.`,
        type: "task",
        source: "equipment_purchases",
        priority: 1,
        meta: {
          request_id: signedResult?.id,
          business_case_id: autoBusinessCaseId,
          auto_created: true,
        },
      });
    }
  } catch (bcError) {
    logger.error({ bcError, requestId: signedResult?.id }, "No se pudo crear BC automatico para compra publica");
  }

  return { purchase_request: signedResult, inspection_request: inspectionWithActa };
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
    throw createAppError("Las fechas de inspección mínima y máxima son obligatorias", {
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
    const payload = buildInspectionPayload({
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
      await updateRequestStatus(inspectionId, "acta_generada");
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
      title: "Inspección de ambiente solicitada",
      message: `Se registró solicitud de inspección para ${updated?.client_name || "cliente"}.`,
      type: "info",
      source: "equipment_purchases",
      priority: 1,
      meta: { request_id: updated?.id, inspection_id: inspectionId || null },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated?.id }, "No se pudieron enviar notificaciones de solicitud de inspección");
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
        title: "Business Case creado automáticamente",
        message: `Se creó el BC ${autoBusinessCaseId} para ${updated?.client_name || "cliente"}.`,
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
    logger.error({ bcError, requestId: updated?.id }, "No se pudo crear BC automático al solicitar inspección");
  }

  return {
    purchase_request: mapRequestRow(updated),
    inspection_request: inspectionWithActa,
  };
}

async function coordinateInspectionDate({ id, user, inspection_date, notes, expected_updated_at }) {
  await ensureTables();

  if (!canCoordinateInspection(user)) {
    throw createAppError("No autorizado para coordinar fecha de inspección", {
      status: 403,
      code: "FORBIDDEN_COORDINATION",
    });
  }

  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "coordinate_inspection_date");
  if (!request.inspection_min_date || !request.inspection_max_date) {
    throw createAppError("Primero define la ventana mínima y máxima de inspección", {
      status: 409,
      code: "INSPECTION_WINDOW_REQUIRED",
    });
  }
  if (!inspection_date) {
    throw createAppError("La fecha coordinada de inspección es obligatoria", {
      status: 400,
      code: "INSPECTION_DATE_REQUIRED",
    });
  }

  const scheduled = new Date(`${inspection_date}T00:00:00`);
  const minDate = new Date(`${request.inspection_min_date}T00:00:00`);
  const maxDate = new Date(`${request.inspection_max_date}T00:00:00`);
  if (
    Number.isNaN(scheduled.getTime()) ||
    Number.isNaN(minDate.getTime()) ||
    Number.isNaN(maxDate.getTime())
  ) {
    throw createAppError("Formato de fecha inválido para coordinación", {
      status: 400,
      code: "INVALID_DATE_FORMAT",
    });
  }

  if (scheduled.getTime() < minDate.getTime() || scheduled.getTime() > maxDate.getTime()) {
    throw createAppError("La fecha coordinada debe estar dentro de la ventana de inspección", {
      status: 409,
      code: "INSPECTION_DATE_OUT_OF_WINDOW",
      details: {
        min_date: request.inspection_min_date,
        max_date: request.inspection_max_date,
      },
    });
  }

  const conflictRows = await listTechnicalSchedule({
    from: inspection_date,
    to: inspection_date,
    excludePublicRequestId: id,
    excludeInspectionRequestId: request.inspection_request_id || null,
  });
  if (conflictRows.length >= TECHNICAL_DAILY_CAPACITY) {
    throw createAppError(
      "El cronograma técnico está lleno para esa fecha. Selecciona otro día.",
      {
        status: 409,
        code: "TECHNICAL_SCHEDULE_FULL",
        details: {
          date: inspection_date,
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
    throw createAppError("No existe solicitud de inspección asociada para coordinar la fecha", {
      status: 409,
      code: "INSPECTION_REQUEST_REQUIRED",
    });
  }

  const extraBase = request?.extra || {};
  const mergedExtra = mergeExtra(extraBase, {
    inspection_request_id: request.inspection_request_id,
    inspection_coordination_confirmed_at: new Date().toISOString(),
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
      inspection_date,
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
      [inspection_date, request.inspection_request_id],
    );
    const regeneratedActa = await generateActa(request.inspection_request_id, user.id, "inspection");
    await updateRequestStatus(request.inspection_request_id, "acta_generada");

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
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title: "Fecha de inspección coordinada",
      message: `Jefe Técnico coordinó inspección para ${updated.client_name || "cliente"} el ${inspection_date}.`,
      type: "task",
      source: "equipment_purchases",
      priority: 1,
      meta: { request_id: updated.id, inspection_date },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated.id }, "No se pudieron enviar notificaciones de coordinación");
  }

  return updated;
}

async function reviewInspectionDateProposal({ id, user, decision, review_notes, expected_updated_at }) {
  await ensureTables();
  if (!canReviewInspectionCoordination(user)) {
    throw createAppError("No autorizado para revisar la coordinación de inspección", {
      status: 403,
      code: "FORBIDDEN_COORDINATION_REVIEW",
    });
  }

  const normalizedDecision = String(decision || "").toLowerCase();
  if (!["accept", "reject"].includes(normalizedDecision)) {
    throw createAppError("Decisión inválida. Usa 'accept' o 'reject'.", {
      status: 400,
      code: "INVALID_REVIEW_DECISION",
    });
  }

  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "coordinate_inspection_date");
  if (!request.inspection_request_id) {
    throw createAppError("No existe solicitud de inspección asociada", {
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
    return mapRequestRow(rows[0]);
  }

  const conflictRows = await listTechnicalSchedule({
    from: proposalDate,
    to: proposalDate,
    excludePublicRequestId: id,
    excludeInspectionRequestId: request.inspection_request_id || null,
  });
  if (conflictRows.length >= TECHNICAL_DAILY_CAPACITY) {
    throw createAppError("El cronograma técnico está lleno para esa fecha.", {
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
    await updateRequestStatus(request.inspection_request_id, "acta_generada");
  } catch (actaError) {
    logger.error(
      { actaError, purchaseRequestId: id, inspectionRequestId: request.inspection_request_id },
      "No se pudo regenerar/actualizar el acta al aprobar inspección",
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

  try {
    await notifyUsers({
      userIds: [updated.created_by, updated.assigned_to],
      title: "Fecha de inspección aprobada",
      message: `Jefe Técnico confirmó inspección para ${updated.client_name || "cliente"} el ${proposalDate}.`,
      type: "task",
      source: "equipment_purchases",
      priority: 1,
      meta: { request_id: updated.id, inspection_date: proposalDate },
    });
  } catch (notifyError) {
    logger.warn({ notifyError, requestId: updated.id }, "No se pudieron enviar notificaciones de aprobación");
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

  const autoBusinessCaseId = request?.extra?.auto_business_case_id || null;
  if (!autoBusinessCaseId) {
    throw createAppError("No se encontró el Business Case automático asociado", {
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
    throw createAppError("El Business Case asociado no existe o no es válido", {
      status: 409,
      code: "BUSINESS_CASE_INVALID",
    });
  }
  if (String(bc.bc_stage || "").toLowerCase() !== "factible") {
    throw createAppError(
      "No puedes subir contrato: el Business Case aún no está resuelto como factible",
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
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [fileId, STATUS.CONTRACT_AVAILABLE, id],
  );

  const completed = rows[0];

  try {
    const gerencia = await getSingleUserByRole("gerencia_general");
    await notifyUsers({
      userIds: [completed.created_by, completed.assigned_to, gerencia?.id],
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

  // Enviar notificación automática de contrato disponible para entrega
  setImmediate(async () => {
    try {
      const acceptedItems = getAcceptedItems(completed);
      const equipmentNames = acceptedItems.map(item => item.name || item.sku || item.id || "Equipo").join(", ");

      // Notificar al usuario que creó la solicitud
      if (request.created_by) {
        await notificationManager.sendNotification({
          userId: request.created_by,
          template: 'equipment_available',
          data: {
            equipment_name: equipmentNames,
            request_id: id,
            client_name: request.client_name,
            completed_at: new Date().toISOString()
          },
          email: true,
          source: 'equipment_purchase'
        });
      }

      // Notificar al usuario asignado si es diferente
      if (request.assigned_to && request.assigned_to !== request.created_by) {
        await notificationManager.sendNotification({
          userId: request.assigned_to,
          template: 'equipment_available',
          data: {
            equipment_name: equipmentNames,
            request_id: id,
            client_name: request.client_name,
            completed_at: new Date().toISOString()
          },
          email: true,
          source: 'equipment_purchase'
        });
      }
    } catch (error) {
      logger.error('Error enviando notificación de equipo disponible:', error);
      // No lanzamos error para no detener el flujo
    }
  });

  return completed;
}

async function requestDeliveryDates({ id, user, notes, expected_updated_at }) {
  await ensureTables();
  if (!canManageDelivery(user)) {
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
    message: `Se solicitó registrar fechas de entrega para ${updated.client_name || "el cliente"}.`,
    meta: { status: updated.status },
  });
  return updated;
}

async function submitDeliveryDates({
  id,
  user,
  delivery_start_at,
  delivery_end_at,
  notes,
  expected_updated_at,
}) {
  await ensureTables();
  if (!canManageDelivery(user)) {
    throw createAppError("Tu rol no puede registrar fechas de entrega", {
      status: 403,
      code: "FORBIDDEN_ROLE_ACTION",
    });
  }
  if (!delivery_start_at || !delivery_end_at) {
    throw createAppError("Debes definir fecha inicio y fin de entrega", {
      status: 400,
      code: "DELIVERY_DATES_REQUIRED",
    });
  }
  const start = new Date(`${delivery_start_at}T00:00:00`);
  const end = new Date(`${delivery_end_at}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw createAppError("Formato de fecha inválido para entrega", {
      status: 400,
      code: "INVALID_DATE_FORMAT",
    });
  }
  if (end.getTime() < start.getTime()) {
    throw createAppError("La fecha fin no puede ser menor que la fecha inicio", {
      status: 409,
      code: "DELIVERY_DATES_INVALID_RANGE",
    });
  }

  const request = await getById(id, user);
  assertRequestExists(request);
  assertNoStaleWrite(request, expected_updated_at);
  assertActionStatus(request, "submit_delivery_dates");

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET status = $1,
            delivery_start_at = $2,
            delivery_end_at = $3,
            delivery_notes = COALESCE($4, delivery_notes),
            updated_at = now()
      WHERE id = $5
      RETURNING *`,
    [STATUS.DELIVERY_DATES_SUBMITTED, delivery_start_at, delivery_end_at, notes || null, id],
  );
  const updated = mapRequestRow(rows[0]);
  await notifyDeliveryStage({
    request: updated,
    title: "Fechas de entrega registradas",
    message: `Entrega planificada del ${updated.delivery_start_at || "-"} al ${updated.delivery_end_at || "-"}.`,
    meta: {
      status: updated.status,
      delivery_start_at: updated.delivery_start_at || null,
      delivery_end_at: updated.delivery_end_at || null,
    },
  });
  return updated;
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
        SET status = $1,
            equipment_arrived_at = now(),
            equipment_arrived_by = $2,
            equipment_arrived_by_email = $3,
            delivery_notes = COALESCE($4, delivery_notes),
            updated_at = now()
      WHERE id = $5
      RETURNING *`,
    [STATUS.WAITING_DISPATCH, user?.id || null, user?.email || null, notes || null, id],
  );
  const updated = mapRequestRow(rows[0]);
  await notifyDeliveryStage({
    request: updated,
    title: "Equipo arribado",
    message: `Se confirmó arribo de equipo para ${updated.client_name || "el cliente"}.`,
    meta: { status: updated.status, equipment_arrived_at: updated.equipment_arrived_at || null },
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
    message: `El despacho está listo para ${updated.client_name || "el cliente"}.`,
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

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET status = $1,
            delivered_at = now(),
            delivered_by = $2,
            delivered_by_email = $3,
            delivery_confirmed_notes = COALESCE($4, delivery_confirmed_notes),
            updated_at = now()
      WHERE id = $5
      RETURNING *`,
    [STATUS.COMPLETED, user?.id || null, user?.email || null, notes || null, id],
  );
  const updated = mapRequestRow(rows[0]);
  await notifyDeliveryStage({
    request: updated,
    title: "Entrega completada",
    message: `Se completó la entrega para ${updated.client_name || "el cliente"}.`,
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

  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() + RESERVATION_REMINDER_OFFSET_DAYS);
  let calendarEvent = {};
  try {
    calendarEvent = await createAllDayEvent({
      summary: `Recordatorio de reserva renovada - ${request.client_name}`,
      description: "Reserva renovada. Revisa estado y confirmación con proveedor.",
      date: reminderDate,
      attendees: [user.email].filter(Boolean),
    });
  } catch (error) {
    logger.warn("No se pudo crear recordatorio de reserva renovada en Calendar: %s", error.message);
  }

  const { rows } = await db.query(
    `UPDATE equipment_purchase_requests
        SET reservation_email_sent_at = now(),
            reservation_calendar_event_id = $1,
            reservation_calendar_event_link = $2,
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [calendarEvent.id || null, calendarEvent.htmlLink || null, id],
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
    throw createAppError("La solicitud ya está cerrada", {
      status: 409,
      code: "INVALID_TRANSITION",
      details: {
        action: "cancel_order",
        current_status: request.status,
      },
    });
  }

  const nextExtra = {
    ...(request.extra || {}),
    cancellation: {
      by_user_id: user?.id || null,
      by_user_email: user?.email || null,
      reason: String(reason || "").trim() || "Sin motivo especificado",
      cancelled_at: new Date().toISOString(),
    },
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

async function updateChecklistItem({ id, user, itemKey, checked, note }) {
  throw createAppError("Checklist automático: no editable manualmente", {
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

module.exports = {
  getApprovedClients,
  getAcpCommercialUsers,
  getEquipmentCatalog,
  listProviderContacts,
  saveProviderContact,
  listByUser,
  getById,
  createPurchaseRequest,
  startAvailabilityRequest,
  saveProviderResponse,
  requestProforma,
  uploadProforma,
  reserveEquipment,
  uploadSignedProforma,
  submitSignedProformaWithInspection,
  requestInspectionEnvironment,
  coordinateInspectionDate,
  reviewInspectionDateProposal,
  uploadContract,
  requestDeliveryDates,
  submitDeliveryDates,
  markEquipmentArrived,
  markDispatchReady,
  completeDelivery,
  renewReservation,
  cancelOrder,
  updateChecklistItem,
  getStats,
  getTechnicalScheduleCalendar,
  STATUS,
};
