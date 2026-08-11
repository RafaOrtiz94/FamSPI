const db = require("../../config/db");
const logger = require("../../config/logger");
const { ensureFolder, uploadBase64File } = require("../../utils/drive");
const {
  SUPPORTED_WORKFLOW_SOURCE_TYPES,
  upsertWorkflow,
  validateSourceType,
} = require("./workflowRegistry.service");
const { appendWorkflowAuditEvent } = require("./workflowAudit.service");
const { trackWorkflowDocumentByCode } = require("./fst14.service");
const {
  ensureWithdrawalPackagingLabelsTable,
  listWithdrawalPackages,
  upsertWithdrawalPackages,
} = require("./packagingLabels.service");
const { buildDriveLink } = require("./fst11.service");
const { markRequestCompleted } = require("../requests/requests.service");
const notificationManager = require("../notifications/notificationManager");

const WORKFLOW_STATUS = Object.freeze({
  REQUESTED: "withdrawal_requested",
  COORDINATED: "withdrawal_coordinated",
  DISINFECTED: "desinfectado",
  PACKAGED: "embalado",
  WITHDRAWN: "retirado",
  CLOSED: "cerrado",
});

const WITHDRAWAL_STAGE_MAP = Object.freeze({
  [WORKFLOW_STATUS.REQUESTED]: "withdrawal_requested",
  [WORKFLOW_STATUS.COORDINATED]: "withdrawal_coordinated",
  [WORKFLOW_STATUS.DISINFECTED]: "desinfection_completed",
  [WORKFLOW_STATUS.PACKAGED]: "packaging_completed",
  [WORKFLOW_STATUS.WITHDRAWN]: "withdrawal_executed",
  [WORKFLOW_STATUS.CLOSED]: "completed",
});

const PROVIDER_CASE_DONE = new Set(["not_required", "resolved", "closed"]);
const WORK_ORDER_DONE = new Set(["pending", "closed", "completed"]);

const DEFAULT_WORKFLOW_STATE = Object.freeze({
  coordination: {
    status: "pending",
    scheduled_date: null,
    contact_name: null,
    contact_phone: null,
    notes: null,
    coordinated_at: null,
    coordinated_by: null,
    coordinated_by_email: null,
  },
  provider_case: {
    applies: null,
    provider_name: null,
    case_reference: null,
    platform: null,
    status: "pending_decision",
    notes: null,
    updated_at: null,
    updated_by: null,
    updated_by_email: null,
  },
  work_order: {
    status: "pending",
    work_order_number: null,
    assigned_to: null,
    assigned_email: null,
    opened_at: null,
    closed_at: null,
    notes: null,
  },
  disinfection: {
    status: "pending",
    fst02_file_id: null,
    fst02_link: null,
    performed_at: null,
    performed_by: null,
    performed_by_email: null,
    part_change_required: false,
    part_change_notes: null,
  },
  packaging: {
    status: "pending",
    packages: [],
    total_packages: 0,
    total_labels: 0,
    evidence_count: 0,
    notes: null,
    last_registered_at: null,
    last_registered_by: null,
    last_registered_by_email: null,
  },
  logistics: {
    status: "pending",
    pickup_date: null,
    picked_up_at: null,
    carrier_name: null,
    tracking_reference: null,
    bultos_total: 0,
    notes: null,
  },
  withdrawal_act: {
    status: "pending",
    fst11_file_id: null,
    fst11_link: null,
    generated_at: null,
    template_mode: null,
    signed_client: false,
    signed_technical: false,
    observations: null,
  },
  closure: {
    status: "pending",
    blocked_reasons: [],
    closed_at: null,
    closed_by: null,
    closed_by_email: null,
  },
});

const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

const normalizeSourceType = (value) => String(value || "").trim().toLowerCase();
const normalizeSourceId = (value) => String(value || "").trim();

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "yes", "si", "y"].includes(normalized)) return true;
  if (["false", "no", "n"].includes(normalized)) return false;
  return Boolean(fallback);
};

