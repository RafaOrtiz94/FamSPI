const db = require("../../config/db");
const logger = require("../../config/logger");
const { upsertWorkflow } = require("./workflowRegistry.service");
const { appendWorkflowAuditEvent } = require("./workflowAudit.service");
const {
  DISPATCH_ROLES,
  getUsersByRoles,
  notifyUsers,
} = require("./ceacDispatch.service");

const navifyAdapter = require("./adapters/navify.adapter");
const rexisAdapter = require("./adapters/rexis.adapter");
const goappAdapter = require("./adapters/goapp.adapter");

const PROVIDERS = Object.freeze(["navify", "online_support", "rexis", "goapp"]);
const GOAPP_MILESTONES = Object.freeze([
  "accept_work_order",
  "start_travel",
  "work_time",
  "finalize_work_order",
  "follow_up_appointment",
]);
const GOAPP_MILESTONE_PRECONDITIONS = Object.freeze({
  start_travel: "accept_work_order",
  work_time: "start_travel",
  finalize_work_order: "work_time",
});
const WORKFLOW_PROCEDURE_CODE = "ST-01-04";
const DEFAULT_QUERY_LIMIT = 100;
const DEFAULT_SYNC_BATCH_LIMIT = 20;
const DEFAULT_MAX_ATTEMPTS = Math.max(1, Number(process.env.EXTERNAL_CASE_SYNC_MAX_ATTEMPTS || 5));
const DEFAULT_BACKOFF_BASE_MS = Math.max(1000, Number(process.env.EXTERNAL_CASE_SYNC_BACKOFF_BASE_MS || 60000));
const DEFAULT_BACKOFF_MAX_MS = Math.max(DEFAULT_BACKOFF_BASE_MS, Number(process.env.EXTERNAL_CASE_SYNC_BACKOFF_MAX_MS || 21600000));

const ADAPTER_REGISTRY = Object.freeze({
  navify: navifyAdapter,
  online_support: navifyAdapter,
  rexis: rexisAdapter,
  goapp: goappAdapter,
});

const WORKFLOW_STAGE_BY_INTERNAL_STATUS = Object.freeze({
  initiated: "initiated",
  pending_validation: "initiated",
  ready_to_sync: "initiated",
  external_created: "external_created",
  ceac_review: "external_created",
  dispatched: "dispatched",
  travel_started: "executing",
  work_in_progress: "executing",
  finalized: "completed",
  follow_up_pending: "executing",
  closed: "completed",
  cancelled: "cancelled",
  sync_error: "blocked",
  blocked: "blocked",
});

const normalize = (value) => String(value || "").trim().toLowerCase();
const normalizeText = (value, fallback = null) => {
  const text = String(value || "").trim();
  return text || fallback;
};
const normalizeProvider = (value) => {
  const normalized = normalize(value);
  if (normalized === "onlinesupport") return "online_support";
  if (normalized === "online-support") return "online_support";
  if (normalized === "go_app") return "goapp";
  return normalized;
};
const normalizeInt = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};
const normalizeDateTime = (value, fallback = null) => {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString();
};
const isTrue = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on", "si"].includes(normalize(value));
};
const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};
const clampLimit = (value, fallback = DEFAULT_QUERY_LIMIT) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(500, parsed));
};
const json = (value) => JSON.stringify(value || {});

const buildError = (message, {
  status = 400,
  code = "EXTERNAL_CASE_REQUEST_ERROR",
  retryable = false,
  details = null,
} = {}) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.retryable = retryable;
  if (details) error.details = details;
  return error;
};

const computeBackoffMs = (attempt) => {
  const safeAttempt = Math.max(1, Number(attempt || 1));
  const factor = Math.pow(2, safeAttempt - 1);
  return Math.min(DEFAULT_BACKOFF_MAX_MS, DEFAULT_BACKOFF_BASE_MS * factor);
};

const adapterForProvider = (provider) => ADAPTER_REGISTRY[normalizeProvider(provider)] || null;
const providerToEnvToken = (provider) => normalizeProvider(provider).toUpperCase().replace(/[^A-Z0-9]+/g, "_");

const getProviderConfig = (provider) => {
  const normalizedProvider = normalizeProvider(provider);
  const token = providerToEnvToken(normalizedProvider);
  return {
    provider: normalizedProvider,
    enabled: isTrue(process.env[`ST_EXT_${token}_ENABLED`], false),
    contract_approved: isTrue(process.env[`ST_EXT_${token}_CONTRACT_APPROVED`], false),
    base_url: normalizeText(process.env[`ST_EXT_${token}_BASE_URL`], null),
    auth_token: normalizeText(process.env[`ST_EXT_${token}_AUTH_TOKEN`], null),
    api_key: normalizeText(process.env[`ST_EXT_${token}_API_KEY`], null),
    mock_mode:
      isTrue(process.env[`ST_EXT_${token}_MOCK_MODE`], false)
      || isTrue(process.env.ST_EXT_GLOBAL_MOCK_MODE, false),
    auto_sync:
      isTrue(process.env[`ST_EXT_${token}_AUTO_SYNC`], true)
      && !isTrue(process.env.ST_EXT_AUTO_SYNC_DISABLED, false),
  };
};

let schemaReadyPromise = null;

async function ensureSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
    await db.query("CREATE SCHEMA IF NOT EXISTS servicio");
    await db.query(`
      CREATE TABLE IF NOT EXISTS servicio.external_cases (
        id BIGSERIAL PRIMARY KEY,
        code VARCHAR(24) UNIQUE,
        provider TEXT NOT NULL,
        source_channel TEXT NOT NULL DEFAULT 'internal',
        linked_support_ticket_id BIGINT,
        linked_equipment_purchase_id BIGINT,
        linked_private_purchase_id BIGINT,
        linked_corrective_case_id BIGINT,
        client_name TEXT,
        client_identifier TEXT,
        area_name TEXT,
        laboratory_name TEXT,
        equipment_serial TEXT,
        alarm_code TEXT,
        incident_type TEXT,
        issue_description TEXT,
        internal_status TEXT NOT NULL DEFAULT 'initiated',
        external_status TEXT,
        provider_case_reference TEXT,
        normalized_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        original_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        goapp_milestones JSONB NOT NULL DEFAULT '{}'::jsonb,
        sync_attempts INTEGER NOT NULL DEFAULT 0,
        sync_last_error TEXT,
        sync_last_error_code TEXT,
        sync_last_error_at TIMESTAMPTZ,
        sync_retryable BOOLEAN NOT NULL DEFAULT TRUE,
        last_sync_at TIMESTAMPTZ,
        next_sync_retry_at TIMESTAMPTZ,
        state_drift BOOLEAN NOT NULL DEFAULT FALSE,
        state_drift_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
        last_reconciled_at TIMESTAMPTZ,
        created_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
        created_by_email TEXT,
        updated_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
        updated_by_email TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_external_cases_provider_status
        ON servicio.external_cases (provider, internal_status, updated_at DESC)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_external_cases_sync_status
        ON servicio.external_cases (sync_retryable, next_sync_retry_at, updated_at DESC)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_external_cases_search
        ON servicio.external_cases (provider_case_reference, equipment_serial, client_name)
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS servicio.external_provider_identities (
        id BIGSERIAL PRIMARY KEY,
        provider TEXT NOT NULL,
        client_user_identifier TEXT NOT NULL,
        provider_user_identifier TEXT,
        credential_alias TEXT,
        area_name TEXT,
        laboratory_name TEXT,
        equipment_serial TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
        created_by_email TEXT,
        updated_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
        updated_by_email TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_external_provider_identity
        ON servicio.external_provider_identities (
          provider,
          client_user_identifier,
          COALESCE(equipment_serial, ''),
          COALESCE(area_name, ''),
          COALESCE(laboratory_name, '')
        )
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_external_provider_identity_search
        ON servicio.external_provider_identities (provider, status, updated_at DESC)
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS servicio.external_case_events (
        id BIGSERIAL PRIMARY KEY,
        external_case_id BIGINT NOT NULL REFERENCES servicio.external_cases(id) ON DELETE CASCADE,
        actor_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
        actor_email TEXT,
        event_type TEXT NOT NULL,
        old_internal_status TEXT,
        new_internal_status TEXT,
        comment TEXT,
        event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_external_case_events_case
        ON servicio.external_case_events (external_case_id, created_at DESC)
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS servicio.external_case_sync_jobs (
        id BIGSERIAL PRIMARY KEY,
        external_case_id BIGINT NOT NULL REFERENCES servicio.external_cases(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        operation TEXT NOT NULL DEFAULT 'sync_case',
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT ${DEFAULT_MAX_ATTEMPTS},
        next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        locked_at TIMESTAMPTZ,
        locked_by TEXT,
        last_error TEXT,
        last_error_code TEXT,
        last_error_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_external_case_sync_jobs_queue
        ON servicio.external_case_sync_jobs (status, next_attempt_at, id)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_external_case_sync_jobs_case
        ON servicio.external_case_sync_jobs (external_case_id, created_at DESC)
    `);
  })().catch((error) => {
    schemaReadyPromise = null;
    throw error;
  });

  return schemaReadyPromise;
}

