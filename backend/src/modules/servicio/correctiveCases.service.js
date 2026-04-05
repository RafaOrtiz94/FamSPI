const db = require("../../config/db");
const {
  CASE_STATUS,
  INITIAL_STATUS,
  normalizeStatus,
  statusFromClassification,
  assertTransition,
} = require("./correctiveStateMachine.service");
const {
  CEAC_ROLES,
  DISPATCH_ROLES,
  COMMERCIAL_ROLES,
  TECH_SPECIALIST_ROLES,
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
} = require("./ceacDispatch.service");
const {
  ensureCorrectiveSparePartsTable,
  listCaseSpareParts,
  createSparePartRequest,
  requestCommercialQuote,
  issueCommercialQuote,
  recordClientDecision,
  markPartInstalled,
} = require("./sparePartsQuotation.service");
const { upsertWorkflow } = require("./workflowRegistry.service");
const { appendWorkflowAuditEvent } = require("./workflowAudit.service");

const PROCEDURE_CODE = "ST-01-03";
const WORKFLOW_SOURCE_TYPE = "corrective_case";

const COMMENT_VISIBILITY = new Set(["public", "internal"]);
const ACTIONS = new Set([
  "ceac_diagnosis",
  "resolve_remote",
  "escalate_dispatch",
  "classify_case",
  "register_dispatch_milestone",
  "register_spare_part_requirement",
  "request_commercial_quote",
  "issue_commercial_quote",
  "record_client_quote_decision",
  "schedule_revisit",
  "record_part_replacement",
  "link_disinfection_fst02",
  "add_evidence",
  "close_case",
  "cancel_case",
]);

const normalize = (value) => String(value || "").trim().toLowerCase();
const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

const normalizeInt = (value, fallback = null) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeDateTime = (value, fallback = null) => {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString();
};

const safeJson = (value, fallback = {}) => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch (_error) {
      return fallback;
    }
  }
  return fallback;
};

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeRoleList = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalize).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map(normalize)
    .filter(Boolean);
};

const getActorRoleSet = (user = {}) =>
  new Set([
    ...normalizeRoleList(user.role),
    ...normalizeRoleList(user.scope),
    ...normalizeRoleList(user.role_name),
    ...normalizeRoleList(user.roles),
    ...normalizeRoleList(user.scopes),
  ]);

const isCorrectiveWorkspaceUser = (user = {}) => {
  const roles = getActorRoleSet(user);
  const allowed = new Set([
    ...CEAC_ROLES,
    ...DISPATCH_ROLES,
    ...COMMERCIAL_ROLES,
    ...TECH_SPECIALIST_ROLES,
    "gerencia",
    "gerencia_general",
    "admin",
    "administrador",
  ]);
  return Array.from(roles).some((role) => allowed.has(role));
};

const hasOwnerAccess = (caseRow, user = {}) => Number(caseRow?.requester_user_id) === Number(user?.id);

const assertCaseAccess = (caseRow, user, { requireWorkspaceRole = false } = {}) => {
  const workspaceUser = isCorrectiveWorkspaceUser(user);
  const owner = hasOwnerAccess(caseRow, user);
  if (owner || workspaceUser) {
    if (requireWorkspaceRole && !workspaceUser) {
      const error = new Error("No autorizado");
      error.status = 403;
      error.code = "CORRECTIVE_CASE_FORBIDDEN";
      throw error;
    }
    return;
  }
  const error = new Error("No autorizado");
  error.status = 403;
  error.code = "CORRECTIVE_CASE_FORBIDDEN";
  throw error;
};

const buildError = (
  message,
  { status = 400, code = "CORRECTIVE_CASE_ERROR", details = null } = {},
) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details && typeof details === "object") error.details = details;
  return error;
};