const normalizeDateOnly = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const es = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (es) {
    const [, dd, mm, yyyy] = es;
    return `${yyyy}-${mm}-${dd}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const yyyy = parsed.getUTCFullYear();
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const normalizeIsoDateTime = (value, fallback = null) => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const toObject = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
};

const safeJson = (value, fallback = {}) => {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (_error) {
      return fallback;
    }
  }
  return fallback;
};

const parseRequestPayload = (payload) => safeJson(payload, {});

const buildError = (
  message,
  { status = 400, code = "WITHDRAWAL_WORKFLOW_ERROR", details = null } = {},
) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details && typeof details === "object") error.details = details;
  return error;
};

// Notifica al solicitante del F.ST-21 en los hitos que le importan del retiro
// fisico (coordinacion, ejecucion, cierre). Nadie lo avisaba antes de esto.
const notifyWithdrawalRequester = (requesterId, { clientName, title, message, subjectSuffix, priority = 1, type = "task" } = {}) => {
  if (!Number.isFinite(Number(requesterId))) return;
  notificationManager
    .sendNotification({
      userId: Number(requesterId),
      customTitle: title,
      customMessage: message,
      type,
      source: "servicio.withdrawal_workflow",
      priority,
      email: true,
      data: { email_subject: `F.ST-21 - ${clientName || "Cliente pendiente"} - ${subjectSuffix}` },
    })
    .catch((err) => logger.warn({ err }, "No se pudo notificar evento de retiro de equipo"));
};

const inferEquipmentNameFromPayload = (payload = {}) => {
  const items = toArray(payload.equipos);
  if (items.length > 0) {
    const first = items[0] || {};
    return (
      normalizeText(first.nombre_equipo || first.equipment_name || first.name || first.label) ||
      "Equipo"
    );
  }
  return normalizeText(payload.nombre_equipo || payload.equipo || payload.equipment_name);
};

const inferEquipmentItemsFromPayload = (payload = {}) =>
  toArray(payload.equipos).map((item) => ({
    unidad_id: item?.unidad_id || item?.equipo_id || null,
    equipment_name: normalizeText(
      item?.equipment_name || item?.nombre_equipo || item?.name || item?.label,
    ),
    serial: normalizeText(item?.serial),
    quantity: Number.isFinite(Number(item?.cantidad || item?.quantity))
      ? Number(item?.cantidad || item?.quantity)
      : 1,
  }));

const normalizeWorkflowState = (state = {}) => {
  const source = toObject(state);
  const defaults = JSON.parse(JSON.stringify(DEFAULT_WORKFLOW_STATE));
  const coordination = toObject(source.coordination);
  const providerCase = toObject(source.provider_case);
  const workOrder = toObject(source.work_order);
  const disinfection = toObject(source.disinfection);
  const packaging = toObject(source.packaging);
  const logistics = toObject(source.logistics);
  const withdrawalAct = toObject(source.withdrawal_act);
  const closure = toObject(source.closure);
  return {
    ...defaults,
    coordination: {
      ...defaults.coordination,
      status:
        String(coordination.status || "").trim().toLowerCase() === "coordinated"
          ? "coordinated"
          : "pending",
      scheduled_date: normalizeDateOnly(coordination.scheduled_date),
      contact_name: normalizeText(coordination.contact_name),
      contact_phone: normalizeText(coordination.contact_phone),
      notes: normalizeText(coordination.notes),
      coordinated_at: coordination.coordinated_at || null,
      coordinated_by: Number.isFinite(Number(coordination.coordinated_by))
        ? Number(coordination.coordinated_by)
        : null,
      coordinated_by_email: normalizeText(coordination.coordinated_by_email),
    },
    provider_case: {
      ...defaults.provider_case,
      applies:
        typeof providerCase.applies === "boolean" ? providerCase.applies : defaults.provider_case.applies,
      provider_name: normalizeText(providerCase.provider_name),
      case_reference: normalizeText(providerCase.case_reference),
      platform: normalizeText(providerCase.platform),
      status: normalizeText(providerCase.status || defaults.provider_case.status),
      notes: normalizeText(providerCase.notes),
      updated_at: providerCase.updated_at || null,
      updated_by: Number.isFinite(Number(providerCase.updated_by))
        ? Number(providerCase.updated_by)
        : null,
      updated_by_email: normalizeText(providerCase.updated_by_email),
    },
    work_order: {
      ...defaults.work_order,
      status: normalizeText(workOrder.status || defaults.work_order.status),
      work_order_number: normalizeText(workOrder.work_order_number),
      assigned_to: normalizeText(workOrder.assigned_to),
      assigned_email: normalizeText(workOrder.assigned_email),
      opened_at: workOrder.opened_at || null,
      closed_at: workOrder.closed_at || null,
      notes: normalizeText(workOrder.notes),
    },
    disinfection: {
      ...defaults.disinfection,
      status:
        String(disinfection.status || "").trim().toLowerCase() === "completed"
          ? "completed"
          : "pending",
      fst02_file_id: normalizeText(disinfection.fst02_file_id),
      fst02_link: normalizeText(disinfection.fst02_link),
      performed_at: disinfection.performed_at || null,
      performed_by: Number.isFinite(Number(disinfection.performed_by))
        ? Number(disinfection.performed_by)
        : null,
      performed_by_email: normalizeText(disinfection.performed_by_email),
      part_change_required: normalizeBoolean(disinfection.part_change_required, false),
      part_change_notes: normalizeText(disinfection.part_change_notes),
    },
    packaging: {
      ...defaults.packaging,
      status:
        String(packaging.status || "").trim().toLowerCase() === "completed"
          ? "completed"
          : "pending",
      packages: toArray(packaging.packages).map((pkg) => toObject(pkg)),
      total_packages: Number.isFinite(Number(packaging.total_packages))
        ? Number(packaging.total_packages)
        : 0,
      total_labels: Number.isFinite(Number(packaging.total_labels))
        ? Number(packaging.total_labels)
        : 0,
      evidence_count: Number.isFinite(Number(packaging.evidence_count))
        ? Number(packaging.evidence_count)
        : 0,
      notes: normalizeText(packaging.notes),
      last_registered_at: packaging.last_registered_at || null,
      last_registered_by: Number.isFinite(Number(packaging.last_registered_by))
        ? Number(packaging.last_registered_by)
        : null,
      last_registered_by_email: normalizeText(packaging.last_registered_by_email),
    },
    logistics: {
      ...defaults.logistics,
      status: normalizeText(logistics.status || defaults.logistics.status),
      pickup_date: normalizeDateOnly(logistics.pickup_date),
      picked_up_at: logistics.picked_up_at || null,
      carrier_name: normalizeText(logistics.carrier_name),
      tracking_reference: normalizeText(logistics.tracking_reference),
      bultos_total: Number.isFinite(Number(logistics.bultos_total))
        ? Number(logistics.bultos_total)
        : 0,
      notes: normalizeText(logistics.notes),
    },
    withdrawal_act: {
      ...defaults.withdrawal_act,
      status:
        String(withdrawalAct.status || "").trim().toLowerCase() === "generated"
          ? "generated"
          : "pending",
      fst11_file_id: normalizeText(withdrawalAct.fst11_file_id),
      fst11_link: normalizeText(withdrawalAct.fst11_link),
      generated_at: withdrawalAct.generated_at || null,
      template_mode: normalizeText(withdrawalAct.template_mode),
      signed_client: normalizeBoolean(withdrawalAct.signed_client, false),
      signed_technical: normalizeBoolean(withdrawalAct.signed_technical, false),
      observations: normalizeText(withdrawalAct.observations),
    },
    closure: {
      ...defaults.closure,
      status:
        String(closure.status || "").trim().toLowerCase() === "closed"
          ? "closed"
          : "pending",
      blocked_reasons: toArray(closure.blocked_reasons).map((item) => String(item || "")),
      closed_at: closure.closed_at || null,
      closed_by: Number.isFinite(Number(closure.closed_by)) ? Number(closure.closed_by) : null,
      closed_by_email: normalizeText(closure.closed_by_email),
    },
  };
};

const computeClosureBlockedReasons = (state = {}) => {
  const workflow = normalizeWorkflowState(state);
  const blocked = [];
  if (!workflow.coordination.coordinated_at) blocked.push("COORDINATION_PENDING");
  if (workflow.provider_case.applies === null) blocked.push("PROVIDER_CASE_DECISION_PENDING");
  if (workflow.provider_case.applies === true) {
    if (!workflow.provider_case.case_reference) blocked.push("PROVIDER_CASE_REFERENCE_REQUIRED");
    if (!PROVIDER_CASE_DONE.has(String(workflow.provider_case.status || "").toLowerCase())) {
      blocked.push("PROVIDER_CASE_PENDING");
    }
  }
  if (!WORK_ORDER_DONE.has(String(workflow.work_order.status || "").toLowerCase())) {
    blocked.push("WITHDRAWAL_WORK_ORDER_PENDING");
  }
  if (workflow.disinfection.status !== "completed") blocked.push("FST02_PENDING");
  if (!workflow.disinfection.fst02_file_id) blocked.push("FST02_DOCUMENT_REQUIRED");
  if (workflow.packaging.status !== "completed") blocked.push("PACKAGING_PENDING");
  if (!workflow.packaging.total_packages) blocked.push("PACKAGING_BULTOS_REQUIRED");
  if (!workflow.logistics.picked_up_at) blocked.push("WITHDRAWAL_EXECUTION_PENDING");
  if (!workflow.withdrawal_act.fst11_file_id) blocked.push("FST11_PENDING");
  return blocked;
};

const deriveWorkflowLifecycle = (state = {}) => {
  const workflow = normalizeWorkflowState(state);
  let status = WORKFLOW_STATUS.REQUESTED;
  if (workflow.coordination.coordinated_at) {
    status = WORKFLOW_STATUS.COORDINATED;
  }
  if (workflow.disinfection.status === "completed") {
    status = WORKFLOW_STATUS.DISINFECTED;
  }
  if (workflow.packaging.status === "completed" && workflow.packaging.total_packages > 0) {
    status = WORKFLOW_STATUS.PACKAGED;
  }
  if (workflow.logistics.picked_up_at) {
    status = WORKFLOW_STATUS.WITHDRAWN;
  }
  if (workflow.closure.status === "closed") {
    status = WORKFLOW_STATUS.CLOSED;
  }
  return {
    status,
    stage: WITHDRAWAL_STAGE_MAP[status] || WITHDRAWAL_STAGE_MAP[WORKFLOW_STATUS.REQUESTED],
    closure_blocked_reasons: computeClosureBlockedReasons(workflow),
  };
};

const decodeBase64Payload = (rawData) => {
  const raw = String(rawData || "").trim();
  if (!raw) return null;
  const dataUrlMatch = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return {
      mime_type: dataUrlMatch[1] || "application/octet-stream",
      base64: dataUrlMatch[2],
    };
  }
  return {
    mime_type: "application/octet-stream",
    base64: raw,
  };
};

const sanitizeFileToken = (value, fallback = "item") => {
  const normalized = String(value || "").trim().replace(/[^\w.-]+/g, "_");
  return normalized || fallback;
};

const ensureWithdrawalWorkflowTables = async () => {
  await db.query(`CREATE SCHEMA IF NOT EXISTS servicio`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.withdrawal_workflows (
      id BIGSERIAL PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      request_id INTEGER,
      client_name TEXT,
      equipment_name TEXT,
      request_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      workflow_state JSONB NOT NULL DEFAULT '{}'::jsonb,
      workflow_status TEXT NOT NULL DEFAULT '${WORKFLOW_STATUS.REQUESTED}',
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (source_type, source_id)
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_withdrawal_workflows_request
      ON servicio.withdrawal_workflows (request_id, updated_at DESC)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_withdrawal_workflows_status
      ON servicio.withdrawal_workflows (workflow_status, updated_at DESC)
  `);
  await ensureWithdrawalPackagingLabelsTable();
};