const buildCaseCode = (id) => `EXT-${String(id || "").padStart(6, "0")}`;

const mapCaseRow = (row) => ({
  id: Number(row.id),
  code: row.code,
  provider: row.provider,
  source_channel: row.source_channel || "internal",
  linked_support_ticket_id: normalizeInt(row.linked_support_ticket_id, null),
  linked_equipment_purchase_id: normalizeInt(row.linked_equipment_purchase_id, null),
  linked_private_purchase_id: normalizeInt(row.linked_private_purchase_id, null),
  linked_corrective_case_id: normalizeInt(row.linked_corrective_case_id, null),
  client_name: row.client_name || null,
  client_identifier: row.client_identifier || null,
  area_name: row.area_name || null,
  laboratory_name: row.laboratory_name || null,
  equipment_serial: row.equipment_serial || null,
  alarm_code: row.alarm_code || null,
  incident_type: row.incident_type || null,
  issue_description: row.issue_description || null,
  internal_status: row.internal_status || "initiated",
  external_status: row.external_status || null,
  provider_case_reference: row.provider_case_reference || null,
  normalized_payload: asObject(row.normalized_payload),
  original_payload: asObject(row.original_payload),
  goapp_milestones: asObject(row.goapp_milestones),
  sync_attempts: normalizeInt(row.sync_attempts, 0) || 0,
  sync_last_error: row.sync_last_error || null,
  sync_last_error_code: row.sync_last_error_code || null,
  sync_last_error_at: row.sync_last_error_at || null,
  sync_retryable: Boolean(row.sync_retryable),
  last_sync_at: row.last_sync_at || null,
  next_sync_retry_at: row.next_sync_retry_at || null,
  state_drift: Boolean(row.state_drift),
  state_drift_detail: asObject(row.state_drift_detail),
  last_reconciled_at: row.last_reconciled_at || null,
  created_by_user_id: normalizeInt(row.created_by_user_id, null),
  created_by_email: row.created_by_email || null,
  updated_by_user_id: normalizeInt(row.updated_by_user_id, null),
  updated_by_email: row.updated_by_email || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
  pending_sync_jobs: normalizeInt(row.pending_sync_jobs, 0) || 0,
  failed_sync_jobs: normalizeInt(row.failed_sync_jobs, 0) || 0,
});

const mapEventRow = (row) => ({
  id: Number(row.id),
  external_case_id: Number(row.external_case_id),
  actor_user_id: normalizeInt(row.actor_user_id, null),
  actor_email: row.actor_email || null,
  actor_name: row.actor_name || null,
  event_type: row.event_type,
  old_internal_status: row.old_internal_status || null,
  new_internal_status: row.new_internal_status || null,
  comment: row.comment || null,
  event_payload: asObject(row.event_payload),
  created_at: row.created_at,
});