const ensureWorkflowDocumentsTable = async () => {
  await db.query("CREATE SCHEMA IF NOT EXISTS servicio");
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.workflow_documents (
      id BIGSERIAL PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      document_code TEXT NOT NULL,
      stage_key TEXT,
      drive_file_id TEXT,
      drive_folder_id TEXT,
      request_id INTEGER,
      created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_by_email TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
};

const ensureCorrectiveCaseTables = async () => {
  await db.query("CREATE SCHEMA IF NOT EXISTS servicio");
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.corrective_cases (
      id BIGSERIAL PRIMARY KEY,
      code VARCHAR(24) UNIQUE,
      requester_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
      requester_email TEXT,
      requester_name TEXT,
      source_type TEXT NOT NULL DEFAULT '${WORKFLOW_SOURCE_TYPE}',
      source_id TEXT,
      linked_source_type TEXT,
      linked_source_id TEXT,
      linked_request_id INTEGER,
      entry_channel TEXT NOT NULL DEFAULT 'ceac',
      ceac_exception_authorized BOOLEAN NOT NULL DEFAULT FALSE,
      ceac_exception_reason TEXT,
      client_name TEXT,
      client_segment TEXT NOT NULL DEFAULT 'C',
      equipment_name TEXT,
      equipment_serial TEXT,
      priority TEXT NOT NULL DEFAULT 'media',
      status TEXT NOT NULL DEFAULT '${INITIAL_STATUS}',
      classification TEXT,
      problem_summary TEXT NOT NULL,
      problem_detail TEXT NOT NULL,
      root_cause TEXT,
      technical_basis TEXT,
      assigned_specialist_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      assigned_specialist_role TEXT,
      dispatcher_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      dispatcher_notes TEXT,
      work_order_number TEXT,
      provider_name TEXT,
      provider_case_reference TEXT,
      external_routed_at TIMESTAMPTZ,
      requires_site_visit BOOLEAN NOT NULL DEFAULT FALSE,
      requires_part_change BOOLEAN NOT NULL DEFAULT FALSE,
      requires_disinfection BOOLEAN NOT NULL DEFAULT FALSE,
      disinfection_document_file_id TEXT,
      disinfection_completed_at TIMESTAMPTZ,
      ceac_closed_remotely BOOLEAN NOT NULL DEFAULT FALSE,
      ceac_resolution_notes TEXT,
      first_response_at TIMESTAMPTZ,
      first_response_due_at TIMESTAMPTZ,
      resolution_due_at TIMESTAMPTZ,
      sla_response_breached BOOLEAN NOT NULL DEFAULT FALSE,
      sla_resolution_breached BOOLEAN NOT NULL DEFAULT FALSE,
      scheduled_visit_at TIMESTAMPTZ,
      attended_at TIMESTAMPTZ,
      result_summary TEXT,
      close_reason TEXT,
      closed_at TIMESTAMPTZ,
      closed_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_corrective_cases_status
      ON servicio.corrective_cases (status, priority, updated_at DESC)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_corrective_cases_source
      ON servicio.corrective_cases (source_type, source_id, created_at DESC)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_corrective_cases_linked_source
      ON servicio.corrective_cases (linked_source_type, linked_source_id, updated_at DESC)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_corrective_cases_requester
      ON servicio.corrective_cases (requester_user_id, created_at DESC)
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.corrective_case_events (
      id BIGSERIAL PRIMARY KEY,
      case_id BIGINT NOT NULL REFERENCES servicio.corrective_cases(id) ON DELETE CASCADE,
      actor_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      actor_email TEXT,
      event_type TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      comment TEXT,
      event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_corrective_case_events_case
      ON servicio.corrective_case_events (case_id, created_at DESC)
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.corrective_case_comments (
      id BIGSERIAL PRIMARY KEY,
      case_id BIGINT NOT NULL REFERENCES servicio.corrective_cases(id) ON DELETE CASCADE,
      author_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      author_email TEXT,
      visibility TEXT NOT NULL DEFAULT 'public',
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_corrective_case_comments_case
      ON servicio.corrective_case_comments (case_id, created_at DESC)
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.corrective_case_evidences (
      id BIGSERIAL PRIMARY KEY,
      case_id BIGINT NOT NULL REFERENCES servicio.corrective_cases(id) ON DELETE CASCADE,
      actor_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      actor_email TEXT,
      evidence_type TEXT NOT NULL DEFAULT 'url',
      evidence_ref TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_corrective_case_evidences_case
      ON servicio.corrective_case_evidences (case_id, created_at DESC)
  `);

  await ensureCorrectiveSparePartsTable();
};

const mapCaseRow = (row) => ({
  id: Number(row.id),
  code: row.code,
  requester_user_id: Number(row.requester_user_id),
  requester_name: row.requester_name || null,
  requester_email: row.requester_email || null,
  source_type: row.source_type,
  source_id: row.source_id || null,
  linked_source_type: row.linked_source_type || null,
  linked_source_id: row.linked_source_id || null,
  linked_request_id: row.linked_request_id ? Number(row.linked_request_id) : null,
  entry_channel: row.entry_channel || "ceac",
  ceac_exception_authorized: Boolean(row.ceac_exception_authorized),
  ceac_exception_reason: row.ceac_exception_reason || null,
  client_name: row.client_name || null,
  client_segment: row.client_segment || "C",
  equipment_name: row.equipment_name || null,
  equipment_serial: row.equipment_serial || null,
  priority: row.priority || "media",
  status: row.status,
  classification: row.classification || null,
  problem_summary: row.problem_summary,
  problem_detail: row.problem_detail,
  root_cause: row.root_cause || null,
  technical_basis: row.technical_basis || null,
  assigned_specialist_user_id: toNumber(row.assigned_specialist_user_id),
  assigned_specialist_name: row.assigned_specialist_name || null,
  assigned_specialist_email: row.assigned_specialist_email || null,
  assigned_specialist_role: row.assigned_specialist_role || null,
  dispatcher_user_id: toNumber(row.dispatcher_user_id),
  dispatcher_name: row.dispatcher_name || null,
  dispatcher_email: row.dispatcher_email || null,
  dispatcher_notes: row.dispatcher_notes || null,
  work_order_number: row.work_order_number || null,
  provider_name: row.provider_name || null,
  provider_case_reference: row.provider_case_reference || null,
  external_routed_at: row.external_routed_at || null,
  requires_site_visit: Boolean(row.requires_site_visit),
  requires_part_change: Boolean(row.requires_part_change),
  requires_disinfection: Boolean(row.requires_disinfection),
  disinfection_document_file_id: row.disinfection_document_file_id || null,
  disinfection_completed_at: row.disinfection_completed_at || null,
  ceac_closed_remotely: Boolean(row.ceac_closed_remotely),
  ceac_resolution_notes: row.ceac_resolution_notes || null,
  first_response_at: row.first_response_at || null,
  first_response_due_at: row.first_response_due_at || null,
  resolution_due_at: row.resolution_due_at || null,
  sla_response_breached: Boolean(row.sla_response_breached),
  sla_resolution_breached: Boolean(row.sla_resolution_breached),
  scheduled_visit_at: row.scheduled_visit_at || null,
  attended_at: row.attended_at || null,
  result_summary: row.result_summary || null,
  close_reason: row.close_reason || null,
  closed_at: row.closed_at || null,
  closed_by_user_id: toNumber(row.closed_by_user_id),
  response_minutes: toNumber(row.response_minutes),
  cycle_minutes: toNumber(row.cycle_minutes),
  comments_count: toNumber(row.comments_count) || 0,
  events_count: toNumber(row.events_count) || 0,
  spare_parts_count: toNumber(row.spare_parts_count) || 0,
  pending_quote_parts_count: toNumber(row.pending_quote_parts_count) || 0,
  metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapEventRow = (row) => ({
  id: Number(row.id),
  case_id: Number(row.case_id),
  actor_user_id: toNumber(row.actor_user_id),
  actor_email: row.actor_email || null,
  actor_name: row.actor_name || null,
  event_type: row.event_type,
  old_status: row.old_status || null,
  new_status: row.new_status || null,
  comment: row.comment || null,
  event_payload: row.event_payload && typeof row.event_payload === "object" ? row.event_payload : {},
  created_at: row.created_at,
});

const mapCommentRow = (row) => ({
  id: Number(row.id),
  case_id: Number(row.case_id),
  author_user_id: toNumber(row.author_user_id),
  author_email: row.author_email || null,
  author_name: row.author_name || null,
  visibility: row.visibility || "public",
  message: row.message,
  created_at: row.created_at,
});

const mapEvidenceRow = (row) => ({
  id: Number(row.id),
  case_id: Number(row.case_id),
  actor_user_id: toNumber(row.actor_user_id),
  actor_email: row.actor_email || null,
  actor_name: row.actor_name || null,
  evidence_type: row.evidence_type || "url",
  evidence_ref: row.evidence_ref,
  note: row.note || null,
  created_at: row.created_at,
});

const createEvent = async (client, {
  caseId,
  actorUser = null,
  eventType,
  oldStatus = null,
  newStatus = null,
  comment = null,
  payload = {},
}) => {
  const { rows } = await client.query(
    `
      INSERT INTO servicio.corrective_case_events (
        case_id, actor_user_id, actor_email, event_type, old_status, new_status, comment, event_payload, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,now())
      RETURNING *
    `,
    [
      caseId,
      actorUser?.id || null,
      actorUser?.email || null,
      normalizeText(eventType),
      normalizeText(oldStatus),
      normalizeText(newStatus),
      normalizeText(comment),
      JSON.stringify(payload && typeof payload === "object" ? payload : {}),
    ],
  );
  return rows[0];
};

const getCaseBase = async (client, caseId) => {
  const { rows } = await client.query(
    "SELECT * FROM servicio.corrective_cases WHERE id = $1 LIMIT 1",
    [caseId],
  );
  if (!rows.length) {
    throw buildError("Caso correctivo no encontrado", {
      status: 404,
      code: "CORRECTIVE_CASE_NOT_FOUND",
    });
  }
  return rows[0];
};

const WORKSPACE_SELECT = `
  SELECT
    c.*,
    rq.fullname AS requester_name,
    rq.email AS requester_email,
    ass.fullname AS assigned_specialist_name,
    ass.email AS assigned_specialist_email,
    dsp.fullname AS dispatcher_name,
    dsp.email AS dispatcher_email,
    COALESCE(cm.comments_count, 0)::int AS comments_count,
    COALESCE(ev.events_count, 0)::int AS events_count,
    COALESCE(sp.spare_parts_count, 0)::int AS spare_parts_count,
    COALESCE(sp.pending_quote_parts_count, 0)::int AS pending_quote_parts_count,
    CASE
      WHEN c.first_response_at IS NULL THEN NULL
      ELSE ROUND(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at)) / 60.0, 2)
    END AS response_minutes,
    CASE
      WHEN c.closed_at IS NULL THEN NULL
      ELSE ROUND(EXTRACT(EPOCH FROM (c.closed_at - c.created_at)) / 60.0, 2)
    END AS cycle_minutes
  FROM servicio.corrective_cases c
  JOIN public.users rq ON rq.id = c.requester_user_id
  LEFT JOIN public.users ass ON ass.id = c.assigned_specialist_user_id
  LEFT JOIN public.users dsp ON dsp.id = c.dispatcher_user_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS comments_count
    FROM servicio.corrective_case_comments cm
    WHERE cm.case_id = c.id
  ) cm ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS events_count
    FROM servicio.corrective_case_events ev
    WHERE ev.case_id = c.id
  ) ev ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS spare_parts_count,
      COUNT(*) FILTER (
        WHERE sp.quotation_status IN ('requested', 'issued')
      ) AS pending_quote_parts_count
    FROM servicio.corrective_case_spare_parts sp
    WHERE sp.case_id = c.id
  ) sp ON TRUE
`;

const buildWorkspaceFilters = ({ actorUser, status, classification, q, onlyMine = false }) => {
  const filters = [];
  const values = [];

  if (status) {
    values.push(normalizeStatus(status));
    filters.push(`c.status = $${values.length}`);
  }

  if (classification) {
    values.push(normalize(classification));
    filters.push(`LOWER(COALESCE(c.classification, '')) = $${values.length}`);
  }

  if (q && String(q).trim()) {
    values.push(`%${String(q).trim()}%`);
    filters.push(`(
      c.code ILIKE $${values.length}
      OR c.problem_summary ILIKE $${values.length}
      OR c.client_name ILIKE $${values.length}
      OR c.equipment_name ILIKE $${values.length}
      OR rq.fullname ILIKE $${values.length}
    )`);
  }

  const workspaceUser = isCorrectiveWorkspaceUser(actorUser);
  if (onlyMine || !workspaceUser) {
    values.push(Number(actorUser.id));
    filters.push(`c.requester_user_id = $${values.length}`);
  }

  return {
    whereClause: filters.length ? `WHERE ${filters.join(" AND ")}` : "",
    values,
  };
};

const recalcSlaFlags = async (client, caseId) => {
  await client.query(
    `
      UPDATE servicio.corrective_cases
      SET
        sla_response_breached = CASE
          WHEN first_response_due_at IS NULL THEN FALSE
          WHEN first_response_at IS NOT NULL AND first_response_at > first_response_due_at THEN TRUE
          WHEN first_response_at IS NULL AND now() > first_response_due_at THEN TRUE
          ELSE sla_response_breached
        END,
        sla_resolution_breached = CASE
          WHEN resolution_due_at IS NULL THEN FALSE
          WHEN closed_at IS NOT NULL AND closed_at > resolution_due_at THEN TRUE
          WHEN closed_at IS NULL AND now() > resolution_due_at THEN TRUE
          ELSE sla_resolution_breached
        END,
        updated_at = now()
      WHERE id = $1
    `,
    [caseId],
  );
};

const CASE_UPDATABLE_FIELDS = new Set([
  "status",
  "priority",
  "classification",
  "root_cause",
  "technical_basis",
  "assigned_specialist_user_id",
  "assigned_specialist_role",
  "dispatcher_user_id",
  "dispatcher_notes",
  "work_order_number",
  "provider_name",
  "provider_case_reference",
  "external_routed_at",
  "requires_site_visit",
  "requires_part_change",
  "requires_disinfection",
  "disinfection_document_file_id",
  "disinfection_completed_at",
  "ceac_closed_remotely",
  "ceac_resolution_notes",
  "first_response_at",
  "scheduled_visit_at",
  "attended_at",
  "result_summary",
  "close_reason",
  "closed_at",
  "closed_by_user_id",
  "metadata",
]);

const updateCasePartial = async (client, caseId, patch = {}) => {
  const entries = Object.entries(patch).filter(([key]) => CASE_UPDATABLE_FIELDS.has(key));
  if (!entries.length) {
    return getCaseBase(client, caseId);
  }
  const values = [caseId];
  const updates = entries.map(([key, value], index) => {
    values.push(key === "metadata" ? JSON.stringify(value || {}) : value);
    const valueExpr = key === "metadata" ? `$${index + 2}::jsonb` : `$${index + 2}`;
    return `${key} = ${valueExpr}`;
  });
  const { rows } = await client.query(
    `
      UPDATE servicio.corrective_cases
      SET ${updates.join(", ")}, updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    values,
  );
  return rows[0];
};