const loadRetiroRequestById = async (requestId) => {
  const id = Number(requestId);
  if (!Number.isFinite(id)) {
    throw buildError("request_id invalido", {
      status: 400,
      code: "REQUEST_ID_INVALID",
    });
  }
  const { rows } = await db.query(
    `
      SELECT
        r.id,
        r.status,
        r.payload,
        r.created_at,
        r.updated_at,
        r.requester_id,
        rt.code AS type_code,
        rt.title AS type_title
      FROM requests r
      JOIN request_types rt ON rt.id = r.request_type_id
      WHERE r.id = $1
      LIMIT 1
    `,
    [id],
  );
  const row = rows[0];
  if (!row) {
    throw buildError("Solicitud comercial no encontrada", {
      status: 404,
      code: "REQUEST_NOT_FOUND",
    });
  }
  const typeCode = String(row.type_code || "").trim().toUpperCase();
  if (typeCode !== "F.ST-21") {
    throw buildError("La solicitud no corresponde a un retiro F.ST-21", {
      status: 409,
      code: "REQUEST_TYPE_NOT_WITHDRAWAL",
      details: { expected: "F.ST-21", received: typeCode || null },
    });
  }
  return row;
};

const buildRequestSnapshot = (requestRow) => {
  const payload = parseRequestPayload(requestRow?.payload);
  return {
    request_id: requestRow?.id || null,
    request_status: normalizeText(requestRow?.status),
    request_type_code: normalizeText(requestRow?.type_code),
    request_type_title: normalizeText(requestRow?.type_title),
    request_created_at: requestRow?.created_at || null,
    requester_id: requestRow?.requester_id || null,
    payload,
    client_name: normalizeText(payload?.nombre_cliente || payload?.cliente || payload?.client_name),
    equipment_name: inferEquipmentNameFromPayload(payload),
    equipment_items: inferEquipmentItemsFromPayload(payload),
    planned_withdrawal_date: normalizeDateOnly(payload?.fecha_retiro),
    contact_name: normalizeText(payload?.persona_contacto),
    contact_phone: normalizeText(payload?.celular_contacto),
    address: normalizeText(payload?.direccion_cliente),
  };
};

const defaultSourceTypeForRequest = "commercial_request";

const resolveSourceContext = ({
  sourceType,
  sourceId,
  requestId = null,
  fallbackSourceType = defaultSourceTypeForRequest,
} = {}) => {
  const normalizedSourceType = normalizeSourceType(sourceType || fallbackSourceType || "manual");
  const normalizedSourceId = normalizeSourceId(sourceId || requestId || "");
  if (!normalizedSourceType || !normalizedSourceId) {
    throw buildError("source_type y source_id (o request_id) son obligatorios", {
      status: 400,
      code: "SOURCE_CONTEXT_REQUIRED",
    });
  }
  if (!validateSourceType(normalizedSourceType)) {
    throw buildError(`source_type invalido: ${normalizedSourceType}`, {
      status: 400,
      code: "SOURCE_TYPE_INVALID",
      details: { supported: Array.from(SUPPORTED_WORKFLOW_SOURCE_TYPES) },
    });
  }
  return {
    source_type: normalizedSourceType,
    source_id: normalizedSourceId,
    request_id: Number.isFinite(Number(requestId)) ? Number(requestId) : null,
  };
};

const buildInitialWorkflowState = ({ requestSnapshot = {}, user = null } = {}) => {
  const defaults = JSON.parse(JSON.stringify(DEFAULT_WORKFLOW_STATE));
  return normalizeWorkflowState({
    ...defaults,
    coordination: {
      ...defaults.coordination,
      scheduled_date: requestSnapshot.planned_withdrawal_date || null,
      contact_name: requestSnapshot.contact_name || null,
      contact_phone: requestSnapshot.contact_phone || null,
      notes: requestSnapshot.address
        ? `Dirección retiro: ${requestSnapshot.address}`
        : null,
      status: requestSnapshot.planned_withdrawal_date ? "coordinated" : "pending",
      coordinated_at: requestSnapshot.planned_withdrawal_date
        ? new Date().toISOString()
        : null,
      coordinated_by: requestSnapshot.planned_withdrawal_date
        ? Number.isFinite(Number(user?.id))
          ? Number(user.id)
          : null
        : null,
      coordinated_by_email: requestSnapshot.planned_withdrawal_date
        ? normalizeText(user?.email)
        : null,
    },
    logistics: {
      ...defaults.logistics,
      pickup_date: requestSnapshot.planned_withdrawal_date || null,
      bultos_total: Array.isArray(requestSnapshot.equipment_items)
        ? requestSnapshot.equipment_items.length
        : 0,
    },
  });
};