const mapJobRow = (row) => ({
  id: Number(row.id),
  external_case_id: Number(row.external_case_id),
  provider: row.provider,
  operation: row.operation,
  payload: asObject(row.payload),
  status: row.status,
  attempts: normalizeInt(row.attempts, 0) || 0,
  max_attempts: normalizeInt(row.max_attempts, DEFAULT_MAX_ATTEMPTS) || DEFAULT_MAX_ATTEMPTS,
  next_attempt_at: row.next_attempt_at || null,
  locked_at: row.locked_at || null,
  locked_by: row.locked_by || null,
  last_error: row.last_error || null,
  last_error_code: row.last_error_code || null,
  last_error_payload: asObject(row.last_error_payload),
  completed_at: row.completed_at || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapIdentityRow = (row) => ({
  id: Number(row.id),
  provider: row.provider,
  client_user_identifier: row.client_user_identifier,
  provider_user_identifier: row.provider_user_identifier || null,
  credential_alias: row.credential_alias || null,
  area_name: row.area_name || null,
  laboratory_name: row.laboratory_name || null,
  equipment_serial: row.equipment_serial || null,
  status: row.status || "active",
  metadata: asObject(row.metadata),
  created_by_user_id: normalizeInt(row.created_by_user_id, null),
  created_by_email: row.created_by_email || null,
  updated_by_user_id: normalizeInt(row.updated_by_user_id, null),
  updated_by_email: row.updated_by_email || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const normalizePhoto = (item) => {
  const source = asObject(item);
  const url = normalizeText(source.url || source.link || source.href || source.path || source.value);
  const name = normalizeText(source.name || source.file_name || source.filename || source.fileName);
  const contentType = normalizeText(source.content_type || source.contentType || source.mime_type || source.mimeType);
  const sizeBytes = normalizeInt(source.size_bytes || source.sizeBytes || source.size, null);
  if (!url && !name) return null;
  return {
    url: url || null,
    name: name || null,
    content_type: contentType || null,
    size_bytes: sizeBytes,
  };
};

const normalizePartsUsed = (parts) => {
  return asArray(parts)
    .map((part) => {
      const source = asObject(part);
      const code = normalizeText(source.code || source.part_code || source.partCode);
      const description = normalizeText(source.description || source.part_description || source.partDescription);
      const quantity = normalizeInt(source.qty || source.quantity || source.cantidad, 1);
      if (!code && !description) return null;
      return {
        code: code || null,
        description: description || null,
        quantity: quantity && quantity > 0 ? quantity : 1,
      };
    })
    .filter(Boolean);
};

const normalizeExternalPayload = (payload = {}) => {
  const source = asObject(payload);
  const photos = asArray(
    source.photos
    || source.images
    || source.attachments
    || source.evidences
    || source.evidence_images,
  )
    .map(normalizePhoto)
    .filter(Boolean);

  const linkedSupportTicketId = normalizeInt(
    source.linked_support_ticket_id
    || source.linkedSupportTicketId
    || source.support_ticket_id
    || source.supportTicketId,
    null,
  );
  const linkedEquipmentPurchaseId = normalizeInt(
    source.linked_equipment_purchase_id
    || source.linkedEquipmentPurchaseId
    || source.equipment_purchase_id
    || source.equipmentPurchaseId,
    null,
  );
  const linkedPrivatePurchaseId = normalizeInt(
    source.linked_private_purchase_id
    || source.linkedPrivatePurchaseId
    || source.private_purchase_id
    || source.privatePurchaseId,
    null,
  );
  const linkedCorrectiveCaseId = normalizeInt(
    source.linked_corrective_case_id
    || source.linkedCorrectiveCaseId
    || source.corrective_case_id
    || source.correctiveCaseId,
    null,
  );

  const technicalReport = asObject(
    source.technical_report
    || source.technicalReport,
  );
  const timeTracking = asObject(
    source.time_tracking
    || source.timeTracking,
  );
  const followUp = asObject(
    source.follow_up
    || source.followUp,
  );

  return {
    provider: normalizeProvider(source.provider),
    client_name: normalizeText(
      source.client_name
      || source.clientName
      || source.customer_name
      || source.customerName
      || source.cliente,
      null,
    ),
    client_identifier: normalizeText(
      source.client_identifier
      || source.clientIdentifier
      || source.client_id
      || source.clientId
      || source.customer_id
      || source.customerId
      || source.ruc
      || source.cedula,
      null,
    ),
    area_name: normalizeText(
      source.area_name
      || source.areaName
      || source.area
      || source.service_area,
      null,
    ),
    laboratory_name: normalizeText(
      source.laboratory_name
      || source.laboratoryName
      || source.laboratory
      || source.lab,
      null,
    ),
    equipment_serial: normalizeText(
      source.equipment_serial
      || source.equipmentSerial
      || source.serial
      || source.serie,
      null,
    ),
    equipment_name: normalizeText(
      source.equipment_name
      || source.equipmentName
      || source.model
      || source.equipment_model
      || source.equipmentModel,
      null,
    ),
    alarm_code: normalizeText(
      source.alarm_code
      || source.alarmCode
      || source.codigo_alarma
      || source.alarm,
      null,
    ),
    incident_type: normalizeText(
      source.incident_type
      || source.incidentType
      || source.problem_type
      || source.problemType
      || source.tipo_incidencia,
      null,
    ),
    issue_description: normalizeText(
      source.issue_description
      || source.issueDescription
      || source.problem_description
      || source.problemDescription
      || source.description
      || source.descripcion,
      null,
    ),
    source_created_at: normalizeDateTime(
      source.source_created_at
      || source.sourceCreatedAt
      || source.created_at
      || source.createdAt,
      null,
    ),
    product_affected: normalizeText(
      source.product_affected
      || source.productAffected
      || source.producto_afectado,
      null,
    ),
    product_affected_required: isTrue(
      source.product_affected_required
      || source.productAffectedRequired,
      false,
    ),
    parts_used: normalizePartsUsed(
      source.parts_used
      || source.partsUsed
      || technicalReport.parts_used
      || technicalReport.partsUsed,
    ),
    technical_report: {
      problem_description: normalizeText(
        technicalReport.problem_description
        || technicalReport.problemDescription
        || source.problem_description
        || source.problemDescription,
        null,
      ),
      solution_applied: normalizeText(
        technicalReport.solution_applied
        || technicalReport.solutionApplied
        || source.solution_applied
        || source.solutionApplied,
        null,
      ),
      client_communication: normalizeText(
        technicalReport.client_communication
        || technicalReport.clientCommunication
        || source.client_communication
        || source.clientCommunication,
        null,
      ),
      client_signature: normalizeText(
        technicalReport.client_signature
        || technicalReport.clientSignature
        || source.client_signature
        || source.clientSignature,
        null,
      ),
      service_signature: normalizeText(
        technicalReport.service_signature
        || technicalReport.serviceSignature
        || source.service_signature
        || source.serviceSignature,
        null,
      ),
    },
    time_tracking: {
      travel_start_at: normalizeDateTime(
        timeTracking.travel_start_at || timeTracking.travelStartAt || source.travel_start_at || source.travelStartAt,
        null,
      ),
      work_start_at: normalizeDateTime(
        timeTracking.work_start_at || timeTracking.workStartAt || source.work_start_at || source.workStartAt,
        null,
      ),
      work_end_at: normalizeDateTime(
        timeTracking.work_end_at || timeTracking.workEndAt || source.work_end_at || source.workEndAt,
        null,
      ),
      travel_minutes: normalizeInt(
        timeTracking.travel_minutes || timeTracking.travelMinutes || source.travel_minutes || source.travelMinutes,
        null,
      ),
      work_minutes: normalizeInt(
        timeTracking.work_minutes || timeTracking.workMinutes || source.work_minutes || source.workMinutes,
        null,
      ),
    },
    follow_up: {
      required: isTrue(followUp.required || followUp.is_required || source.follow_up_required || source.followUpRequired, false),
      date: normalizeDateTime(followUp.date || followUp.follow_up_date || followUp.followUpDate || source.follow_up_date || source.followUpDate, null),
      notes: normalizeText(followUp.notes || followUp.reason || source.follow_up_notes || source.followUpNotes, null),
    },
    work_order_type: normalizeText(
      source.work_order_type
      || source.workOrderType
      || source.wo_type
      || source.woType,
      null,
    ),
    operation_mode: normalizeText(
      source.operation_mode
      || source.operationMode
      || source.case_mode
      || source.caseMode,
      null,
    ),
    ins_code: normalizeText(
      source.ins_code
      || source.insCode
      || source.installation_code
      || source.installationCode,
      null,
    ),
    preventive_checklist: asObject(
      source.preventive_checklist
      || source.preventiveChecklist
      || source.checklist_preventivo,
    ),
    installation_checklist: asObject(
      source.installation_checklist
      || source.installationChecklist
      || source.decontamination_checklist
      || source.decontaminationChecklist
      || source.checklist_instalacion,
    ),
    modification_detail: asObject(
      source.modification_detail
      || source.modificationDetail
      || source.modificacion,
    ),
    dispatch_mode: normalizeText(
      source.dispatch_mode
      || source.dispatchMode
      || source.manual_dispatch_mode
      || source.manualDispatchMode,
      null,
    ),
    photos,
    linked_support_ticket_id: linkedSupportTicketId,
    linked_equipment_purchase_id: linkedEquipmentPurchaseId,
    linked_private_purchase_id: linkedPrivatePurchaseId,
    linked_corrective_case_id: linkedCorrectiveCaseId,
  };
};

const validateCasePayload = (normalizedPayload = {}, { strict = true } = {}) => {
  const errors = [];
  if (!normalizedPayload.area_name) errors.push("area_name");
  if (!normalizedPayload.equipment_serial) errors.push("equipment_serial");
  if (!normalizedPayload.alarm_code) errors.push("alarm_code");
  if (!normalizedPayload.incident_type) errors.push("incident_type");
  if (!normalizedPayload.issue_description || normalizedPayload.issue_description.length < 8) {
    errors.push("issue_description");
  }
  if (!strict) return errors;
  return errors;
};

const resolveWorkflowStage = (internalStatus) =>
  WORKFLOW_STAGE_BY_INTERNAL_STATUS[normalize(internalStatus)] || "initiated";

const syncWorkflowProjection = async ({
  externalCase,
  actorUser = null,
  eventType = "sync_projection",
  payload = {},
}) => {
  try {
    await upsertWorkflow({
      sourceType: "external_case",
      sourceId: String(externalCase.id),
      requestId: null,
      clientName: externalCase.client_name || null,
      equipmentName: externalCase.equipment_serial || null,
      procedureCode: WORKFLOW_PROCEDURE_CODE,
      globalStatus: resolveWorkflowStage(externalCase.internal_status),
      currentStage: resolveWorkflowStage(externalCase.internal_status),
      metadata: {
        provider: externalCase.provider,
        provider_case_reference: externalCase.provider_case_reference || null,
        internal_status: externalCase.internal_status,
        external_status: externalCase.external_status || null,
        last_sync_at: externalCase.last_sync_at || null,
        state_drift: Boolean(externalCase.state_drift),
      },
      user: actorUser || null,
    });

    await appendWorkflowAuditEvent({
      sourceType: "external_case",
      sourceId: String(externalCase.id),
      procedureCode: WORKFLOW_PROCEDURE_CODE,
      eventType,
      stageKey: resolveWorkflowStage(externalCase.internal_status),
      actor: actorUser || null,
      payload,
    });
  } catch (error) {
    logger.warn(
      { error: error?.message || String(error), caseId: externalCase?.id },
      "[EXTERNAL_CASES] No se pudo actualizar proyección de workflow ST-01-04",
    );
  }
};

const createEvent = async (client, {
  externalCaseId,
  actorUser = null,
  eventType,
  oldInternalStatus = null,
  newInternalStatus = null,
  comment = null,
  payload = {},
}) => {
  const { rows } = await client.query(
    `
      INSERT INTO servicio.external_case_events (
        external_case_id, actor_user_id, actor_email, event_type, old_internal_status, new_internal_status, comment, event_payload, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,now())
      RETURNING *
    `,
    [
      externalCaseId,
      actorUser?.id || null,
      actorUser?.email || null,
      String(eventType || "").trim().toLowerCase(),
      oldInternalStatus || null,
      newInternalStatus || null,
      comment || null,
      json(payload),
    ],
  );
  return rows[0] ? mapEventRow(rows[0]) : null;
};

const fetchCaseById = async (caseId, { client = db } = {}) => {
  const { rows } = await client.query(
    `
      SELECT c.*,
        (
          SELECT COUNT(*)
          FROM servicio.external_case_sync_jobs j
          WHERE j.external_case_id = c.id
            AND j.status IN ('pending', 'retry', 'processing')
        )::int AS pending_sync_jobs,
        (
          SELECT COUNT(*)
          FROM servicio.external_case_sync_jobs j
          WHERE j.external_case_id = c.id
            AND j.status = 'failed'
        )::int AS failed_sync_jobs
      FROM servicio.external_cases c
      WHERE c.id = $1
      LIMIT 1
    `,
    [caseId],
  );
  return rows[0] ? mapCaseRow(rows[0]) : null;
};

const ensureCaseExists = async (caseId, options = {}) => {
  const current = await fetchCaseById(caseId, options);
  if (!current) {
    throw buildError("Caso externo no encontrado", {
      status: 404,
      code: "EXTERNAL_CASE_NOT_FOUND",
    });
  }
  return current;
};

const enqueueSyncJob = async ({
  externalCaseId,
  provider,
  operation = "sync_case",
  payload = {},
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  nextAttemptAt = null,
  client = db,
}) => {
  const safeProvider = normalizeProvider(provider);
  if (!safeProvider || !PROVIDERS.includes(safeProvider)) {
    throw buildError(`Proveedor no soportado para cola de sync: ${provider}`, {
      status: 400,
      code: "EXTERNAL_CASE_PROVIDER_INVALID",
    });
  }
  const { rows } = await client.query(
    `
      INSERT INTO servicio.external_case_sync_jobs (
        external_case_id, provider, operation, payload, status, attempts, max_attempts, next_attempt_at, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4::jsonb,'pending',0,$5,COALESCE($6::timestamptz, now()),now(),now())
      RETURNING *
    `,
    [
      externalCaseId,
      safeProvider,
      normalize(operation) || "sync_case",
      json(payload),
      Math.max(1, normalizeInt(maxAttempts, DEFAULT_MAX_ATTEMPTS) || DEFAULT_MAX_ATTEMPTS),
      nextAttemptAt || null,
    ],
  );
  return rows[0] ? mapJobRow(rows[0]) : null;
};

const claimSyncJobs = async ({ limit = DEFAULT_SYNC_BATCH_LIMIT, workerId = "external-case-sync" } = {}) => {
  const safeLimit = clampLimit(limit, DEFAULT_SYNC_BATCH_LIMIT);
  const { rows } = await db.query(
    `
      WITH candidate AS (
        SELECT id
        FROM servicio.external_case_sync_jobs
        WHERE status IN ('pending', 'retry')
          AND next_attempt_at <= now()
        ORDER BY next_attempt_at ASC, id ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE servicio.external_case_sync_jobs j
         SET status = 'processing',
             locked_at = now(),
             locked_by = $2,
             attempts = j.attempts + 1,
             updated_at = now()
        FROM candidate c
       WHERE j.id = c.id
      RETURNING j.*
    `,
    [safeLimit, normalizeText(workerId, "external-case-sync")],
  );
  return rows.map(mapJobRow);
};

const resolveInternalStatusAfterSync = ({ currentStatus, operation }) => {
  const op = normalize(operation);
  if (op === "create_case" || op === "sync_case") return "external_created";
  if (op === "escalate_dispatch" || op === "accept_work_order") return "dispatched";
  if (op === "start_travel") return "travel_started";
  if (op === "work_time") return "work_in_progress";
  if (op === "finalize_work_order") return "finalized";
  if (op === "follow_up_appointment") return "follow_up_pending";
  return currentStatus || "external_created";
};

const expectedExternalStatesByInternal = Object.freeze({
  initiated: ["new", "draft", "initiated"],
  pending_validation: ["new", "draft", "initiated"],
  ready_to_sync: ["new", "draft", "initiated"],
  external_created: ["external_created", "created", "open", "assigned"],
  dispatched: ["dispatched", "assigned", "accepted"],
  travel_started: ["travel_started", "travelling", "on_route"],
  work_in_progress: ["work_in_progress", "in_progress", "executing"],
  follow_up_pending: ["follow_up_planned", "pending_follow_up", "scheduled_follow_up", "in_progress"],
  finalized: ["completed", "closed", "finalized"],
  closed: ["completed", "closed", "finalized"],
  blocked: ["blocked", "error", "sync_error"],
  sync_error: ["blocked", "error", "sync_error"],
  cancelled: ["cancelled", "closed"],
});

const buildStateDriftDetail = ({ internalStatus, externalStatus }) => {
  const internal = normalize(internalStatus);
  const external = normalize(externalStatus);
  const expected = expectedExternalStatesByInternal[internal] || [];
  if (!external) {
    return {
      drift: false,
      reason: "no_external_status",
      expected_external_statuses: expected,
      current_external_status: null,
    };
  }
  if (!expected.length) {
    return {
      drift: false,
      reason: "no_expected_state_mapping",
      expected_external_statuses: [],
      current_external_status: external,
    };
  }
  const drift = !expected.includes(external);
  return {
    drift,
    reason: drift ? "state_mismatch" : "aligned",
    expected_external_statuses: expected,
    current_external_status: external,
  };
};

const maybeAutoProcessQueue = async ({ provider, actorUser = null } = {}) => {
  const config = getProviderConfig(provider);
  if (!config.auto_sync) return null;
  return processPendingSyncJobs({
    limit: 1,
    actorUser,
    workerId: "external-case-auto-sync",
  });
};

async function createExternalCase({
  payload = {},
  actorUser = null,
  sourceChannel = "internal",
  provider: providerOverride = null,
  strictValidation = true,
}) {
  await ensureSchema();
  const normalizedPayload = normalizeExternalPayload(payload);
  const provider = normalizeProvider(providerOverride || normalizedPayload.provider || payload.provider);
  if (!provider || !PROVIDERS.includes(provider)) {
    throw buildError("provider es obligatorio y debe ser navify, online_support, rexis o goapp", {
      status: 400,
      code: "EXTERNAL_CASE_PROVIDER_REQUIRED",
    });
  }

  const validationErrors = validateCasePayload(normalizedPayload, { strict: strictValidation });
  const initialStatus = validationErrors.length > 0 ? "pending_validation" : "ready_to_sync";
  const syncLastError = validationErrors.length > 0
    ? `Faltan campos requeridos: ${validationErrors.join(", ")}`
    : null;

  const client = await db.getClient();
  let createdCase = null;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `
        INSERT INTO servicio.external_cases (
          provider, source_channel,
          linked_support_ticket_id, linked_equipment_purchase_id, linked_private_purchase_id, linked_corrective_case_id,
          client_name, client_identifier, area_name, laboratory_name, equipment_serial, alarm_code, incident_type, issue_description,
          internal_status, external_status, provider_case_reference,
          normalized_payload, original_payload, goapp_milestones,
          sync_attempts, sync_last_error, sync_last_error_code, sync_last_error_at, sync_retryable, state_drift, state_drift_detail,
          created_by_user_id, created_by_email, updated_by_user_id, updated_by_email,
          created_at, updated_at
        )
        VALUES (
          $1,$2,
          $3,$4,$5,$6,
          $7,$8,$9,$10,$11,$12,$13,$14,
          $15,NULL,NULL,
          $16::jsonb,$17::jsonb,'{}'::jsonb,
          0,$18,$19,CASE WHEN $18 IS NULL THEN NULL ELSE now() END,$20,FALSE,'{}'::jsonb,
          $21,$22,$21,$22,
          now(),now()
        )
        RETURNING *
      `,
      [
        provider,
        normalizeText(sourceChannel, "internal"),
        normalizedPayload.linked_support_ticket_id,
        normalizedPayload.linked_equipment_purchase_id,
        normalizedPayload.linked_private_purchase_id,
        normalizedPayload.linked_corrective_case_id,
        normalizedPayload.client_name,
        normalizedPayload.client_identifier,
        normalizedPayload.area_name,
        normalizedPayload.laboratory_name,
        normalizedPayload.equipment_serial,
        normalizedPayload.alarm_code,
        normalizedPayload.incident_type,
        normalizedPayload.issue_description,
        initialStatus,
        json(normalizedPayload),
        json(asObject(payload)),
        syncLastError,
        validationErrors.length > 0 ? "PAYLOAD_VALIDATION_MISSING_FIELDS" : null,
        validationErrors.length === 0,
        actorUser?.id || null,
        actorUser?.email || null,
      ],
    );

    createdCase = rows[0] ? mapCaseRow(rows[0]) : null;
    if (!createdCase) {
      throw buildError("No se pudo crear el caso externo", {
        status: 500,
        code: "EXTERNAL_CASE_CREATE_FAILED",
      });
    }

    const code = buildCaseCode(createdCase.id);
    const { rows: updatedRows } = await client.query(
      `
        UPDATE servicio.external_cases
           SET code = COALESCE(code, $1),
               updated_at = now()
         WHERE id = $2
         RETURNING *
      `,
      [code, createdCase.id],
    );
    createdCase = updatedRows[0] ? mapCaseRow(updatedRows[0]) : createdCase;

    await createEvent(client, {
      externalCaseId: createdCase.id,
      actorUser,
      eventType: "case_created",
      oldInternalStatus: null,
      newInternalStatus: createdCase.internal_status,
      comment: validationErrors.length > 0
        ? "Caso creado con validaciones pendientes"
        : "Caso creado y listo para sincronización",
      payload: {
        provider,
        source_channel: sourceChannel || "internal",
        validation_errors: validationErrors,
      },
    });

    if (validationErrors.length === 0) {
      await enqueueSyncJob({
        externalCaseId: createdCase.id,
        provider,
        operation: "create_case",
        payload: { trigger: "case_created" },
        client,
      });
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await syncWorkflowProjection({
    externalCase: createdCase,
    actorUser,
    eventType: "external_case_created",
    payload: {
      provider: createdCase.provider,
      status: createdCase.internal_status,
    },
  });

  if (validationErrors.length === 0) {
    await maybeAutoProcessQueue({ provider, actorUser });
  }

  return {
    ...createdCase,
    validation_errors: validationErrors,
  };
}

async function createInboundExternalCase({
  provider,
  payload = {},
  actorUser = null,
}) {
  const normalizedProvider = normalizeProvider(provider);
  if (!normalizedProvider || !PROVIDERS.includes(normalizedProvider)) {
    throw buildError(`Proveedor no soportado para inbound: ${provider}`, {
      status: 400,
      code: "EXTERNAL_CASE_INBOUND_PROVIDER_INVALID",
    });
  }
  return createExternalCase({
    payload: {
      ...asObject(payload),
      provider: normalizedProvider,
    },
    actorUser,
    sourceChannel: normalizedProvider,
    provider: normalizedProvider,
    strictValidation: false,
  });
}

async function listExternalCasesWorkspace(filters = {}) {
  await ensureSchema();
  const where = [];
  const params = [];
  const pushParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.provider) {
    const provider = normalizeProvider(filters.provider);
    if (provider && PROVIDERS.includes(provider)) {
      where.push(`c.provider = ${pushParam(provider)}`);
    }
  }
  if (filters.status) {
    where.push(`LOWER(COALESCE(c.internal_status, '')) = ${pushParam(normalize(filters.status))}`);
  }
  if (filters.sync_status) {
    const syncStatus = normalize(filters.sync_status);
    if (syncStatus === "error") {
      where.push(`LOWER(COALESCE(c.internal_status, '')) IN ('sync_error', 'blocked')`);
    } else if (syncStatus === "ok") {
      where.push(`LOWER(COALESCE(c.internal_status, '')) NOT IN ('sync_error', 'blocked')`);
    }
  }
  if (filters.only_drift === true || normalize(filters.only_drift) === "true") {
    where.push(`c.state_drift = TRUE`);
  }
  if (filters.q) {
    const term = `%${String(filters.q).trim().toLowerCase()}%`;
    where.push(`
      (
        LOWER(COALESCE(c.code, '')) LIKE ${pushParam(term)}
        OR LOWER(COALESCE(c.client_name, '')) LIKE ${pushParam(term)}
        OR LOWER(COALESCE(c.equipment_serial, '')) LIKE ${pushParam(term)}
        OR LOWER(COALESCE(c.provider_case_reference, '')) LIKE ${pushParam(term)}
        OR LOWER(COALESCE(c.issue_description, '')) LIKE ${pushParam(term)}
      )
    `);
  }

  const safeLimit = clampLimit(filters.limit, DEFAULT_QUERY_LIMIT);
  const query = `
    SELECT
      c.*,
      (
        SELECT COUNT(*)
        FROM servicio.external_case_sync_jobs j
        WHERE j.external_case_id = c.id
          AND j.status IN ('pending', 'retry', 'processing')
      )::int AS pending_sync_jobs,
      (
        SELECT COUNT(*)
        FROM servicio.external_case_sync_jobs j
        WHERE j.external_case_id = c.id
          AND j.status = 'failed'
      )::int AS failed_sync_jobs
    FROM servicio.external_cases c
    ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY c.updated_at DESC
    LIMIT ${pushParam(safeLimit)}
  `;

  const { rows } = await db.query(query, params);
  return rows.map(mapCaseRow);
}

async function getExternalCasesWorkspaceKpi(filters = {}) {
  await ensureSchema();
  const where = [];
  const params = [];
  const pushParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.provider) {
    const provider = normalizeProvider(filters.provider);
    if (provider && PROVIDERS.includes(provider)) {
      where.push(`provider = ${pushParam(provider)}`);
    }
  }

  const { rows } = await db.query(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE internal_status = 'pending_validation')::int AS pending_validation,
        COUNT(*) FILTER (WHERE internal_status IN ('ready_to_sync', 'external_created', 'dispatched', 'travel_started', 'work_in_progress', 'follow_up_pending'))::int AS in_progress,
        COUNT(*) FILTER (WHERE internal_status IN ('finalized', 'closed'))::int AS completed,
        COUNT(*) FILTER (WHERE internal_status IN ('sync_error', 'blocked'))::int AS sync_errors,
        COUNT(*) FILTER (WHERE state_drift = TRUE)::int AS drift_cases,
        COUNT(*) FILTER (WHERE provider = 'navify')::int AS navify_cases,
        COUNT(*) FILTER (WHERE provider = 'online_support')::int AS online_support_cases,
        COUNT(*) FILTER (WHERE provider = 'rexis')::int AS rexis_cases,
        COUNT(*) FILTER (WHERE provider = 'goapp')::int AS goapp_cases
      FROM servicio.external_cases
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    `,
    params,
  );

  return rows[0] || {
    total: 0,
    pending_validation: 0,
    in_progress: 0,
    completed: 0,
    sync_errors: 0,
    drift_cases: 0,
    navify_cases: 0,
    online_support_cases: 0,
    rexis_cases: 0,
    goapp_cases: 0,
  };
}

async function listProviderIdentities(filters = {}) {
  await ensureSchema();
  const where = [];
  const params = [];
  const pushParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.provider) {
    const provider = normalizeProvider(filters.provider);
    if (provider && PROVIDERS.includes(provider)) {
      where.push(`provider = ${pushParam(provider)}`);
    }
  }
  if (filters.status) {
    where.push(`LOWER(COALESCE(status, '')) = ${pushParam(normalize(filters.status))}`);
  }
  if (filters.q) {
    const term = `%${String(filters.q).trim().toLowerCase()}%`;
    where.push(`
      (
        LOWER(COALESCE(client_user_identifier, '')) LIKE ${pushParam(term)}
        OR LOWER(COALESCE(provider_user_identifier, '')) LIKE ${pushParam(term)}
        OR LOWER(COALESCE(area_name, '')) LIKE ${pushParam(term)}
        OR LOWER(COALESCE(laboratory_name, '')) LIKE ${pushParam(term)}
        OR LOWER(COALESCE(equipment_serial, '')) LIKE ${pushParam(term)}
      )
    `);
  }

  const { rows } = await db.query(
    `
      SELECT *
      FROM servicio.external_provider_identities
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY updated_at DESC, id DESC
      LIMIT ${pushParam(clampLimit(filters.limit, 100))}
    `,
    params,
  );
  return rows.map(mapIdentityRow);
}

async function upsertProviderIdentity({
  payload = {},
  actorUser = null,
}) {
  await ensureSchema();
  const source = asObject(payload);
  const provider = normalizeProvider(source.provider);
  if (!provider || !PROVIDERS.includes(provider)) {
    throw buildError("provider inválido para identidad externa", {
      status: 400,
      code: "EXTERNAL_IDENTITY_PROVIDER_INVALID",
    });
  }
  const clientUserIdentifier = normalizeText(
    source.client_user_identifier
    || source.clientUserIdentifier
    || source.client_email
    || source.clientEmail
    || source.client_id
    || source.clientId,
    null,
  );
  if (!clientUserIdentifier) {
    throw buildError("client_user_identifier es obligatorio", {
      status: 400,
      code: "EXTERNAL_IDENTITY_CLIENT_USER_REQUIRED",
    });
  }

  const providerUserIdentifier = normalizeText(
    source.provider_user_identifier
    || source.providerUserIdentifier
    || source.provider_username
    || source.providerUsername,
    null,
  );
  const credentialAlias = normalizeText(
    source.credential_alias
    || source.credentialAlias
    || source.credential_name
    || source.credentialName,
    null,
  );
  const areaName = normalizeText(source.area_name || source.areaName, null);
  const laboratoryName = normalizeText(source.laboratory_name || source.laboratoryName, null);
  const equipmentSerial = normalizeText(source.equipment_serial || source.equipmentSerial, null);
  const status = normalizeText(source.status, "active");
  const metadata = asObject(source.metadata);

  const { rows } = await db.query(
    `
      INSERT INTO servicio.external_provider_identities (
        provider, client_user_identifier, provider_user_identifier, credential_alias,
        area_name, laboratory_name, equipment_serial, status, metadata,
        created_by_user_id, created_by_email, updated_by_user_id, updated_by_email,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$10,$11,now(),now())
      ON CONFLICT (
        provider,
        client_user_identifier,
        COALESCE(equipment_serial, ''),
        COALESCE(area_name, ''),
        COALESCE(laboratory_name, '')
      )
      DO UPDATE
        SET provider_user_identifier = COALESCE(EXCLUDED.provider_user_identifier, servicio.external_provider_identities.provider_user_identifier),
            credential_alias = COALESCE(EXCLUDED.credential_alias, servicio.external_provider_identities.credential_alias),
            status = COALESCE(EXCLUDED.status, servicio.external_provider_identities.status),
            metadata = COALESCE(servicio.external_provider_identities.metadata, '{}'::jsonb) || EXCLUDED.metadata,
            updated_by_user_id = EXCLUDED.updated_by_user_id,
            updated_by_email = EXCLUDED.updated_by_email,
            updated_at = now()
      RETURNING *
    `,
    [
      provider,
      clientUserIdentifier,
      providerUserIdentifier,
      credentialAlias,
      areaName,
      laboratoryName,
      equipmentSerial,
      status,
      json(metadata),
      actorUser?.id || null,
      actorUser?.email || null,
    ],
  );

  return rows[0] ? mapIdentityRow(rows[0]) : null;
}

async function getExternalCaseDetail(caseId) {
  await ensureSchema();
  return ensureCaseExists(normalizeInt(caseId, 0));
}

async function listExternalCaseEvents(caseId) {
  await ensureSchema();
  const id = normalizeInt(caseId, 0);
  await ensureCaseExists(id);
  const { rows } = await db.query(
    `
      SELECT
        e.*,
        u.fullname AS actor_name
      FROM servicio.external_case_events e
      LEFT JOIN public.users u ON u.id = e.actor_user_id
      WHERE e.external_case_id = $1
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT 300
    `,
    [id],
  );
  return rows.map(mapEventRow);
}

async function listProviderHealth() {
  await ensureSchema();
  const { rows } = await db.query(
    `
      SELECT provider,
        COUNT(*) FILTER (WHERE status IN ('pending', 'retry', 'processing'))::int AS pending_jobs,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_jobs
      FROM servicio.external_case_sync_jobs
      GROUP BY provider
    `,
  );
  const queueByProvider = rows.reduce((acc, row) => {
    acc[normalizeProvider(row.provider)] = {
      pending_jobs: normalizeInt(row.pending_jobs, 0) || 0,
      failed_jobs: normalizeInt(row.failed_jobs, 0) || 0,
    };
    return acc;
  }, {});

  return PROVIDERS.map((provider) => {
    const adapter = adapterForProvider(provider);
    const config = getProviderConfig(provider);
    const adapterHealth = adapter?.getHealth ? adapter.getHealth(config) : {
      provider,
      status: "unknown",
      enabled: false,
      contract_approved: false,
      missing_config: [],
      missing_contract_data: ["adapter_not_found"],
      adapter_mode: "missing",
    };
    const queue = queueByProvider[provider] || { pending_jobs: 0, failed_jobs: 0 };
    return {
      provider,
      ...adapterHealth,
      pending_jobs: queue.pending_jobs,
      failed_jobs: queue.failed_jobs,
      feature_flag_key: `ST_EXT_${providerToEnvToken(provider)}_ENABLED`,
    };
  });
}

async function reconcileExternalCaseState({
  caseId,
  actorUser = null,
  comment = null,
}) {
  await ensureSchema();
  const id = normalizeInt(caseId, 0);
  const current = await ensureCaseExists(id);
  const driftDetail = buildStateDriftDetail({
    internalStatus: current.internal_status,
    externalStatus: current.external_status,
  });

  const client = await db.getClient();
  let updatedCase = null;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `
        UPDATE servicio.external_cases
           SET state_drift = $1,
               state_drift_detail = $2::jsonb,
               last_reconciled_at = now(),
               updated_by_user_id = $3,
               updated_by_email = $4,
               updated_at = now()
         WHERE id = $5
         RETURNING *
      `,
      [
        Boolean(driftDetail.drift),
        json(driftDetail),
        actorUser?.id || null,
        actorUser?.email || null,
        id,
      ],
    );
    updatedCase = rows[0] ? mapCaseRow(rows[0]) : current;

    await createEvent(client, {
      externalCaseId: id,
      actorUser,
      eventType: "state_reconciled",
      oldInternalStatus: current.internal_status,
      newInternalStatus: updatedCase.internal_status,
      comment: comment || (driftDetail.drift ? "Se detectó desalineación de estados" : "Estados alineados"),
      payload: driftDetail,
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await syncWorkflowProjection({
    externalCase: updatedCase,
    actorUser,
    eventType: "external_case_reconciled",
    payload: driftDetail,
  });

  return updatedCase;
}

async function retryExternalCaseSync({
  caseId,
  actorUser = null,
  reason = null,
  runImmediately = true,
}) {
  await ensureSchema();
  const id = normalizeInt(caseId, 0);
  const current = await ensureCaseExists(id);
  if (current.internal_status === "pending_validation") {
    throw buildError("No se puede reintentar: el caso tiene datos obligatorios pendientes", {
      status: 409,
      code: "EXTERNAL_CASE_VALIDATION_PENDING",
      details: {
        sync_last_error: current.sync_last_error,
      },
    });
  }

  const config = getProviderConfig(current.provider);
  const adapter = adapterForProvider(current.provider);
  const health = adapter?.getHealth ? adapter.getHealth(config) : null;
  if (!health?.enabled) {
    throw buildError(`Proveedor ${current.provider} deshabilitado por feature flag`, {
      status: 409,
      code: "EXTERNAL_CASE_PROVIDER_DISABLED",
      retryable: false,
    });
  }

  await enqueueSyncJob({
    externalCaseId: id,
    provider: current.provider,
    operation: "sync_case",
    payload: {
      trigger: "manual_retry",
      reason: normalizeText(reason, null),
    },
  });

  const client = await db.getClient();
  let updatedCase = null;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `
        UPDATE servicio.external_cases
           SET sync_retryable = TRUE,
               next_sync_retry_at = now(),
               updated_by_user_id = $1,
               updated_by_email = $2,
               updated_at = now()
         WHERE id = $3
         RETURNING *
      `,
      [actorUser?.id || null, actorUser?.email || null, id],
    );
    updatedCase = rows[0] ? mapCaseRow(rows[0]) : current;

    await createEvent(client, {
      externalCaseId: id,
      actorUser,
      eventType: "sync_retry_requested",
      oldInternalStatus: current.internal_status,
      newInternalStatus: updatedCase.internal_status,
      comment: normalizeText(reason, "Reintento manual solicitado"),
      payload: {
        reason: normalizeText(reason, null),
      },
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (runImmediately) {
    await processPendingSyncJobs({
      limit: 1,
      actorUser,
      workerId: "manual-retry",
    });
  }

  return getExternalCaseDetail(id);
}

const normalizeGoappMilestone = (value) => {
  const normalized = normalize(value).replace(/[\s-]+/g, "_");
  if (normalized === "accept") return "accept_work_order";
  if (normalized === "accept_wo") return "accept_work_order";
  if (normalized === "starttravel") return "start_travel";
  if (normalized === "worktime") return "work_time";
  if (normalized === "finalize") return "finalize_work_order";
  if (normalized === "followup") return "follow_up_appointment";
  return normalized;
};

const validateFinalizeRequirements = ({ caseRow, mergedPayload, goappMilestones, payload = {} }) => {
  const missing = [];
  const workMilestone = asObject(goappMilestones.work_time);
  const workPayload = asObject(workMilestone.payload);
  const timeTracking = {
    ...asObject(mergedPayload.time_tracking),
    ...asObject(workPayload),
    ...asObject(payload.time_tracking),
  };
  const hasTimes =
    (normalizeInt(timeTracking.work_minutes, 0) > 0 || normalizeInt(timeTracking.travel_minutes, 0) > 0)
    || (normalizeDateTime(timeTracking.work_start_at) && normalizeDateTime(timeTracking.work_end_at));
  if (!hasTimes) missing.push("time_tracking");

  const partsUsed = normalizePartsUsed(
    payload.parts_used
    || payload.partsUsed
    || mergedPayload.parts_used
    || caseRow.normalized_payload?.parts_used,
  );
  if (!partsUsed.length) missing.push("parts_used");

  const technicalReport = {
    ...asObject(mergedPayload.technical_report),
    ...asObject(payload.technical_report),
  };
  if (!normalizeText(technicalReport.problem_description || caseRow.issue_description)) {
    missing.push("problem_description");
  }
  if (!normalizeText(technicalReport.solution_applied)) {
    missing.push("solution_applied");
  }
  if (!normalizeText(technicalReport.client_communication)) {
    missing.push("client_communication");
  }

  const productAffectedRequired =
    isTrue(payload.product_affected_required, isTrue(mergedPayload.product_affected_required, false));
  const productAffected = normalizeText(payload.product_affected || mergedPayload.product_affected, null);
  if (productAffectedRequired && !productAffected) {
    missing.push("product_affected");
  }

  if (!normalizeText(technicalReport.client_signature)) {
    missing.push("client_signature");
  }
  if (!normalizeText(technicalReport.service_signature)) {
    missing.push("service_signature");
  }

  return missing;
};

async function recordGoAppMilestone({
  caseId,
  milestone,
  payload = {},
  actorUser = null,
}) {
  await ensureSchema();
  const id = normalizeInt(caseId, 0);
  const current = await ensureCaseExists(id);
  if (normalizeProvider(current.provider) !== "goapp") {
    throw buildError("Los hitos GoApp solo aplican a casos del proveedor goapp", {
      status: 400,
      code: "EXTERNAL_CASE_PROVIDER_NOT_GOAPP",
    });
  }

  const normalizedMilestone = normalizeGoappMilestone(milestone);
  if (!GOAPP_MILESTONES.includes(normalizedMilestone)) {
    throw buildError(`Hito GoApp inválido: ${milestone}`, {
      status: 400,
      code: "GOAPP_MILESTONE_INVALID",
    });
  }

  const precondition = GOAPP_MILESTONE_PRECONDITIONS[normalizedMilestone];
  const existingMilestones = asObject(current.goapp_milestones);
  if (precondition && !asObject(existingMilestones[precondition]).at) {
    throw buildError(`Debes registrar ${precondition} antes de ${normalizedMilestone}`, {
      status: 409,
      code: "GOAPP_MILESTONE_SEQUENCE_INVALID",
    });
  }

  const safePayload = asObject(payload);
  const mergedPayload = {
    ...asObject(current.normalized_payload),
    ...safePayload,
    technical_report: {
      ...asObject(current.normalized_payload?.technical_report),
      ...asObject(safePayload.technical_report),
    },
    time_tracking: {
      ...asObject(current.normalized_payload?.time_tracking),
      ...asObject(safePayload.time_tracking),
    },
  };

  const nextMilestones = {
    ...existingMilestones,
    [normalizedMilestone]: {
      at: normalizeDateTime(safePayload.at, new Date().toISOString()),
      actor_user_id: actorUser?.id || null,
      actor_email: actorUser?.email || null,
      payload: safePayload,
    },
  };

  if (normalizedMilestone === "finalize_work_order") {
    const missing = validateFinalizeRequirements({
      caseRow: current,
      mergedPayload,
      goappMilestones: nextMilestones,
      payload: safePayload,
    });
    if (missing.length > 0) {
      throw buildError(
        `No se puede finalizar Work Order. Faltan datos: ${missing.join(", ")}`,
        {
          status: 400,
          code: "GOAPP_FINALIZE_REQUIREMENTS_MISSING",
          details: { missing_fields: missing },
        },
      );
    }
  }

  const nextInternalStatus = resolveInternalStatusAfterSync({
    currentStatus: current.internal_status,
    operation: normalizedMilestone,
  });

  const client = await db.getClient();
  let updatedCase = null;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `
        UPDATE servicio.external_cases
           SET goapp_milestones = $1::jsonb,
               normalized_payload = $2::jsonb,
               internal_status = $3,
               updated_by_user_id = $4,
               updated_by_email = $5,
               updated_at = now()
         WHERE id = $6
         RETURNING *
      `,
      [
        json(nextMilestones),
        json(mergedPayload),
        nextInternalStatus,
        actorUser?.id || null,
        actorUser?.email || null,
        id,
      ],
    );
    updatedCase = rows[0] ? mapCaseRow(rows[0]) : current;

    await createEvent(client, {
      externalCaseId: id,
      actorUser,
      eventType: "goapp_milestone",
      oldInternalStatus: current.internal_status,
      newInternalStatus: updatedCase.internal_status,
      comment: `Hito GoApp: ${normalizedMilestone}`,
      payload: {
        milestone: normalizedMilestone,
        payload: safePayload,
      },
    });

    await enqueueSyncJob({
      externalCaseId: id,
      provider: current.provider,
      operation: normalizedMilestone,
      payload: safePayload,
      client,
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await syncWorkflowProjection({
    externalCase: updatedCase,
    actorUser,
    eventType: "goapp_milestone_registered",
    payload: { milestone: normalizedMilestone },
  });
  await maybeAutoProcessQueue({ provider: updatedCase.provider, actorUser });
  return getExternalCaseDetail(id);
}

const normalizeCeacDecision = (value) => {
  const normalized = normalize(value).replace(/[\s-]+/g, "_");
  if (normalized === "resolve_remote") return "resolve_first_level";
  if (normalized === "close_remote") return "resolve_first_level";
  if (normalized === "escalate_dispatch") return "escalate_field_visit";
  return normalized;
};

async function applyCeacDecision({
  caseId,
  decision,
  notes = null,
  actorUser = null,
}) {
  await ensureSchema();
  const id = normalizeInt(caseId, 0);
  const current = await ensureCaseExists(id);
  const normalizedDecision = normalizeCeacDecision(decision);
  if (!["resolve_first_level", "escalate_field_visit"].includes(normalizedDecision)) {
    throw buildError(`decision inválida: ${decision}`, {
      status: 400,
      code: "EXTERNAL_CASE_CEAC_DECISION_INVALID",
    });
  }

  const nextInternalStatus =
    normalizedDecision === "resolve_first_level"
      ? "closed"
      : "dispatched";
  const operation =
    normalizedDecision === "resolve_first_level"
      ? "finalize_work_order"
      : "escalate_dispatch";

  const normalizedPayload = {
    ...asObject(current.normalized_payload),
    ceac: {
      decision: normalizedDecision,
      notes: normalizeText(notes, null),
      decided_at: new Date().toISOString(),
      decided_by_user_id: actorUser?.id || null,
      decided_by_email: actorUser?.email || null,
    },
  };

  const client = await db.getClient();
  let updatedCase = null;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `
        UPDATE servicio.external_cases
           SET internal_status = $1,
               normalized_payload = $2::jsonb,
               updated_by_user_id = $3,
               updated_by_email = $4,
               updated_at = now()
         WHERE id = $5
         RETURNING *
      `,
      [
        nextInternalStatus,
        json(normalizedPayload),
        actorUser?.id || null,
        actorUser?.email || null,
        id,
      ],
    );
    updatedCase = rows[0] ? mapCaseRow(rows[0]) : current;

    await createEvent(client, {
      externalCaseId: id,
      actorUser,
      eventType: "ceac_decision",
      oldInternalStatus: current.internal_status,
      newInternalStatus: updatedCase.internal_status,
      comment: normalizeText(notes, null),
      payload: { decision: normalizedDecision },
    });

    await enqueueSyncJob({
      externalCaseId: id,
      provider: current.provider,
      operation,
      payload: {
        ceac_decision: normalizedDecision,
        notes: normalizeText(notes, null),
      },
      client,
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (normalizedDecision === "escalate_field_visit") {
    try {
      const dispatcherUsers = await getUsersByRoles(DISPATCH_ROLES);
      await notifyUsers({
        users: dispatcherUsers,
        title: "Nuevo caso externo escalado a visita",
        message: `Caso ${updatedCase.code} requiere dispatch en campo`,
        source: "servicio.external_cases.dispatch",
        priority: 2,
        meta: {
          external_case_id: updatedCase.id,
          code: updatedCase.code,
          provider: updatedCase.provider,
          client_name: updatedCase.client_name || null,
          equipment_serial: updatedCase.equipment_serial || null,
          decision: normalizedDecision,
        },
      });
    } catch (notifyError) {
      logger.warn(
        { notifyError: notifyError?.message || String(notifyError), caseId: updatedCase.id },
        "[EXTERNAL_CASES] No se pudo notificar a dispatcher por escalamiento",
      );
    }
  }

  await syncWorkflowProjection({
    externalCase: updatedCase,
    actorUser,
    eventType: "ceac_decision_registered",
    payload: {
      decision: normalizedDecision,
    },
  });
  await maybeAutoProcessQueue({ provider: updatedCase.provider, actorUser });
  return getExternalCaseDetail(id);
}

async function processSyncJob(job, { actorUser = null } = {}) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const { rows: caseRows } = await client.query(
      `SELECT * FROM servicio.external_cases WHERE id = $1 FOR UPDATE`,
      [job.external_case_id],
    );
    if (!caseRows[0]) {
      await client.query(
        `
          UPDATE servicio.external_case_sync_jobs
             SET status = 'failed',
                 last_error = 'Caso externo no encontrado',
                 last_error_code = 'EXTERNAL_CASE_NOT_FOUND',
                 completed_at = now(),
                 updated_at = now()
           WHERE id = $1
        `,
        [job.id],
      );
      await client.query("COMMIT");
      return { status: "failed", reason: "case_not_found" };
    }

    const current = mapCaseRow(caseRows[0]);
    const adapter = adapterForProvider(job.provider);
    if (!adapter) {
      throw buildError(`No existe adapter para provider ${job.provider}`, {
        status: 500,
        code: "EXTERNAL_CASE_ADAPTER_NOT_FOUND",
        retryable: false,
      });
    }
    const providerConfig = getProviderConfig(job.provider);

    try {
      const syncResult = await adapter.syncCase({
        externalCase: current,
        operation: job.operation,
        payload: job.payload,
        config: providerConfig,
      });

      const nextInternalStatus = resolveInternalStatusAfterSync({
        currentStatus: current.internal_status,
        operation: job.operation,
      });
      const driftDetail = buildStateDriftDetail({
        internalStatus: nextInternalStatus,
        externalStatus: syncResult.external_status,
      });

      const { rows: updatedRows } = await client.query(
        `
          UPDATE servicio.external_cases
             SET internal_status = $1,
                 external_status = COALESCE($2, external_status),
                 provider_case_reference = COALESCE($3, provider_case_reference),
                 sync_attempts = sync_attempts + 1,
                 sync_last_error = NULL,
                 sync_last_error_code = NULL,
                 sync_last_error_at = NULL,
                 sync_retryable = TRUE,
                 last_sync_at = now(),
                 next_sync_retry_at = NULL,
                 state_drift = $4,
                 state_drift_detail = $5::jsonb,
                 last_reconciled_at = now(),
                 updated_by_user_id = $6,
                 updated_by_email = $7,
                 updated_at = now()
           WHERE id = $8
           RETURNING *
        `,
        [
          nextInternalStatus,
          normalizeText(syncResult.external_status, null),
          normalizeText(syncResult.provider_case_reference, null),
          Boolean(driftDetail.drift),
          json(driftDetail),
          actorUser?.id || null,
          actorUser?.email || null,
          current.id,
        ],
      );
      const updatedCase = updatedRows[0] ? mapCaseRow(updatedRows[0]) : current;

      await client.query(
        `
          UPDATE servicio.external_case_sync_jobs
             SET status = 'completed',
                 completed_at = now(),
                 last_error = NULL,
                 last_error_code = NULL,
                 last_error_payload = '{}'::jsonb,
                 updated_at = now()
           WHERE id = $1
        `,
        [job.id],
      );

      await createEvent(client, {
        externalCaseId: current.id,
        actorUser,
        eventType: "sync_success",
        oldInternalStatus: current.internal_status,
        newInternalStatus: updatedCase.internal_status,
        comment: `Sync ${job.operation} completado`,
        payload: {
          sync_job_id: job.id,
          operation: job.operation,
          provider_response: syncResult,
        },
      });

      await client.query("COMMIT");
      await syncWorkflowProjection({
        externalCase: updatedCase,
        actorUser,
        eventType: "external_sync_success",
        payload: {
          operation: job.operation,
          sync_job_id: job.id,
        },
      });
      return { status: "completed", case: updatedCase };
    } catch (syncError) {
      const retryable = syncError?.retryable !== false;
      const canRetry = retryable && job.attempts < job.max_attempts;
      const nextRetryAt = canRetry ? new Date(Date.now() + computeBackoffMs(job.attempts)).toISOString() : null;
      const nextInternalStatus = canRetry ? "sync_error" : "blocked";
      const driftDetail = buildStateDriftDetail({
        internalStatus: nextInternalStatus,
        externalStatus: current.external_status,
      });

      const { rows: updatedRows } = await client.query(
        `
          UPDATE servicio.external_cases
             SET internal_status = $1,
                 sync_attempts = sync_attempts + 1,
                 sync_last_error = $2,
                 sync_last_error_code = $3,
                 sync_last_error_at = now(),
                 sync_retryable = $4,
                 next_sync_retry_at = $5::timestamptz,
                 state_drift = $6,
                 state_drift_detail = $7::jsonb,
                 last_reconciled_at = now(),
                 updated_by_user_id = $8,
                 updated_by_email = $9,
                 updated_at = now()
           WHERE id = $10
           RETURNING *
        `,
        [
          nextInternalStatus,
          syncError?.message || "Error de sincronización",
          syncError?.code || "EXTERNAL_SYNC_ERROR",
          canRetry,
          nextRetryAt,
          Boolean(driftDetail.drift),
          json(driftDetail),
          actorUser?.id || null,
          actorUser?.email || null,
          current.id,
        ],
      );
      const updatedCase = updatedRows[0] ? mapCaseRow(updatedRows[0]) : current;

      await client.query(
        `
          UPDATE servicio.external_case_sync_jobs
             SET status = $1,
                 next_attempt_at = COALESCE($2::timestamptz, next_attempt_at),
                 last_error = $3,
                 last_error_code = $4,
                 last_error_payload = $5::jsonb,
                 completed_at = CASE WHEN $1 = 'failed' THEN now() ELSE NULL END,
                 updated_at = now()
           WHERE id = $6
        `,
        [
          canRetry ? "retry" : "failed",
          nextRetryAt,
          syncError?.message || "Error de sincronización",
          syncError?.code || "EXTERNAL_SYNC_ERROR",
          json(syncError?.details || {}),
          job.id,
        ],
      );

      await createEvent(client, {
        externalCaseId: current.id,
        actorUser,
        eventType: "sync_failed",
        oldInternalStatus: current.internal_status,
        newInternalStatus: updatedCase.internal_status,
        comment: syncError?.message || "Error de sincronización",
        payload: {
          sync_job_id: job.id,
          operation: job.operation,
          retryable: canRetry,
          next_retry_at: nextRetryAt,
          error_code: syncError?.code || "EXTERNAL_SYNC_ERROR",
          error_details: syncError?.details || null,
        },
      });

      await client.query("COMMIT");
      await syncWorkflowProjection({
        externalCase: updatedCase,
        actorUser,
        eventType: "external_sync_failed",
        payload: {
          operation: job.operation,
          sync_job_id: job.id,
          error_code: syncError?.code || "EXTERNAL_SYNC_ERROR",
        },
      });
      return { status: canRetry ? "retry" : "failed", case: updatedCase, error: syncError };
    }
  } catch (fatalError) {
    await client.query("ROLLBACK");
    logger.error(
      {
        error: fatalError?.message || String(fatalError),
        sync_job_id: job?.id,
        external_case_id: job?.external_case_id,
      },
      "[EXTERNAL_CASES] Error fatal procesando job de sincronización",
    );
    return { status: "fatal", error: fatalError };
  } finally {
    client.release();
  }
}

async function processPendingSyncJobs({
  limit = DEFAULT_SYNC_BATCH_LIMIT,
  actorUser = null,
  workerId = "external-case-sync",
} = {}) {
  await ensureSchema();
  const claimedJobs = await claimSyncJobs({ limit, workerId });
  const summary = {
    requested_limit: clampLimit(limit, DEFAULT_SYNC_BATCH_LIMIT),
    claimed: claimedJobs.length,
    completed: 0,
    retry: 0,
    failed: 0,
    fatal: 0,
  };

  for (const job of claimedJobs) {
    const outcome = await processSyncJob(job, { actorUser });
    if (outcome.status === "completed") summary.completed += 1;
    else if (outcome.status === "retry") summary.retry += 1;
    else if (outcome.status === "failed") summary.failed += 1;
    else summary.fatal += 1;
  }

  return summary;
}

async function applyGoAppFollowUp({
  caseId,
  followUpDate,
  notes = null,
  actorUser = null,
}) {
  return recordGoAppMilestone({
    caseId,
    milestone: "follow_up_appointment",
    actorUser,
    payload: {
      follow_up_required: true,
      follow_up_date: followUpDate,
      follow_up_notes: notes,
      follow_up: {
        required: true,
        date: followUpDate,
        notes: normalizeText(notes, null),
      },
      at: new Date().toISOString(),
    },
  });
}

module.exports = {
  PROVIDERS,
  GOAPP_MILESTONES,
  ensureSchema,
  createExternalCase,
  createInboundExternalCase,
  listExternalCasesWorkspace,
  getExternalCasesWorkspaceKpi,
  listProviderIdentities,
  upsertProviderIdentity,
  getExternalCaseDetail,
  listExternalCaseEvents,
  listProviderHealth,
  processPendingSyncJobs,
  retryExternalCaseSync,
  reconcileExternalCaseState,
  applyCeacDecision,
  recordGoAppMilestone,
  applyGoAppFollowUp,
  enqueueSyncJob,
  getProviderConfig,
};