const stageFromStatus = (status) => {
  const normalized = normalizeStatus(status);
  if (
    [
      CASE_STATUS.CEAC_RECEIVED,
      CASE_STATUS.CEAC_DIAGNOSIS,
      CASE_STATUS.RESOLVED_REMOTE,
    ].includes(normalized)
  ) {
    return "triage";
  }
  if (
    [
      CASE_STATUS.ESCALATED_DISPATCH,
      CASE_STATUS.VISIT_SCHEDULED,
      CASE_STATUS.REVISIT_SCHEDULED,
    ].includes(normalized)
  ) {
    return "scheduled";
  }
  if (
    [
      CASE_STATUS.VISIT_IN_PROGRESS,
      CASE_STATUS.CLASSIFIED_APPLICATIONS,
      CASE_STATUS.CLASSIFIED_ENGINEERING,
      CASE_STATUS.CLASSIFIED_PROVIDER,
      CASE_STATUS.PARTS_PENDING_QUOTE,
      CASE_STATUS.PARTS_PENDING_CLIENT_APPROVAL,
      CASE_STATUS.PARTS_APPROVED,
      CASE_STATUS.PART_REPLACED,
      CASE_STATUS.PENDING_DISINFECTION,
    ].includes(normalized)
  ) {
    return "executing";
  }
  if (normalized === CASE_STATUS.CLOSED) return "completed";
  if (normalized === CASE_STATUS.CANCELLED) return "cancelled";
  return "triage";
};

const globalStatusFromCase = (status) => {
  const normalized = normalizeStatus(status);
  if (normalized === CASE_STATUS.CLOSED) return "completed";
  if (normalized === CASE_STATUS.CANCELLED) return "cancelled";
  return "in_progress";
};

const syncWorkflowForCase = async ({ caseRow, actorUser, client = null }) => {
  const runUpsert = async () =>
    upsertWorkflow({
      sourceType: WORKFLOW_SOURCE_TYPE,
      sourceId: String(caseRow.id),
      requestId: caseRow.linked_request_id || null,
      clientName: caseRow.client_name || null,
      equipmentName: caseRow.equipment_name || null,
      procedureCode: PROCEDURE_CODE,
      globalStatus: globalStatusFromCase(caseRow.status),
      currentStage: stageFromStatus(caseRow.status),
      metadata: {
        corrective_code: caseRow.code,
        corrective_status: caseRow.status,
        classification: caseRow.classification || null,
      },
      user: actorUser || null,
    });

  if (client && typeof client.query === "function") {
    // upsertWorkflow usa db global, así que en transacción no se comparte conexión.
    // Se mantiene intencional para no acoplar servicios preexistentes.
    await runUpsert();
  } else {
    await runUpsert();
  }

  await appendWorkflowAuditEvent({
    sourceType: WORKFLOW_SOURCE_TYPE,
    sourceId: String(caseRow.id),
    procedureCode: PROCEDURE_CODE,
    eventType: "corrective_case_status",
    stageKey: stageFromStatus(caseRow.status),
    actor: actorUser || null,
    payload: {
      case_id: caseRow.id,
      case_code: caseRow.code,
      status: caseRow.status,
      classification: caseRow.classification || null,
    },
  });
};