const getWorkflowRow = async ({ sourceType, sourceId, requestId } = {}) => {
  await ensureWithdrawalWorkflowTables();
  if (sourceType && sourceId) {
    const { rows } = await db.query(
      `
        SELECT *
        FROM servicio.withdrawal_workflows
        WHERE source_type = $1
          AND source_id = $2
        LIMIT 1
      `,
      [sourceType, sourceId],
    );
    if (rows[0]) return rows[0];
  }
  if (Number.isFinite(Number(requestId))) {
    const { rows } = await db.query(
      `
        SELECT *
        FROM servicio.withdrawal_workflows
        WHERE request_id = $1
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [Number(requestId)],
    );
    if (rows[0]) return rows[0];
  }
  return null;
};

const ensureWithdrawalEvidenceFolder = async ({
  sourceType,
  sourceId,
  clientName,
}) => {
  const rootFolderId = normalizeText(process.env.DRIVE_ROOT_FOLDER_ID);
  if (!rootFolderId) {
    const error = new Error("DRIVE_ROOT_FOLDER_ID no configurado");
    error.status = 500;
    error.code = "DRIVE_ROOT_NOT_CONFIGURED";
    throw error;
  }
  const servicioFolder = await ensureFolder("Servicio Tecnico", rootFolderId);
  const withdrawalFolder = await ensureFolder("Retiro Equipos", servicioFolder.id);
  const contextFolderName = `${sanitizeFileToken(sourceType, "source")}_${sanitizeFileToken(
    sourceId,
    "id",
  )}_${sanitizeFileToken(clientName || "cliente", "cliente").slice(0, 40)}`;
  const contextFolder = await ensureFolder(contextFolderName, withdrawalFolder.id);
  const packagingFolder = await ensureFolder("Embalaje", contextFolder.id);
  const evidenceFolder = await ensureFolder("Evidencias", packagingFolder.id);
  return {
    context_folder_id: contextFolder.id,
    packaging_folder_id: packagingFolder.id,
    evidence_folder_id: evidenceFolder.id,
  };
};

const uploadPackagingEvidenceFiles = async ({
  sourceType,
  sourceId,
  clientName,
  packageLabel,
  evidenceFiles = [],
} = {}) => {
  const uploads = [];
  if (!toArray(evidenceFiles).length) return uploads;

  const folders = await ensureWithdrawalEvidenceFolder({
    sourceType,
    sourceId,
    clientName,
  });
  const packageFolder = await ensureFolder(
    sanitizeFileToken(packageLabel, "bulto"),
    folders.evidence_folder_id,
  );

  for (const [index, file] of toArray(evidenceFiles).entries()) {
    const fileData = toObject(file);
    const decoded = decodeBase64Payload(fileData.data || fileData.base64 || "");
    if (!decoded?.base64) {
      throw buildError("Evidencia fotografica inválida en embalaje", {
        status: 400,
        code: "PACKAGING_EVIDENCE_INVALID",
        details: { index, package_label: packageLabel },
      });
    }
    const extension = (() => {
      const mime = String(fileData.type || decoded.mime_type || "").toLowerCase();
      if (mime.includes("png")) return "png";
      if (mime.includes("webp")) return "webp";
      if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
      return "bin";
    })();
    const fileName =
      normalizeText(fileData.name) ||
      `${sanitizeFileToken(packageLabel, "bulto")}_evidencia_${index + 1}.${extension}`;
     
    const uploaded = await uploadBase64File(
      fileName,
      decoded.base64,
      fileData.type || decoded.mime_type || "application/octet-stream",
      packageFolder.id,
    );
    uploads.push({
      file_id: uploaded.id,
      link: uploaded.webViewLink || buildDriveLink(uploaded.id),
      name: fileName,
      mime_type: fileData.type || decoded.mime_type || null,
    });
  }

  return uploads;
};

const syncWorkflowRegistry = async ({
  sourceType,
  sourceId,
  requestId,
  clientName,
  equipmentName,
  workflowState,
  workflowStatus,
  user,
}) => {
  const stage = WITHDRAWAL_STAGE_MAP[workflowStatus] || WITHDRAWAL_STAGE_MAP[WORKFLOW_STATUS.REQUESTED];
  await upsertWorkflow({
    sourceType,
    sourceId,
    requestId,
    clientName,
    equipmentName,
    procedureCode: "ST-01-01",
    globalStatus: workflowStatus === WORKFLOW_STATUS.CLOSED ? "completed" : "in_progress",
    currentStage: stage,
    metadata: {
      withdrawal_workflow_status: workflowStatus,
      withdrawal_workflow_stage: stage,
      withdrawal_closure_blocked_reasons: computeClosureBlockedReasons(workflowState),
      updated_at: new Date().toISOString(),
    },
    user,
  });
};

const hydrateWorkflowRow = async (row) => {
  if (!row) return null;
  const packages = await listWithdrawalPackages({ workflowId: row.id });
  const normalizedState = normalizeWorkflowState(row.workflow_state || {});
  const mergedState = {
    ...normalizedState,
    packaging: {
      ...normalizedState.packaging,
      packages,
      total_packages: packages.length,
      total_labels: packages.length,
      evidence_count: packages.reduce(
        (sum, pkg) => sum + (Array.isArray(pkg.evidence) ? pkg.evidence.length : 0),
        0,
      ),
    },
  };
  mergedState.logistics.bultos_total = Math.max(
    Number(mergedState.logistics.bultos_total || 0),
    Number(mergedState.packaging.total_packages || 0),
  );

  const lifecycle = deriveWorkflowLifecycle(mergedState);
  const requestSnapshot = safeJson(row.request_snapshot, {});

  return {
    ...row,
    request_snapshot: requestSnapshot,
    workflow_state: {
      ...mergedState,
      closure: {
        ...mergedState.closure,
        blocked_reasons:
          lifecycle.status === WORKFLOW_STATUS.CLOSED
            ? []
            : lifecycle.closure_blocked_reasons,
      },
    },
    workflow_status: lifecycle.status,
    workflow_stage: lifecycle.stage,
    closure_blocked_reasons: lifecycle.closure_blocked_reasons,
  };
};

const persistWorkflowRow = async ({
  existingRow = null,
  sourceType,
  sourceId,
  requestId = null,
  clientName = null,
  equipmentName = null,
  requestSnapshot = {},
  workflowState = {},
  user = null,
  eventType = "withdrawal_workflow_updated",
  eventPayload = {},
}) => {
  await ensureWithdrawalWorkflowTables();
  const normalizedState = normalizeWorkflowState(workflowState);
  const lifecycle = deriveWorkflowLifecycle(normalizedState);
  const blockedReasons =
    lifecycle.status === WORKFLOW_STATUS.CLOSED ? [] : lifecycle.closure_blocked_reasons;
  normalizedState.closure = {
    ...normalizedState.closure,
    blocked_reasons: blockedReasons,
  };

  let row;
  if (existingRow?.id) {
    const { rows } = await db.query(
      `
        UPDATE servicio.withdrawal_workflows
        SET request_id = COALESCE($1, request_id),
            client_name = COALESCE($2, client_name),
            equipment_name = COALESCE($3, equipment_name),
            request_snapshot = COALESCE(request_snapshot, '{}'::jsonb) || $4::jsonb,
            workflow_state = $5::jsonb,
            workflow_status = $6,
            updated_at = now()
        WHERE id = $7
        RETURNING *
      `,
      [
        Number.isFinite(Number(requestId)) ? Number(requestId) : null,
        clientName || null,
        equipmentName || null,
        JSON.stringify(requestSnapshot || {}),
        JSON.stringify(normalizedState),
        lifecycle.status,
        existingRow.id,
      ],
    );
    row = rows[0] || null;
  } else {
    const { rows } = await db.query(
      `
        INSERT INTO servicio.withdrawal_workflows (
          source_type,
          source_id,
          request_id,
          client_name,
          equipment_name,
          request_snapshot,
          workflow_state,
          workflow_status,
          created_by,
          created_by_email,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,now(),now())
        ON CONFLICT (source_type, source_id) DO UPDATE
          SET request_id = COALESCE(EXCLUDED.request_id, servicio.withdrawal_workflows.request_id),
              client_name = COALESCE(EXCLUDED.client_name, servicio.withdrawal_workflows.client_name),
              equipment_name = COALESCE(EXCLUDED.equipment_name, servicio.withdrawal_workflows.equipment_name),
              request_snapshot = COALESCE(servicio.withdrawal_workflows.request_snapshot, '{}'::jsonb) || EXCLUDED.request_snapshot,
              workflow_state = EXCLUDED.workflow_state,
              workflow_status = EXCLUDED.workflow_status,
              updated_at = now()
        RETURNING *
      `,
      [
        sourceType,
        sourceId,
        Number.isFinite(Number(requestId)) ? Number(requestId) : null,
        clientName || null,
        equipmentName || null,
        JSON.stringify(requestSnapshot || {}),
        JSON.stringify(normalizedState),
        lifecycle.status,
        user?.id || null,
        user?.email || null,
      ],
    );
    row = rows[0] || null;
  }

  if (!row) {
    throw buildError("No se pudo persistir el workflow de retiro", {
      status: 500,
      code: "WITHDRAWAL_WORKFLOW_PERSIST_ERROR",
    });
  }

  await syncWorkflowRegistry({
    sourceType,
    sourceId,
    requestId,
    clientName,
    equipmentName,
    workflowState: normalizedState,
    workflowStatus: lifecycle.status,
    user,
  });

  await appendWorkflowAuditEvent({
    sourceType,
    sourceId,
    procedureCode: "ST-01-01",
    eventType,
    stageKey: lifecycle.stage,
    actor: user,
    payload: {
      workflow_status: lifecycle.status,
      closure_blocked_reasons: blockedReasons,
      ...eventPayload,
    },
  });

  return hydrateWorkflowRow(row);
};

const initializeWithdrawalWorkflow = async ({
  sourceType,
  sourceId,
  requestId = null,
  user = null,
} = {}) => {
  const context = resolveSourceContext({
    sourceType,
    sourceId,
    requestId,
  });
  const existing = await getWorkflowRow({
    sourceType: context.source_type,
    sourceId: context.source_id,
    requestId: context.request_id,
  });
  if (existing) return hydrateWorkflowRow(existing);

  let requestSnapshot = {};
  if (Number.isFinite(Number(context.request_id))) {
    const requestRow = await loadRetiroRequestById(context.request_id);
    requestSnapshot = buildRequestSnapshot(requestRow);
  }

  const initialState = buildInitialWorkflowState({
    requestSnapshot,
    user,
  });

  const detail = await persistWorkflowRow({
    existingRow: null,
    sourceType: context.source_type,
    sourceId: context.source_id,
    requestId: context.request_id,
    clientName: requestSnapshot.client_name || null,
    equipmentName: requestSnapshot.equipment_name || null,
    requestSnapshot,
    workflowState: initialState,
    user,
    eventType: "withdrawal_workflow_initialized",
    eventPayload: {
      request_id: context.request_id,
      source_type: context.source_type,
      source_id: context.source_id,
    },
  });

  return detail;
};

const findLatestWorkflowDocument = async ({
  sourceType,
  sourceId,
  documentCode,
}) => {
  await db.query(`CREATE SCHEMA IF NOT EXISTS servicio`);
  const { rows } = await db.query(
    `
      SELECT drive_file_id, drive_folder_id, metadata, created_at
      FROM servicio.workflow_documents
      WHERE source_type = $1
        AND source_id = $2
        AND document_code = $3
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [sourceType, sourceId, String(documentCode || "").trim().toUpperCase()],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    file_id: row.drive_file_id || null,
    folder_id: row.drive_folder_id || null,
    link: buildDriveLink(row.drive_file_id) || null,
    metadata: safeJson(row.metadata, {}),
    created_at: row.created_at || null,
  };
};

const resolvePackagingDrafts = async ({
  packages = [],
  sourceType,
  sourceId,
  clientName,
}) => {
  const resolved = [];
  for (const [index, draft] of toArray(packages).entries()) {
    const packageData = toObject(draft);
    const packageLabel =
      normalizeText(packageData.package_label || packageData.label || packageData.bulto) ||
      `BULTO-${index + 1}`;
    const currentEvidence = toArray(packageData.evidence)
      .map((entry) => toObject(entry))
      .map((entry) => ({
        file_id: normalizeText(entry.file_id || entry.id),
        link: normalizeText(entry.link),
        name: normalizeText(entry.name),
        mime_type: normalizeText(entry.mime_type || entry.type),
      }))
      .filter((entry) => entry.file_id || entry.link);
    const uploadedEvidence = await uploadPackagingEvidenceFiles({
      sourceType,
      sourceId,
      clientName,
      packageLabel,
      evidenceFiles: toArray(packageData.evidence_files || packageData.evidenceFiles),
    });
    const mergedEvidence = [...currentEvidence, ...uploadedEvidence];
    resolved.push({
      package_label: packageLabel,
      package_type: normalizeText(packageData.package_type || packageData.tipo),
      package_weight_kg: Number.isFinite(Number(packageData.package_weight_kg))
        ? Number(packageData.package_weight_kg)
        : Number.isFinite(Number(packageData.weight_kg))
          ? Number(packageData.weight_kg)
          : null,
      package_dimensions: normalizeText(
        packageData.package_dimensions || packageData.dimensions || packageData.medidas,
      ),
      items_summary: Array.isArray(packageData.items_summary)
        ? packageData.items_summary
        : typeof packageData.items_summary === "string"
          ? packageData.items_summary
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          : Array.isArray(packageData.items)
            ? packageData.items
            : [],
      evidence: mergedEvidence,
    });
  }
  return resolved;
};

const applyWorkflowAction = async ({
  row,
  action,
  payload = {},
  user = null,
}) => {
  const normalizedAction = String(action || "").trim().toLowerCase();
  const workflowState = normalizeWorkflowState(row?.workflow_state || {});
  const now = new Date().toISOString();
  const sourceType = row.source_type;
  const sourceId = row.source_id;
  const requestSnapshot = safeJson(row.request_snapshot, {});

  const withUser = {
    user_id: Number.isFinite(Number(user?.id)) ? Number(user.id) : null,
    user_email: normalizeText(user?.email),
  };

  if (["coordinate_withdrawal", "coordination"].includes(normalizedAction)) {
    const scheduledDate = normalizeDateOnly(
      payload.scheduled_date || payload.pickup_date || payload.fecha_retiro,
    );
    if (!scheduledDate) {
      throw buildError("Debe registrar fecha de coordinación de retiro", {
        status: 400,
        code: "WITHDRAWAL_COORDINATION_DATE_REQUIRED",
      });
    }
    const nextState = {
      ...workflowState,
      coordination: {
        ...workflowState.coordination,
        status: "coordinated",
        scheduled_date: scheduledDate,
        contact_name:
          normalizeText(payload.contact_name || payload.persona_contacto) ||
          workflowState.coordination.contact_name,
        contact_phone:
          normalizeText(payload.contact_phone || payload.celular_contacto) ||
          workflowState.coordination.contact_phone,
        notes: normalizeText(payload.notes) || workflowState.coordination.notes,
        coordinated_at: now,
        coordinated_by: withUser.user_id,
        coordinated_by_email: withUser.user_email,
      },
      logistics: {
        ...workflowState.logistics,
        pickup_date: scheduledDate,
      },
    };
    notifyWithdrawalRequester(requestSnapshot.requester_id, {
      clientName: row.client_name || requestSnapshot.client_name,
      title: "Retiro de equipo coordinado",
      message: `Se coordinó el retiro de equipo para ${row.client_name || requestSnapshot.client_name || "cliente"} el ${scheduledDate}.`,
      subjectSuffix: "Retiro coordinado",
    });
    return {
      nextState,
      eventType: "withdrawal_coordinated",
      eventPayload: { scheduled_date: scheduledDate },
    };
  }

  if (["set_provider_case", "provider_case", "update_provider_case"].includes(normalizedAction)) {
    const applies = typeof payload.applies === "boolean" ? payload.applies : workflowState.provider_case.applies;
    if (typeof applies !== "boolean") {
      throw buildError("Debe indicar si aplica caso con proveedor", {
        status: 400,
        code: "PROVIDER_CASE_DECISION_REQUIRED",
      });
    }
    const requestedStatus = normalizeText(payload.status || payload.provider_case_status);
    let providerStatus = requestedStatus || (applies ? "opened" : "not_required");
    providerStatus = providerStatus.toLowerCase();
    if (!applies) providerStatus = "not_required";
    if (
      ![
        "pending_decision",
        "opened",
        "in_progress",
        "resolved",
        "closed",
        "rejected",
        "not_required",
      ].includes(providerStatus)
    ) {
      throw buildError("Estado de caso proveedor inválido", {
        status: 400,
        code: "PROVIDER_CASE_STATUS_INVALID",
      });
    }
    const caseReference = normalizeText(payload.case_reference || payload.provider_case_reference);
    if (applies && !caseReference) {
      throw buildError("Debe registrar referencia del caso de proveedor", {
        status: 400,
        code: "PROVIDER_CASE_REFERENCE_REQUIRED",
      });
    }
    const nextState = {
      ...workflowState,
      provider_case: {
        ...workflowState.provider_case,
        applies,
        provider_name: applies
          ? normalizeText(payload.provider_name) || workflowState.provider_case.provider_name
          : null,
        case_reference: applies ? caseReference : null,
        platform: applies
          ? normalizeText(payload.platform) || workflowState.provider_case.platform
          : null,
        status: providerStatus,
        notes: normalizeText(payload.notes) || workflowState.provider_case.notes,
        updated_at: now,
        updated_by: withUser.user_id,
        updated_by_email: withUser.user_email,
      },
    };
    return {
      nextState,
      eventType: "withdrawal_provider_case_updated",
      eventPayload: {
        applies,
        provider_case_status: providerStatus,
        provider_case_reference: caseReference || null,
      },
    };
  }

  if (["open_work_order", "work_order_open"].includes(normalizedAction)) {
    const workOrderNumber = normalizeText(
      payload.work_order_number || payload.wo_number || payload.work_order,
    );
    if (!workOrderNumber) {
      throw buildError("Debe registrar número de WO de retiro", {
        status: 400,
        code: "WITHDRAWAL_WORK_ORDER_NUMBER_REQUIRED",
      });
    }
    const nextState = {
      ...workflowState,
      work_order: {
        ...workflowState.work_order,
        status: "open",
        work_order_number: workOrderNumber,
        assigned_to: normalizeText(payload.assigned_to) || workflowState.work_order.assigned_to,
        assigned_email:
          normalizeText(payload.assigned_email) || workflowState.work_order.assigned_email,
        notes: normalizeText(payload.notes) || workflowState.work_order.notes,
        opened_at: now,
      },
    };
    return {
      nextState,
      eventType: "withdrawal_work_order_opened",
      eventPayload: { work_order_number: workOrderNumber },
    };
  }

  if (["close_work_order", "work_order_close"].includes(normalizedAction)) {
    if (!workflowState.work_order.work_order_number) {
      throw buildError("No existe WO abierta para cierre", {
        status: 409,
        code: "WITHDRAWAL_WORK_ORDER_NOT_OPEN",
      });
    }
    const nextState = {
      ...workflowState,
      work_order: {
        ...workflowState.work_order,
        status: "closed",
        notes: normalizeText(payload.notes) || workflowState.work_order.notes,
        closed_at: now,
      },
    };
    return {
      nextState,
      eventType: "withdrawal_work_order_closed",
      eventPayload: { work_order_number: workflowState.work_order.work_order_number },
    };
  }

  if (["register_disinfection", "mark_disinfection"].includes(normalizedAction)) {
    let fst02FileId = normalizeText(payload.fst02_file_id || payload.file_id);
    let fst02Link = normalizeText(payload.fst02_link || payload.link);
    if (!fst02FileId && normalizeBoolean(payload.use_latest_document, true)) {
      const latest = await findLatestWorkflowDocument({
        sourceType,
        sourceId,
        documentCode: "F.ST-02",
      });
      fst02FileId = normalizeText(latest?.file_id);
      fst02Link = normalizeText(latest?.link) || fst02Link;
    }
    if (!fst02FileId) {
      throw buildError("Debe existir F.ST-02 para continuar con retiro/desinstalación", {
        status: 409,
        code: "FST02_DOCUMENT_REQUIRED",
      });
    }
    const nextState = {
      ...workflowState,
      disinfection: {
        ...workflowState.disinfection,
        status: "completed",
        fst02_file_id: fst02FileId,
        fst02_link: fst02Link || buildDriveLink(fst02FileId),
        performed_at: normalizeIsoDateTime(payload.performed_at, now),
        performed_by: withUser.user_id,
        performed_by_email: withUser.user_email,
        part_change_required: normalizeBoolean(payload.part_change_required, false),
        part_change_notes: normalizeText(payload.part_change_notes),
      },
    };
    return {
      nextState,
      eventType: "withdrawal_disinfection_registered",
      eventPayload: {
        fst02_file_id: fst02FileId,
        part_change_required: normalizeBoolean(payload.part_change_required, false),
      },
    };
  }

  if (["register_packaging", "packaging"].includes(normalizedAction)) {
    if (workflowState.disinfection.status !== "completed") {
      throw buildError("No se puede embalar sin completar desinfección F.ST-02", {
        status: 409,
        code: "PACKAGING_REQUIRES_FST02",
      });
    }

    const resolvedPackages = await resolvePackagingDrafts({
      packages: payload.packages,
      sourceType,
      sourceId,
      clientName: row.client_name || requestSnapshot.client_name || null,
    });
    const packagesRows = await upsertWithdrawalPackages({
      workflowId: row.id,
      packages: resolvedPackages,
      user,
      replaceExisting: true,
    });
    const evidenceCount = packagesRows.reduce(
      (sum, pkg) => sum + (Array.isArray(pkg.evidence) ? pkg.evidence.length : 0),
      0,
    );

    const nextState = {
      ...workflowState,
      packaging: {
        ...workflowState.packaging,
        status: "completed",
        packages: packagesRows,
        total_packages: packagesRows.length,
        total_labels: packagesRows.length,
        evidence_count: evidenceCount,
        notes: normalizeText(payload.notes) || workflowState.packaging.notes,
        last_registered_at: now,
        last_registered_by: withUser.user_id,
        last_registered_by_email: withUser.user_email,
      },
      logistics: {
        ...workflowState.logistics,
        bultos_total: packagesRows.length,
      },
    };
    return {
      nextState,
      eventType: "withdrawal_packaging_registered",
      eventPayload: {
        bultos_total: packagesRows.length,
        evidence_count: evidenceCount,
      },
    };
  }

  if (["mark_withdrawn", "withdrawal_executed"].includes(normalizedAction)) {
    if (workflowState.packaging.status !== "completed") {
      throw buildError("No se puede retirar sin embalaje completado", {
        status: 409,
        code: "WITHDRAWAL_REQUIRES_PACKAGING",
      });
    }
    const pickedUpAt = normalizeIsoDateTime(payload.picked_up_at, now);
    if (!pickedUpAt) {
      throw buildError("Debe registrar fecha/hora de retiro ejecutado", {
        status: 400,
        code: "WITHDRAWAL_PICKED_UP_AT_REQUIRED",
      });
    }
    const nextState = {
      ...workflowState,
      logistics: {
        ...workflowState.logistics,
        status: "withdrawn",
        pickup_date:
          normalizeDateOnly(payload.pickup_date) || workflowState.logistics.pickup_date,
        picked_up_at: pickedUpAt,
        carrier_name:
          normalizeText(payload.carrier_name || payload.transportista) ||
          workflowState.logistics.carrier_name,
        tracking_reference:
          normalizeText(payload.tracking_reference || payload.guia_salida) ||
          workflowState.logistics.tracking_reference,
        notes: normalizeText(payload.notes) || workflowState.logistics.notes,
      },
    };
    notifyWithdrawalRequester(requestSnapshot.requester_id, {
      clientName: row.client_name || requestSnapshot.client_name,
      title: "Equipo retirado",
      message: `El equipo de ${row.client_name || requestSnapshot.client_name || "cliente"} fue retirado físicamente.${nextState.logistics.tracking_reference ? ` Guía: ${nextState.logistics.tracking_reference}.` : ""}`,
      subjectSuffix: "Equipo retirado",
    });
    return {
      nextState,
      eventType: "withdrawal_executed",
      eventPayload: {
        picked_up_at: pickedUpAt,
        tracking_reference: nextState.logistics.tracking_reference,
      },
    };
  }

  if (["attach_fst11", "register_fst11_document"].includes(normalizedAction)) {
    const fst11FileId = normalizeText(payload.fst11_file_id || payload.file_id);
    if (!fst11FileId) {
      throw buildError("Debe registrar archivo F.ST-11", {
        status: 400,
        code: "FST11_FILE_REQUIRED",
      });
    }
    const nextState = {
      ...workflowState,
      withdrawal_act: {
        ...workflowState.withdrawal_act,
        status: "generated",
        fst11_file_id: fst11FileId,
        fst11_link:
          normalizeText(payload.fst11_link || payload.link) || buildDriveLink(fst11FileId),
        generated_at: normalizeIsoDateTime(payload.generated_at, now),
        template_mode: normalizeText(payload.template_mode),
        signed_client: normalizeBoolean(payload.signed_client, workflowState.withdrawal_act.signed_client),
        signed_technical: normalizeBoolean(
          payload.signed_technical,
          workflowState.withdrawal_act.signed_technical,
        ),
        observations:
          normalizeText(payload.observations || payload.notes) ||
          workflowState.withdrawal_act.observations,
      },
    };
    return {
      nextState,
      eventType: "withdrawal_fst11_attached",
      eventPayload: { fst11_file_id: fst11FileId },
    };
  }

  if (["close_withdrawal", "close"].includes(normalizedAction)) {
    const blockedReasons = computeClosureBlockedReasons(workflowState);
    if (blockedReasons.length > 0) {
      throw buildError("No se puede cerrar el retiro, existen bloqueos activos", {
        status: 409,
        code: "WITHDRAWAL_CLOSURE_BLOCKED",
        details: { blocked_reasons: blockedReasons },
      });
    }
    const nextState = {
      ...workflowState,
      closure: {
        ...workflowState.closure,
        status: "closed",
        blocked_reasons: [],
        closed_at: now,
        closed_by: withUser.user_id,
        closed_by_email: withUser.user_email,
      },
    };

    if (Number.isFinite(Number(row.request_id))) {
      markRequestCompleted(Number(row.request_id), {
        actorUser: user,
        resultMeta: { source: "withdrawal_closed", closed_at: now },
      }).catch((err) =>
        logger.warn({ err, requestId: row.request_id }, "No se pudo completar la solicitud tras cerrar el retiro"),
      );
    }

    notifyWithdrawalRequester(requestSnapshot.requester_id, {
      clientName: row.client_name || requestSnapshot.client_name,
      title: "Retiro de equipo cerrado",
      message: `El proceso de retiro de equipo de ${row.client_name || requestSnapshot.client_name || "cliente"} quedó cerrado.${nextState.withdrawal_act.fst11_link ? ` Acta F.ST-11: ${nextState.withdrawal_act.fst11_link}` : ""}`,
      subjectSuffix: "Retiro cerrado",
      type: "success",
    });

    return {
      nextState,
      eventType: "withdrawal_closed",
      eventPayload: { closed_at: now },
    };
  }

  if (["reopen_withdrawal", "reopen"].includes(normalizedAction)) {
    const nextState = {
      ...workflowState,
      closure: {
        ...workflowState.closure,
        status: "pending",
        blocked_reasons: computeClosureBlockedReasons(workflowState),
        closed_at: null,
        closed_by: null,
        closed_by_email: null,
      },
    };
    return {
      nextState,
      eventType: "withdrawal_reopened",
      eventPayload: {},
    };
  }

  throw buildError(`Acción no soportada: ${normalizedAction}`, {
    status: 400,
    code: "WITHDRAWAL_ACTION_NOT_SUPPORTED",
  });
};

const getWithdrawalWorkflowDetail = async ({
  sourceType = null,
  sourceId = null,
  requestId = null,
  createIfMissing = false,
} = {}) => {
  const normalizedSourceType = sourceType ? normalizeSourceType(sourceType) : null;
  const normalizedSourceId = sourceId ? normalizeSourceId(sourceId) : null;
  const numericRequestId = Number.isFinite(Number(requestId)) ? Number(requestId) : null;

  const row = await getWorkflowRow({
    sourceType: normalizedSourceType,
    sourceId: normalizedSourceId,
    requestId: numericRequestId,
  });
  if (row) return hydrateWorkflowRow(row);

  if (createIfMissing && (normalizedSourceType && normalizedSourceId)) {
    return initializeWithdrawalWorkflow({
      sourceType: normalizedSourceType,
      sourceId: normalizedSourceId,
      requestId: numericRequestId,
    });
  }
  if (createIfMissing && numericRequestId) {
    return initializeWithdrawalWorkflow({
      sourceType: normalizedSourceType || defaultSourceTypeForRequest,
      sourceId: normalizedSourceId || String(numericRequestId),
      requestId: numericRequestId,
    });
  }

  if (numericRequestId) {
    const requestRow = await loadRetiroRequestById(numericRequestId);
    const snapshot = buildRequestSnapshot(requestRow);
    const previewState = buildInitialWorkflowState({ requestSnapshot: snapshot });
    const previewLifecycle = deriveWorkflowLifecycle(previewState);
    return {
      id: null,
      exists: false,
      source_type: normalizedSourceType || defaultSourceTypeForRequest,
      source_id: normalizedSourceId || String(numericRequestId),
      request_id: numericRequestId,
      client_name: snapshot.client_name || null,
      equipment_name: snapshot.equipment_name || null,
      request_snapshot: snapshot,
      workflow_state: previewState,
      workflow_status: previewLifecycle.status,
      workflow_stage: previewLifecycle.stage,
      closure_blocked_reasons: previewLifecycle.closure_blocked_reasons,
      created_at: null,
      updated_at: null,
    };
  }

  return null;
};

const updateWithdrawalWorkflowAction = async ({
  action,
  payload = {},
  user = null,
} = {}) => {
  const sourceTypeInput = payload.source_type || payload.sourceType || null;
  const sourceIdInput = payload.source_id || payload.sourceId || null;
  const requestIdInput = Number.isFinite(Number(payload.request_id || payload.requestId))
    ? Number(payload.request_id || payload.requestId)
    : null;

  let row = await getWorkflowRow({
    sourceType: sourceTypeInput ? normalizeSourceType(sourceTypeInput) : null,
    sourceId: sourceIdInput ? normalizeSourceId(sourceIdInput) : null,
    requestId: requestIdInput,
  });

  const normalizedAction = String(action || "").trim().toLowerCase();
  if (!row) {
    if (["initialize", "init", "bootstrap"].includes(normalizedAction)) {
      return initializeWithdrawalWorkflow({
        sourceType: sourceTypeInput || defaultSourceTypeForRequest,
        sourceId: sourceIdInput || (requestIdInput ? String(requestIdInput) : null),
        requestId: requestIdInput,
        user,
      });
    }
    if (requestIdInput || (sourceTypeInput && sourceIdInput)) {
      row = await initializeWithdrawalWorkflow({
        sourceType: sourceTypeInput || defaultSourceTypeForRequest,
        sourceId: sourceIdInput || (requestIdInput ? String(requestIdInput) : null),
        requestId: requestIdInput,
        user,
      });
      row = await getWorkflowRow({
        sourceType: row.source_type,
        sourceId: row.source_id,
      });
    }
  }

  if (!row) {
    throw buildError("No existe workflow de retiro para aplicar la acción", {
      status: 404,
      code: "WITHDRAWAL_WORKFLOW_NOT_FOUND",
    });
  }

  const actionResult = await applyWorkflowAction({
    row,
    action: normalizedAction,
    payload,
    user,
  });

  const requestSnapshot = safeJson(row.request_snapshot, {});
  const detail = await persistWorkflowRow({
    existingRow: row,
    sourceType: row.source_type,
    sourceId: row.source_id,
    requestId: row.request_id,
    clientName: row.client_name || requestSnapshot.client_name || null,
    equipmentName: row.equipment_name || requestSnapshot.equipment_name || null,
    requestSnapshot,
    workflowState: actionResult.nextState,
    user,
    eventType: actionResult.eventType,
    eventPayload: {
      action: normalizedAction,
      ...(actionResult.eventPayload || {}),
    },
  });

  return detail;
};

const attachFst11DocumentToWorkflow = async ({
  sourceType = null,
  sourceId = null,
  requestId = null,
  fileId,
  link = null,
  folderId = null,
  generatedAt = null,
  templateMode = null,
  signedClient = false,
  signedTechnical = false,
  notes = null,
  user = null,
} = {}) => {
  const normalizedFileId = normalizeText(fileId);
  if (!normalizedFileId) {
    throw buildError("fileId es obligatorio para adjuntar F.ST-11", {
      status: 400,
      code: "FST11_FILE_REQUIRED",
    });
  }

  const detail = await updateWithdrawalWorkflowAction({
    action: "attach_fst11",
    payload: {
      source_type: sourceType,
      source_id: sourceId,
      request_id: requestId,
      fst11_file_id: normalizedFileId,
      fst11_link: normalizeText(link) || buildDriveLink(normalizedFileId),
      generated_at: generatedAt || new Date().toISOString(),
      template_mode: templateMode,
      signed_client: signedClient,
      signed_technical: signedTechnical,
      observations: notes,
    },
    user,
  });

  await trackWorkflowDocumentByCode({
    sourceType: detail.source_type,
    sourceId: detail.source_id,
    documentCode: "F.ST-11",
    stageKey: "technical_documents_in_progress",
    eventType: "fst11_withdrawal_act_recorded",
    requestId: detail.request_id || null,
    driveFileId: normalizedFileId,
    driveFolderId: normalizeText(folderId),
    driveLink: normalizeText(link) || buildDriveLink(normalizedFileId),
    clientName: detail.client_name || null,
    equipmentName: detail.equipment_name || null,
    user,
    metadata: {
      template_mode: templateMode || null,
      signed_client: Boolean(signedClient),
      signed_technical: Boolean(signedTechnical),
      generated_at: generatedAt || new Date().toISOString(),
    },
  });

  return getWithdrawalWorkflowDetail({
    sourceType: detail.source_type,
    sourceId: detail.source_id,
  });
};

const listWithdrawalWorkflows = async ({
  q = null,
  status = null,
  sourceType = null,
  limit = 100,
} = {}) => {
  await ensureWithdrawalWorkflowTables();
  const safeLimit = Math.max(1, Math.min(300, Number.parseInt(String(limit || "100"), 10) || 100));

  const params = [];
  const where = [];
  if (status) {
    params.push(String(status).trim().toLowerCase());
    where.push(`ww.workflow_status = $${params.length}`);
  }
  if (sourceType) {
    params.push(String(sourceType).trim().toLowerCase());
    where.push(`ww.source_type = $${params.length}`);
  }
  if (q) {
    const search = `%${String(q).trim().toLowerCase()}%`;
    params.push(search);
    where.push(`
      (
        LOWER(COALESCE(ww.client_name, '')) LIKE $${params.length}
        OR LOWER(COALESCE(ww.equipment_name, '')) LIKE $${params.length}
        OR LOWER(COALESCE(ww.source_id, '')) LIKE $${params.length}
        OR CAST(COALESCE(ww.request_id, 0) AS TEXT) LIKE $${params.length}
      )
    `);
  }
  params.push(safeLimit);

  const { rows } = await db.query(
    `
      SELECT
        ww.*,
        r.status AS request_status,
        r.payload AS request_payload,
        r.created_at AS request_created_at
      FROM servicio.withdrawal_workflows ww
      LEFT JOIN requests r ON r.id = ww.request_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY ww.updated_at DESC
      LIMIT $${params.length}
    `,
    params,
  );

  const hydrated = [];
  for (const row of rows) {
     
    const detail = await hydrateWorkflowRow(row);
    hydrated.push({
      ...detail,
      request_status: row.request_status || null,
      request_created_at: row.request_created_at || null,
      request_payload: parseRequestPayload(row.request_payload),
    });
  }
  return hydrated;
};

module.exports = {
  WORKFLOW_STATUS,
  ensureWithdrawalWorkflowTables,
  getWithdrawalWorkflowDetail,
  listWithdrawalWorkflows,
  initializeWithdrawalWorkflow,
  updateWithdrawalWorkflowAction,
  attachFst11DocumentToWorkflow,
};