const findLatestFst02 = async (client, caseId) => {
  await ensureWorkflowDocumentsTable();
  const { rows } = await client.query(
    `
      SELECT drive_file_id, created_at
      FROM servicio.workflow_documents
      WHERE source_type = $1
        AND source_id = $2
        AND document_code = 'F.ST-02'
        AND COALESCE(drive_file_id, '') <> ''
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [WORKFLOW_SOURCE_TYPE, String(caseId)],
  );
  return rows[0] || null;
};

const transitionCaseStatus = async (client, {
  caseRow,
  nextStatus,
  actorUser,
  comment = null,
  patch = {},
  eventType = "status_changed",
  eventPayload = {},
}) => {
  const fromStatus = normalizeStatus(caseRow.status);
  const targetStatus = normalizeStatus(nextStatus);
  if (fromStatus !== targetStatus) {
    assertTransition({ fromStatus, toStatus: targetStatus });
  }

  const autoPatch = { ...patch, status: targetStatus };
  if (!caseRow.first_response_at && targetStatus !== CASE_STATUS.CEAC_RECEIVED) {
    autoPatch.first_response_at = normalizeDateTime(new Date());
  }
  if ([CASE_STATUS.CLOSED, CASE_STATUS.CANCELLED].includes(targetStatus)) {
    autoPatch.closed_at = normalizeDateTime(new Date());
    autoPatch.closed_by_user_id = actorUser?.id || null;
  }

  const updated = await updateCasePartial(client, caseRow.id, autoPatch);
  await createEvent(client, {
    caseId: caseRow.id,
    actorUser,
    eventType,
    oldStatus: caseRow.status,
    newStatus: targetStatus,
    comment,
    payload: eventPayload,
  });
  return updated;
};

async function createCorrectiveCase({ actorUser, payload = {} }) {
  await ensureCorrectiveCaseTables();
  const problemSummary = normalizeText(payload.problem_summary || payload.problemSummary || payload.title);
  const problemDetail = normalizeText(payload.problem_detail || payload.problemDetail || payload.description);
  if (!problemSummary || problemSummary.length < 5) {
    throw buildError("problem_summary debe tener al menos 5 caracteres", {
      status: 400,
      code: "CORRECTIVE_CASE_SUMMARY_INVALID",
    });
  }
  if (!problemDetail || problemDetail.length < 10) {
    throw buildError("problem_detail debe tener al menos 10 caracteres", {
      status: 400,
      code: "CORRECTIVE_CASE_DETAIL_INVALID",
    });
  }

  const ceacExceptionAuthorized = payload.ceac_exception_authorized === true
    || String(payload.ceac_exception_authorized || "").toLowerCase() === "true";
  const ceacExceptionReason = normalizeText(payload.ceac_exception_reason || payload.ceacExceptionReason);
  assertCeacEntryPermission({
    actorUser,
    ceacExceptionAuthorized,
    ceacExceptionReason,
  });

  const priority = normalizePriority(payload.priority);
  const clientSegment = normalizeClientSegment(payload.client_segment || payload.clientSegment || "C");
  const sla = buildSlaDeadlines({ clientSegment, priority });
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
        INSERT INTO servicio.corrective_cases (
          requester_user_id, requester_email, requester_name,
          source_type, source_id, linked_source_type, linked_source_id, linked_request_id,
          entry_channel, ceac_exception_authorized, ceac_exception_reason,
          client_name, client_segment, equipment_name, equipment_serial,
          priority, status, classification,
          problem_summary, problem_detail, root_cause, technical_basis,
          metadata, first_response_due_at, resolution_due_at, created_at, updated_at
        )
        VALUES (
          $1,$2,$3,
          $4,$5,$6,$7,$8,
          'ceac',$9,$10,
          $11,$12,$13,$14,
          $15,$16,$17,
          $18,$19,$20,$21,
          $22::jsonb,
          now() + ($23::text || ' hours')::interval,
          now() + ($24::text || ' hours')::interval,
          now(),
          now()
        )
        RETURNING *
      `,
      [
        actorUser.id,
        actorUser.email || null,
        actorUser.fullname || actorUser.name || actorUser.email || null,
        WORKFLOW_SOURCE_TYPE,
        null,
        normalizeText(payload.linked_source_type || payload.linkedSourceType),
        normalizeText(payload.linked_source_id || payload.linkedSourceId),
        normalizeInt(payload.linked_request_id || payload.linkedRequestId),
        ceacExceptionAuthorized,
        ceacExceptionReason,
        normalizeText(payload.client_name || payload.clientName),
        sla.client_segment,
        normalizeText(payload.equipment_name || payload.equipmentName),
        normalizeText(payload.equipment_serial || payload.equipmentSerial),
        sla.priority,
        INITIAL_STATUS,
        null,
        problemSummary,
        problemDetail,
        normalizeText(payload.root_cause || payload.rootCause),
        normalizeText(payload.technical_basis || payload.technicalBasis),
        JSON.stringify(safeJson(payload.metadata, {})),
        String(sla.response_hours),
        String(sla.resolution_hours),
      ],
    );

    const created = rows[0];
    const code = `CC-${String(created.id).padStart(6, "0")}`;
    const { rows: updatedRows } = await client.query(
      `
        UPDATE servicio.corrective_cases
        SET code = $2, source_id = $3, updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [created.id, code, String(created.id)],
    );
    const withCode = updatedRows[0];

    await createEvent(client, {
      caseId: withCode.id,
      actorUser,
      eventType: "created",
      oldStatus: null,
      newStatus: withCode.status,
      comment: "Caso correctivo registrado en CEAC",
      payload: {
        case_code: withCode.code,
        client_segment: withCode.client_segment,
        priority: withCode.priority,
      },
    });

    await recalcSlaFlags(client, withCode.id);
    await client.query("COMMIT");

    try {
      await syncWorkflowForCase({ caseRow: withCode, actorUser });
    } catch (workflowError) {
      // No se revierte la creación del caso por fallas auxiliares de sincronización.
      // El workspace correctivo permanece operativo y trazable a nivel local.
      // eslint-disable-next-line no-console
      console.warn("No se pudo sincronizar workflow de caso correctivo recién creado:", workflowError?.message || workflowError);
    }
    const detail = await getCorrectiveCaseDetail(withCode.id, actorUser);
    return detail;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listCorrectiveCasesWorkspace({
  actorUser,
  status = null,
  classification = null,
  q = null,
  onlyMine = false,
  limit = 250,
} = {}) {
  await ensureCorrectiveCaseTables();
  const safeLimit = Math.max(1, Math.min(500, Number.parseInt(String(limit || "250"), 10) || 250));
  const { whereClause, values } = buildWorkspaceFilters({
    actorUser,
    status,
    classification,
    q,
    onlyMine,
  });
  const { rows } = await db.query(
    `
      ${WORKSPACE_SELECT}
      ${whereClause}
      ORDER BY
        CASE c.priority
          WHEN 'critica' THEN 0
          WHEN 'alta' THEN 1
          WHEN 'media' THEN 2
          ELSE 3
        END,
        c.created_at DESC
      LIMIT ${safeLimit}
    `,
    values,
  );
  return rows.map(mapCaseRow);
}

async function getCorrectiveCasesWorkspaceKpis({
  actorUser,
  status = null,
  classification = null,
  q = null,
  onlyMine = false,
} = {}) {
  await ensureCorrectiveCaseTables();
  const { whereClause, values } = buildWorkspaceFilters({
    actorUser,
    status,
    classification,
    q,
    onlyMine,
  });
  const { rows } = await db.query(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE c.status IN ('ceac_received','ceac_diagnosis'))::int AS ceac_queue,
        COUNT(*) FILTER (WHERE c.status IN ('escalated_dispatch','visit_scheduled','revisit_scheduled'))::int AS dispatch_queue,
        COUNT(*) FILTER (WHERE c.status IN ('visit_in_progress','classified_applications','classified_engineering','classified_provider'))::int AS technical_execution,
        COUNT(*) FILTER (WHERE c.status IN ('parts_pending_quote','parts_pending_client_approval'))::int AS spare_parts_pending,
        COUNT(*) FILTER (WHERE c.status = 'pending_disinfection')::int AS disinfection_pending,
        COUNT(*) FILTER (WHERE c.status = 'closed')::int AS closed,
        COUNT(*) FILTER (WHERE c.status = 'cancelled')::int AS cancelled,
        COUNT(*) FILTER (
          WHERE c.first_response_at IS NULL
            AND c.first_response_due_at IS NOT NULL
            AND now() > c.first_response_due_at
        )::int AS response_overdue,
        COUNT(*) FILTER (
          WHERE c.closed_at IS NULL
            AND c.resolution_due_at IS NOT NULL
            AND now() > c.resolution_due_at
        )::int AS resolution_overdue
      FROM servicio.corrective_cases c
      JOIN public.users rq ON rq.id = c.requester_user_id
      ${whereClause}
    `,
    values,
  );
  const row = rows[0] || {};
  return {
    total: Number(row.total || 0),
    ceac_queue: Number(row.ceac_queue || 0),
    dispatch_queue: Number(row.dispatch_queue || 0),
    technical_execution: Number(row.technical_execution || 0),
    spare_parts_pending: Number(row.spare_parts_pending || 0),
    disinfection_pending: Number(row.disinfection_pending || 0),
    closed: Number(row.closed || 0),
    cancelled: Number(row.cancelled || 0),
    response_overdue: Number(row.response_overdue || 0),
    resolution_overdue: Number(row.resolution_overdue || 0),
  };
}

async function getCorrectiveCaseDetail(caseId, actorUser) {
  await ensureCorrectiveCaseTables();
  const { rows } = await db.query(
    `
      ${WORKSPACE_SELECT}
      WHERE c.id = $1
      LIMIT 1
    `,
    [caseId],
  );
  if (!rows.length) {
    throw buildError("Caso correctivo no encontrado", {
      status: 404,
      code: "CORRECTIVE_CASE_NOT_FOUND",
    });
  }
  assertCaseAccess(rows[0], actorUser);
  const mapped = mapCaseRow(rows[0]);
  const spareParts = await listCaseSpareParts({ caseId });
  return {
    ...mapped,
    spare_parts: spareParts,
  };
}

async function listCorrectiveCaseEvents(caseId, actorUser) {
  await ensureCorrectiveCaseTables();
  const base = await getCorrectiveCaseDetail(caseId, actorUser);
  assertCaseAccess(base, actorUser);
  const { rows } = await db.query(
    `
      SELECT e.*, u.fullname AS actor_name
      FROM servicio.corrective_case_events e
      LEFT JOIN public.users u ON u.id = e.actor_user_id
      WHERE e.case_id = $1
      ORDER BY e.created_at DESC
      LIMIT 300
    `,
    [caseId],
  );
  return rows.map(mapEventRow);
}

async function listCorrectiveCaseComments(caseId, actorUser) {
  await ensureCorrectiveCaseTables();
  const base = await getCorrectiveCaseDetail(caseId, actorUser);
  const workspaceUser = isCorrectiveWorkspaceUser(actorUser);
  const params = [caseId];
  let visibilityFilter = "";
  if (!workspaceUser) {
    params.push("public");
    visibilityFilter = `AND c.visibility = $${params.length}`;
  }
  const { rows } = await db.query(
    `
      SELECT c.*, u.fullname AS author_name
      FROM servicio.corrective_case_comments c
      LEFT JOIN public.users u ON u.id = c.author_user_id
      WHERE c.case_id = $1
      ${visibilityFilter}
      ORDER BY c.created_at ASC
      LIMIT 500
    `,
    params,
  );
  assertCaseAccess(base, actorUser);
  return rows.map(mapCommentRow);
}

async function addCorrectiveCaseComment({
  caseId,
  actorUser,
  message,
  visibility = "public",
}) {
  await ensureCorrectiveCaseTables();
  const base = await getCorrectiveCaseDetail(caseId, actorUser);
  assertCaseAccess(base, actorUser);
  const text = normalizeText(message);
  if (!text || text.length < 2) {
    throw buildError("Comentario demasiado corto", {
      status: 400,
      code: "CORRECTIVE_CASE_COMMENT_INVALID",
    });
  }
  const normalizedVisibility = normalize(visibility || "public");
  if (!COMMENT_VISIBILITY.has(normalizedVisibility)) {
    throw buildError("visibility inválida", {
      status: 400,
      code: "CORRECTIVE_CASE_COMMENT_VISIBILITY_INVALID",
    });
  }
  if (normalizedVisibility === "internal" && !isCorrectiveWorkspaceUser(actorUser)) {
    throw buildError("No autorizado para comentarios internos", {
      status: 403,
      code: "CORRECTIVE_CASE_COMMENT_INTERNAL_FORBIDDEN",
    });
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `
        INSERT INTO servicio.corrective_case_comments (
          case_id, author_user_id, author_email, visibility, message, created_at
        )
        VALUES ($1,$2,$3,$4,$5,now())
        RETURNING *
      `,
      [caseId, actorUser.id, actorUser.email || null, normalizedVisibility, text],
    );

    const current = await getCaseBase(client, caseId);
    if (!current.first_response_at && isCorrectiveWorkspaceUser(actorUser)) {
      await updateCasePartial(client, caseId, { first_response_at: normalizeDateTime(new Date()) });
    }
    await createEvent(client, {
      caseId,
      actorUser,
      eventType: "commented",
      oldStatus: current.status,
      newStatus: current.status,
      comment: normalizedVisibility === "internal" ? "Comentario interno agregado" : "Comentario agregado",
      payload: { visibility: normalizedVisibility },
    });
    await recalcSlaFlags(client, caseId);
    await client.query("COMMIT");
    return mapCommentRow(rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listCorrectiveCaseTimeline(caseId, actorUser) {
  await ensureCorrectiveCaseTables();
  const detail = await getCorrectiveCaseDetail(caseId, actorUser);
  assertCaseAccess(detail, actorUser);
  const workspaceUser = isCorrectiveWorkspaceUser(actorUser);
  const { rows } = await db.query(
    `
      SELECT *
      FROM (
        SELECT
          CONCAT('event-', e.id::text) AS id,
          e.case_id,
          'event'::text AS entry_type,
          e.event_type AS label,
          e.comment AS description,
          e.event_payload AS payload,
          e.actor_user_id,
          e.actor_email,
          u.fullname AS actor_name,
          e.created_at
        FROM servicio.corrective_case_events e
        LEFT JOIN public.users u ON u.id = e.actor_user_id
        WHERE e.case_id = $1

        UNION ALL

        SELECT
          CONCAT('comment-', c.id::text) AS id,
          c.case_id,
          'comment'::text AS entry_type,
          CASE WHEN c.visibility = 'internal' THEN 'comentario_interno' ELSE 'comentario' END AS label,
          c.message AS description,
          jsonb_build_object('visibility', c.visibility) AS payload,
          c.author_user_id AS actor_user_id,
          c.author_email AS actor_email,
          u.fullname AS actor_name,
          c.created_at
        FROM servicio.corrective_case_comments c
        LEFT JOIN public.users u ON u.id = c.author_user_id
        WHERE c.case_id = $1
          ${workspaceUser ? "" : "AND c.visibility = 'public'"}

        UNION ALL

        SELECT
          CONCAT('evidence-', ev.id::text) AS id,
          ev.case_id,
          'evidence'::text AS entry_type,
          'evidencia'::text AS label,
          ev.note AS description,
          jsonb_build_object(
            'evidence_type', ev.evidence_type,
            'evidence_ref', ev.evidence_ref
          ) AS payload,
          ev.actor_user_id,
          ev.actor_email,
          u.fullname AS actor_name,
          ev.created_at
        FROM servicio.corrective_case_evidences ev
        LEFT JOIN public.users u ON u.id = ev.actor_user_id
        WHERE ev.case_id = $1
      ) timeline
      ORDER BY created_at DESC
      LIMIT 500
    `,
    [caseId],
  );
  return rows;
}

async function listCorrectiveCaseEvidences(caseId, actorUser) {
  await ensureCorrectiveCaseTables();
  const detail = await getCorrectiveCaseDetail(caseId, actorUser);
  assertCaseAccess(detail, actorUser);
  const { rows } = await db.query(
    `
      SELECT ev.*, u.fullname AS actor_name
      FROM servicio.corrective_case_evidences ev
      LEFT JOIN public.users u ON u.id = ev.actor_user_id
      WHERE ev.case_id = $1
      ORDER BY ev.created_at DESC
      LIMIT 500
    `,
    [caseId],
  );
  return rows.map(mapEvidenceRow);
}

const upsertDispatchMilestoneHistory = (metadata = {}, milestonePayload = {}) => {
  const base = safeJson(metadata, {});
  const dispatch = safeJson(base.dispatch, {});
  const history = Array.isArray(dispatch.history) ? dispatch.history : [];
  history.push({
    milestone: milestonePayload.milestone,
    at: milestonePayload.at,
    notes: milestonePayload.notes || null,
    actor_user_id: milestonePayload.actor_user_id || null,
    actor_email: milestonePayload.actor_email || null,
  });
  return {
    ...base,
    dispatch: {
      ...dispatch,
      history,
    },
  };
};

const ensureDisinfectionDocumentIfRequired = async (client, caseRow) => {
  if (!caseRow.requires_disinfection) return caseRow;
  if (caseRow.disinfection_document_file_id) return caseRow;
  const doc = await findLatestFst02(client, caseRow.id);
  if (!doc?.drive_file_id) {
    throw buildError("Debe registrarse F.ST-02 para cerrar el caso con cambio de parte retirado", {
      status: 409,
      code: "CORRECTIVE_CASE_FST02_REQUIRED",
    });
  }
  return updateCasePartial(client, caseRow.id, {
    disinfection_document_file_id: doc.drive_file_id,
    disinfection_completed_at: normalizeDateTime(doc.created_at || new Date()),
    requires_disinfection: true,
  });
};

async function updateCorrectiveCaseAction({ caseId, action, payload = {}, actorUser }) {
  await ensureCorrectiveCaseTables();
  const normalizedAction = normalize(action);
  if (!ACTIONS.has(normalizedAction)) {
    throw buildError(`Acción no soportada: ${normalizedAction}`, {
      status: 400,
      code: "CORRECTIVE_CASE_ACTION_UNSUPPORTED",
    });
  }
  assertRoleForAction({ action: normalizedAction, actorUser });

  const client = await db.getClient();
  let notifyTechnicalEscalation = null;
  let notifyCommercialRequest = null;
  let notifyTechnicalPartApproved = null;
  try {
    await client.query("BEGIN");
    let current = await getCaseBase(client, caseId);
    assertCaseAccess(current, actorUser);
    let detailNeedsRefresh = false;

    if ([CASE_STATUS.CLOSED, CASE_STATUS.CANCELLED].includes(normalizeStatus(current.status))
      && !["link_disinfection_fst02", "add_evidence"].includes(normalizedAction)) {
      throw buildError("El caso ya fue cerrado/cancelado y no admite esta acción", {
        status: 409,
        code: "CORRECTIVE_CASE_ALREADY_TERMINATED",
      });
    }

    if (normalizedAction === "ceac_diagnosis") {
      const notes = normalizeText(payload.notes || payload.diagnosis_notes || payload.diagnosisNotes);
      if (!notes) {
        throw buildError("Debe registrar diagnóstico CEAC", {
          status: 400,
          code: "CORRECTIVE_CASE_DIAGNOSIS_REQUIRED",
        });
      }
      current = await transitionCaseStatus(client, {
        caseRow: current,
        nextStatus: CASE_STATUS.CEAC_DIAGNOSIS,
        actorUser,
        comment: notes,
        patch: {
          root_cause: normalizeText(payload.root_cause || payload.rootCause) || current.root_cause,
          technical_basis: normalizeText(payload.technical_basis || payload.technicalBasis) || current.technical_basis,
        },
        eventType: "ceac_diagnosis",
        eventPayload: {
          diagnosis_notes: notes,
          root_cause: normalizeText(payload.root_cause || payload.rootCause),
        },
      });
    } else if (normalizedAction === "resolve_remote") {
      const resolutionNotes = normalizeText(
        payload.resolution_notes || payload.resolutionNotes || payload.notes,
      );
      const technicalBasis = normalizeText(payload.technical_basis || payload.technicalBasis);
      if (!resolutionNotes || !technicalBasis) {
        throw buildError("Para cierre remoto debe registrar notas y base técnica validada", {
          status: 400,
          code: "CORRECTIVE_CASE_REMOTE_RESOLUTION_FIELDS_REQUIRED",
        });
      }
      current = await transitionCaseStatus(client, {
        caseRow: current,
        nextStatus: CASE_STATUS.RESOLVED_REMOTE,
        actorUser,
        comment: resolutionNotes,
        patch: {
          ceac_resolution_notes: resolutionNotes,
          technical_basis: technicalBasis,
          ceac_closed_remotely: true,
        },
        eventType: "resolved_remote",
        eventPayload: {
          technical_basis: technicalBasis,
        },
      });
      current = await transitionCaseStatus(client, {
        caseRow: current,
        nextStatus: CASE_STATUS.CLOSED,
        actorUser,
        comment: "Cierre remoto CEAC",
        patch: {
          ceac_closed_remotely: true,
          result_summary: resolutionNotes,
          close_reason: "resuelto_en_primer_nivel_ceac",
        },
        eventType: "closed_remote",
      });
    } else if (normalizedAction === "escalate_dispatch") {
      const reason = normalizeText(payload.reason || payload.escalation_reason || payload.escalationReason);
      if (!reason) {
        throw buildError("Debe registrar motivo de escalamiento", {
          status: 400,
          code: "CORRECTIVE_CASE_ESCALATION_REASON_REQUIRED",
        });
      }
      current = await transitionCaseStatus(client, {
        caseRow: current,
        nextStatus: CASE_STATUS.ESCALATED_DISPATCH,
        actorUser,
        comment: reason,
        patch: {
          requires_site_visit: true,
          dispatcher_notes: reason,
        },
        eventType: "escalated_dispatch",
      });
      notifyTechnicalEscalation = { caseId: current.id, caseCode: current.code, reason };
    } else if (normalizedAction === "classify_case") {
      const classification = normalizeText(payload.classification);
      const classificationStatus = statusFromClassification(classification);
      if (!classificationStatus) {
        throw buildError("classification debe ser aplicaciones, ingenieria o software_lis", {
          status: 400,
          code: "CORRECTIVE_CASE_CLASSIFICATION_INVALID",
        });
      }
      const specialistUserId = normalizeInt(payload.assigned_specialist_user_id || payload.assignedSpecialistUserId);
      const specialistRole = normalizeText(payload.assigned_specialist_role || payload.assignedSpecialistRole);
      if (!specialistUserId && classificationStatus !== CASE_STATUS.CLASSIFIED_PROVIDER) {
        throw buildError("assigned_specialist_user_id es obligatorio para clasificación técnica", {
          status: 400,
          code: "CORRECTIVE_CASE_ASSIGNEE_REQUIRED",
        });
      }
      const providerName = normalizeText(payload.provider_name || payload.providerName);
      const providerCaseReference = normalizeText(payload.provider_case_reference || payload.providerCaseReference);
      if (classificationStatus === CASE_STATUS.CLASSIFIED_PROVIDER && !providerName) {
        throw buildError("provider_name es obligatorio para casos software/LIS", {
          status: 400,
          code: "CORRECTIVE_CASE_PROVIDER_REQUIRED",
        });
      }

      current = await transitionCaseStatus(client, {
        caseRow: current,
        nextStatus: classificationStatus,
        actorUser,
        comment: `Caso clasificado: ${classification}`,
        patch: {
          classification: normalize(classification),
          assigned_specialist_user_id: specialistUserId || null,
          assigned_specialist_role: specialistRole || null,
          provider_name: providerName || current.provider_name,
          provider_case_reference: providerCaseReference || current.provider_case_reference,
          external_routed_at:
            classificationStatus === CASE_STATUS.CLASSIFIED_PROVIDER
              ? normalizeDateTime(new Date())
              : current.external_routed_at,
        },
        eventType: "classified",
      });
    } else if (normalizedAction === "register_dispatch_milestone") {
      const milestone = normalizeText(payload.milestone);
      if (!["qualify", "dispatch", "attend"].includes(normalize(milestone))) {
        throw buildError("milestone debe ser qualify, dispatch o attend", {
          status: 400,
          code: "CORRECTIVE_CASE_DISPATCH_MILESTONE_INVALID",
        });
      }
      const at = normalizeDateTime(payload.at || new Date(), normalizeDateTime(new Date()));
      const nextStatusByMilestone = {
        dispatch: CASE_STATUS.VISIT_SCHEDULED,
        attend: CASE_STATUS.VISIT_IN_PROGRESS,
      };
      const maybeNextStatus = nextStatusByMilestone[normalize(milestone)] || current.status;
      const mergedMetadata = upsertDispatchMilestoneHistory(current.metadata, {
        milestone: normalize(milestone),
        at,
        notes: normalizeText(payload.notes),
        actor_user_id: actorUser.id,
        actor_email: actorUser.email || null,
      });
      const patch = {
        metadata: mergedMetadata,
      };
      if (normalize(milestone) === "dispatch") {
        patch.scheduled_visit_at = normalizeDateTime(
          payload.scheduled_visit_at || payload.scheduledVisitAt || at,
          at,
        );
        patch.dispatcher_user_id = normalizeInt(payload.dispatcher_user_id || payload.dispatcherUserId, actorUser.id);
      }
      if (normalize(milestone) === "attend") {
        patch.attended_at = at;
      }
      current = await transitionCaseStatus(client, {
        caseRow: current,
        nextStatus: maybeNextStatus,
        actorUser,
        comment: `Milestone ${normalize(milestone)} registrado`,
        patch,
        eventType: "dispatch_milestone",
        eventPayload: { milestone: normalize(milestone), at },
      });
    } else if (normalizedAction === "register_spare_part_requirement") {
      const sparePart = await createSparePartRequest({
        caseId,
        payload,
        user: actorUser,
        client,
      });
      const nextStatus =
        sparePart.warranty_status === "out_of_warranty"
          ? CASE_STATUS.PARTS_PENDING_QUOTE
          : CASE_STATUS.PARTS_APPROVED;
      current = await transitionCaseStatus(client, {
        caseRow: current,
        nextStatus,
        actorUser,
        comment: `Repuesto registrado: ${sparePart.part_description}`,
        patch: {
          requires_part_change: true,
          requires_disinfection:
            sparePart.removed_part_requires_disinfection || current.requires_disinfection,
        },
        eventType: "spare_part_registered",
        eventPayload: {
          spare_part_id: sparePart.id,
          warranty_status: sparePart.warranty_status,
          quotation_status: sparePart.quotation_status,
        },
      });
      detailNeedsRefresh = true;
      if (sparePart.warranty_status === "out_of_warranty") {
        notifyCommercialRequest = {
          caseId: current.id,
          caseCode: current.code,
          sparePartDescription: sparePart.part_description,
        };
      }
    } else if (normalizedAction === "request_commercial_quote") {
      const sparePartId = normalizeInt(payload.spare_part_id || payload.sparePartId);
      if (!sparePartId) {
        throw buildError("spare_part_id es obligatorio", {
          status: 400,
          code: "CORRECTIVE_CASE_SPARE_PART_ID_REQUIRED",
        });
      }
      const sparePart = await requestCommercialQuote({
        caseId,
        sparePartId,
        notes: payload.notes,
        user: actorUser,
        client,
      });
      current = await transitionCaseStatus(client, {
        caseRow: current,
        nextStatus: CASE_STATUS.PARTS_PENDING_QUOTE,
        actorUser,
        comment: `Cotización solicitada para parte ${sparePart.part_description}`,
        patch: { requires_part_change: true },
        eventType: "commercial_quote_requested",
        eventPayload: { spare_part_id: sparePart.id },
      });
      detailNeedsRefresh = true;
      notifyCommercialRequest = {
        caseId: current.id,
        caseCode: current.code,
        sparePartDescription: sparePart.part_description,
      };
    } else if (normalizedAction === "issue_commercial_quote") {
      const sparePartId = normalizeInt(payload.spare_part_id || payload.sparePartId);
      if (!sparePartId) {
        throw buildError("spare_part_id es obligatorio", {
          status: 400,
          code: "CORRECTIVE_CASE_SPARE_PART_ID_REQUIRED",
        });
      }
      const sparePart = await issueCommercialQuote({
        caseId,
        sparePartId,
        payload,
        user: actorUser,
        client,
      });
      current = await transitionCaseStatus(client, {
        caseRow: current,
        nextStatus: CASE_STATUS.PARTS_PENDING_CLIENT_APPROVAL,
        actorUser,
        comment: `Cotización emitida para parte ${sparePart.part_description}`,
        eventType: "commercial_quote_issued",
        eventPayload: {
          spare_part_id: sparePart.id,
          total_price: sparePart.total_price,
          currency: sparePart.pricing_currency,
        },
      });
      detailNeedsRefresh = true;
    } else if (normalizedAction === "record_client_quote_decision") {
      const sparePartId = normalizeInt(payload.spare_part_id || payload.sparePartId);
      const decision = normalizeText(payload.decision);
      if (!sparePartId || !decision) {
        throw buildError("spare_part_id y decision son obligatorios", {
          status: 400,
          code: "CORRECTIVE_CASE_CLIENT_DECISION_FIELDS_REQUIRED",
        });
      }
      const sparePart = await recordClientDecision({
        caseId,
        sparePartId,
        decision,
        notes: payload.notes,
        decidedBy: payload.client_name || payload.clientName || actorUser.email || "cliente",
        client,
      });

      if (sparePart.client_decision === "approved") {
        current = await transitionCaseStatus(client, {
          caseRow: current,
          nextStatus: CASE_STATUS.PARTS_APPROVED,
          actorUser,
          comment: "Cliente aprobó cotización de repuesto",
          eventType: "client_quote_approved",
          eventPayload: { spare_part_id: sparePart.id },
        });
        notifyTechnicalPartApproved = {
          caseId: current.id,
          caseCode: current.code,
          sparePartDescription: sparePart.part_description,
        };
      } else {
        current = await transitionCaseStatus(client, {
          caseRow: current,
          nextStatus: CASE_STATUS.PARTS_REJECTED,
          actorUser,
          comment: "Cliente rechazó cotización de repuesto",
          eventType: "client_quote_rejected",
          eventPayload: { spare_part_id: sparePart.id },
        });
        current = await transitionCaseStatus(client, {
          caseRow: current,
          nextStatus: CASE_STATUS.CLOSED,
          actorUser,
          comment: "Cierre por rechazo de cotización",
          patch: {
            close_reason: "sin cambio de parte por falta de aprobacion del cliente",
            result_summary: "Caso cerrado por rechazo de cotización de repuesto fuera de garantía",
          },
          eventType: "closed_without_part_change",
          eventPayload: { spare_part_id: sparePart.id },
        });
      }
      detailNeedsRefresh = true;
    } else if (normalizedAction === "schedule_revisit") {
      const scheduledVisitAt = normalizeDateTime(
        payload.scheduled_visit_at || payload.scheduledVisitAt,
      );
      if (!scheduledVisitAt) {
        throw buildError("scheduled_visit_at es obligatorio", {
          status: 400,
          code: "CORRECTIVE_CASE_REVISIT_DATE_REQUIRED",
        });
      }
      current = await transitionCaseStatus(client, {
        caseRow: current,
        nextStatus: CASE_STATUS.REVISIT_SCHEDULED,
        actorUser,
        comment: "Nueva visita para cambio de parte coordinada",
        patch: {
          scheduled_visit_at: scheduledVisitAt,
          work_order_number: normalizeText(payload.work_order_number || payload.workOrderNumber) || current.work_order_number,
        },
        eventType: "revisit_scheduled",
      });
    } else if (normalizedAction === "record_part_replacement") {
      const sparePartId = normalizeInt(payload.spare_part_id || payload.sparePartId);
      if (!sparePartId) {
        throw buildError("spare_part_id es obligatorio", {
          status: 400,
          code: "CORRECTIVE_CASE_SPARE_PART_ID_REQUIRED",
        });
      }
      const sparePart = await markPartInstalled({
        caseId,
        sparePartId,
        payload,
        client,
      });
      const requiresDisinfection = Boolean(sparePart.removed_part_requires_disinfection && !sparePart.fst02_file_id);
      current = await transitionCaseStatus(client, {
        caseRow: current,
        nextStatus: requiresDisinfection ? CASE_STATUS.PENDING_DISINFECTION : CASE_STATUS.PART_REPLACED,
        actorUser,
        comment: `Parte instalada: ${sparePart.part_description}`,
        patch: {
          requires_part_change: true,
          requires_disinfection: requiresDisinfection || current.requires_disinfection,
          disinfection_document_file_id: sparePart.fst02_file_id || current.disinfection_document_file_id,
          disinfection_completed_at: sparePart.fst02_file_id
            ? normalizeDateTime(new Date())
            : current.disinfection_completed_at,
        },
        eventType: "part_replacement_recorded",
        eventPayload: { spare_part_id: sparePart.id },
      });
      detailNeedsRefresh = true;
    } else if (normalizedAction === "link_disinfection_fst02") {
      let fst02FileId = normalizeText(payload.fst02_file_id || payload.fst02FileId);
      if (!fst02FileId) {
        const latest = await findLatestFst02(client, caseId);
        fst02FileId = latest?.drive_file_id || null;
      }
      if (!fst02FileId) {
        throw buildError("No se encontró F.ST-02 asociado al caso correctivo", {
          status: 409,
          code: "CORRECTIVE_CASE_FST02_NOT_FOUND",
        });
      }
      current = await updateCasePartial(client, caseId, {
        requires_disinfection: true,
        disinfection_document_file_id: fst02FileId,
        disinfection_completed_at: normalizeDateTime(new Date()),
      });
      await createEvent(client, {
        caseId,
        actorUser,
        eventType: "disinfection_linked",
        oldStatus: current.status,
        newStatus: current.status,
        comment: "F.ST-02 vinculado al caso correctivo",
        payload: { fst02_file_id: fst02FileId },
      });
      detailNeedsRefresh = true;
    } else if (normalizedAction === "add_evidence") {
      const evidenceRef = normalizeText(payload.evidence_ref || payload.evidenceRef || payload.url);
      if (!evidenceRef) {
        throw buildError("evidence_ref es obligatorio", {
          status: 400,
          code: "CORRECTIVE_CASE_EVIDENCE_REF_REQUIRED",
        });
      }
      await client.query(
        `
          INSERT INTO servicio.corrective_case_evidences (
            case_id, actor_user_id, actor_email, evidence_type, evidence_ref, note, created_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,now())
        `,
        [
          caseId,
          actorUser.id || null,
          actorUser.email || null,
          normalizeText(payload.evidence_type || payload.evidenceType) || "url",
          evidenceRef,
          normalizeText(payload.note || payload.notes),
        ],
      );
      await createEvent(client, {
        caseId,
        actorUser,
        eventType: "evidence_added",
        oldStatus: current.status,
        newStatus: current.status,
        comment: "Evidencia agregada",
        payload: { evidence_ref: evidenceRef },
      });
      detailNeedsRefresh = true;
    } else if (normalizedAction === "close_case") {
      current = await ensureDisinfectionDocumentIfRequired(client, current);
      const closeReason = normalizeText(payload.close_reason || payload.closeReason || current.close_reason);
      const resultSummary = normalizeText(payload.result_summary || payload.resultSummary || current.result_summary);
      if (!closeReason || !resultSummary) {
        throw buildError("close_reason y result_summary son obligatorios para cierre", {
          status: 400,
          code: "CORRECTIVE_CASE_CLOSE_FIELDS_REQUIRED",
        });
      }
      current = await transitionCaseStatus(client, {
        caseRow: current,
        nextStatus: CASE_STATUS.CLOSED,
        actorUser,
        comment: "Caso correctivo cerrado",
        patch: {
          close_reason: closeReason,
          result_summary: resultSummary,
        },
        eventType: "closed",
      });
    } else if (normalizedAction === "cancel_case") {
      const closeReason = normalizeText(payload.close_reason || payload.closeReason || payload.reason);
      if (!closeReason) {
        throw buildError("Debe registrar motivo de cancelación", {
          status: 400,
          code: "CORRECTIVE_CASE_CANCEL_REASON_REQUIRED",
        });
      }
      current = await transitionCaseStatus(client, {
        caseRow: current,
        nextStatus: CASE_STATUS.CANCELLED,
        actorUser,
        comment: "Caso correctivo cancelado",
        patch: {
          close_reason: closeReason,
          result_summary: normalizeText(payload.result_summary || payload.resultSummary) || current.result_summary,
        },
        eventType: "cancelled",
      });
    }

    await recalcSlaFlags(client, caseId);
    await client.query("COMMIT");

    try {
      await syncWorkflowForCase({ caseRow: current, actorUser });
    } catch (workflowError) {
      // No se revierte la acción principal por fallas de sincronización de workflow.
      // eslint-disable-next-line no-console
      console.warn("No se pudo sincronizar workflow de caso correctivo:", workflowError?.message || workflowError);
    }

    if (notifyTechnicalEscalation) {
      const users = await getUsersByRoles([
        "jefe_tecnico",
        "jefe_servicio_tecnico",
        "servicio_tecnico",
        "tecnico",
      ]);
      await notifyUsers({
        users,
        title: `Nuevo escalamiento correctivo ${notifyTechnicalEscalation.caseCode}`,
        message: `CEAC/dispatcher escaló el caso: ${notifyTechnicalEscalation.reason}`,
        source: "corrective_cases.escalated",
        priority: 2,
        meta: {
          corrective_case_id: notifyTechnicalEscalation.caseId,
          corrective_case_code: notifyTechnicalEscalation.caseCode,
        },
      });
    }

    if (notifyCommercialRequest) {
      const users = await getUsersByRoles(["comercial", "jefe_comercial", "backoffice_comercial"]);
      await notifyUsers({
        users,
        title: `Cotización de repuesto requerida ${notifyCommercialRequest.caseCode}`,
        message: `Se requiere cotización para: ${notifyCommercialRequest.sparePartDescription}`,
        source: "corrective_cases.parts.quote_required",
        priority: 2,
        meta: {
          corrective_case_id: notifyCommercialRequest.caseId,
          corrective_case_code: notifyCommercialRequest.caseCode,
        },
      });
    }

    if (notifyTechnicalPartApproved) {
      const users = await getUsersByRoles(["jefe_tecnico", "jefe_servicio_tecnico", "servicio_tecnico", "tecnico"]);
      await notifyUsers({
        users,
        title: `Repuesto aprobado ${notifyTechnicalPartApproved.caseCode}`,
        message: `Cliente aprobó el repuesto: ${notifyTechnicalPartApproved.sparePartDescription}`,
        source: "corrective_cases.parts.approved",
        priority: 2,
        meta: {
          corrective_case_id: notifyTechnicalPartApproved.caseId,
          corrective_case_code: notifyTechnicalPartApproved.caseCode,
        },
      });
    }

    const detail = await getCorrectiveCaseDetail(caseId, actorUser);
    if (detailNeedsRefresh) return detail;
    return detail;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  ensureCorrectiveCaseTables,
  createCorrectiveCase,
  listCorrectiveCasesWorkspace,
  getCorrectiveCasesWorkspaceKpis,
  getCorrectiveCaseDetail,
  listCorrectiveCaseEvents,
  listCorrectiveCaseComments,
  addCorrectiveCaseComment,
  listCorrectiveCaseTimeline,
  listCorrectiveCaseEvidences,
  updateCorrectiveCaseAction,
};
