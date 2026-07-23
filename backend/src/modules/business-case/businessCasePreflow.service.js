const crypto = require("crypto");
const db = require("../../config/db");
const notificationManager = require("../notifications/notificationManager");
const businessCaseService = require("./businessCase.service");
const equipmentPurchasesService = require("../equipment-purchases/equipmentPurchases.service");
const privatePurchasesService = require("../private-purchases/privatePurchases.service");
const { BusinessCaseDataOwnership } = require("./businessCaseDataOwnership");

const REQUIRED_SECTIONS = ["general", "lab", "requirement", "equipment", "lis"];
const DEFAULT_DURATION_HOURS = 48;
const TECHNICAL_REVIEW_EXTENSION_HOURS = 24;
const REVIEW_ROLE_BY_TYPE = Object.freeze({
  public: "acp_comercial",
  comodato_publico: "acp_comercial",
  private_comodato: "jefe_comercial",
  comodato_privado: "jefe_comercial",
});
const MANAGER_ROLES = new Set(["jefe_comercial", "jefe_de_comercial", "gerencia", "gerencia_general"]);

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );

const normalizeUuid = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return isUuid(normalized) ? normalized : null;
};

const deterministicUuidFromLegacyId = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const hash = crypto.createHash("sha256").update(`legacy-user:${raw}`).digest("hex");
  const base = hash.slice(0, 32);
  return `${base.slice(0, 8)}-${base.slice(8, 12)}-${base.slice(12, 16)}-${base.slice(16, 20)}-${base.slice(20, 32)}`;
};

const resolveActorUuid = (user) =>
  normalizeUuid(user?.uuid || user?.sub || user?.user_uuid || user?.id || user?.user_id) ||
  deterministicUuidFromLegacyId(user?.id || user?.user_id || user?.sub || user?.email || "system");

function toObject(value, fallback = {}) {
  if (!value) return { ...fallback };
  if (typeof value === "object" && !Array.isArray(value)) return { ...value };
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  return { ...fallback };
}

function isPreflowCase(businessCase) {
  const metadata = toObject(businessCase?.modern_bc_metadata);
  const type = String(businessCase?.bc_purchase_type || "").toLowerCase();
  return Boolean(
    metadata.preflow_enabled ||
      type === "public" ||
      type === "private_comodato" ||
      type === "comodato_publico" ||
      type === "comodato_privado",
  );
}

function getRequiredSections(businessCase) {
  const metadata = toObject(businessCase?.modern_bc_metadata);
  if (Array.isArray(metadata.preflow_required_sections) && metadata.preflow_required_sections.length) {
    return metadata.preflow_required_sections;
  }
  return REQUIRED_SECTIONS;
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSectionList(sections = []) {
  if (!Array.isArray(sections)) return [];
  return [...new Set(
    sections
      .map((section) => String(section || "").trim().toLowerCase())
      .filter(Boolean),
  )];
}

function isTechnicalReviewExtension(request = {}) {
  return String(request?.phase || "").trim().toLowerCase() === "review"
    && normalizeRole(request?.role) === "jefe_servicio";
}

function roleToLabel(role) {
  const normalized = normalizeRole(role);
  if (normalized === "acp_comercial") return "Analista de Compras Publicas";
  if (normalized === "backoffice_comercial") return "Backoffice Comercial";
  if (normalized === "jefe_servicio") return "Jefe de Servicio";
  if (normalized === "jefe_tecnico") return "Jefe Tecnico";
  if (normalized === "jefe_comercial") return "Jefe Comercial";
  if (normalized === "comercial") return "Comercial";
  return normalized || "N/D";
}

function phaseToLabel(phase) {
  return String(phase || "").toLowerCase() === "review" ? "Revision" : "Comercial";
}

function buildStageWindow(key, label, role, stageData = {}, nowTs) {
  const deadlineTs = stageData?.deadlineAt ? new Date(stageData.deadlineAt).getTime() : null;
  return {
    key,
    label,
    role,
    roleLabel: roleToLabel(role),
    startedAt: stageData?.startedAt || null,
    deadlineAt: stageData?.deadlineAt || null,
    completedAt: stageData?.completedAt || null,
    elapsedSeconds: stageData?.elapsedSeconds ?? null,
    isActive: Boolean(stageData?.startedAt) && !stageData?.completedAt,
    isExpired: Number.isFinite(deadlineTs) ? nowTs > deadlineTs : false,
  };
}

function buildExtensionRequest(metadata = {}, activePhase = "commercial", activeRole = null) {
  const request = toObject(metadata?.preflow_reopen_request);
  if (!request || !request.status) return null;
  return {
    status: request.status,
    phase: request.phase || activePhase || null,
    phaseLabel: phaseToLabel(request.phase || activePhase),
    role: request.role || activeRole || null,
    roleLabel: roleToLabel(request.role || activeRole),
    requestedAt: request.requested_at || null,
    requestedByEmail: request.requested_by_email || null,
    requestedByRole: request.requested_by_role || null,
    reason: request.reason || "",
    sections: normalizeSectionList(request.sections),
    technicalSubsections: normalizeSectionList(request.technical_subsections),
    approvedAt: request.approved_at || null,
    approvedByEmail: request.approved_by_email || null,
    rejectedAt: request.rejected_at || null,
    rejectedByEmail: request.rejected_by_email || null,
    additionalHours: Number.isFinite(Number(request.additional_hours)) ? Number(request.additional_hours) : null,
    previousDeadlineAt: request.previous_deadline_at || null,
    newDeadlineAt: request.new_deadline_at || null,
    resolutionNotes: request.resolution_notes || "",
  };
}

function buildPreflowInfo(businessCase, ownershipRules = {}, now = new Date()) {
  if (!isPreflowCase(businessCase)) return { isActive: false, serverNow: now.toISOString() };

  const metadata = toObject(businessCase?.modern_bc_metadata);
  const requiredSections = getRequiredSections(businessCase);
  const activePhase =
    metadata.preflow_phase ||
    (metadata.preflow_review_started_at && !metadata.preflow_review_completed_at ? "review" : "commercial");

  const commercialStartedAt = metadata.preflow_commercial_started_at || metadata.preflow_started_at || null;
  const commercialDeadlineAt =
    metadata.preflow_commercial_deadline_at || metadata.preflow_deadline_at || null;
  const reviewStartedAt = metadata.preflow_review_started_at || null;
  const reviewDeadlineAt = metadata.preflow_review_deadline_at || null;
  const startedAt = activePhase === "review" ? reviewStartedAt : commercialStartedAt;
  const deadlineAt = activePhase === "review" ? reviewDeadlineAt : commercialDeadlineAt;
  const deadlineTs = deadlineAt ? new Date(deadlineAt).getTime() : null;
  const nowTs = now.getTime();
  const isExpired = Number.isFinite(deadlineTs) ? nowTs > deadlineTs : false;
  const completedRequiredSections = requiredSections.filter(
    (sectionKey) => ownershipRules?.[sectionKey]?.isCompleted,
  );
  const commercial = {
    startedAt: commercialStartedAt,
    deadlineAt: commercialDeadlineAt,
    completedAt: metadata.preflow_commercial_completed_at || null,
    elapsedSeconds: Number.isFinite(Number(metadata.preflow_commercial_elapsed_seconds))
      ? Number(metadata.preflow_commercial_elapsed_seconds)
      : null,
    role: metadata.preflow_commercial_role || "comercial",
  };
  const review = {
    startedAt: reviewStartedAt,
    deadlineAt: reviewDeadlineAt,
    completedAt: metadata.preflow_review_completed_at || null,
    role: metadata.preflow_review_role || resolveReviewRoleForBusinessCase(businessCase),
    elapsedSeconds: Number.isFinite(Number(metadata.preflow_review_elapsed_seconds))
      ? Number(metadata.preflow_review_elapsed_seconds)
      : null,
  };
  const extensionRequest = buildExtensionRequest(
    metadata,
    activePhase,
    activePhase === "review" ? review.role : commercial.role,
  );
  const postStatisticsSla = metadata.post_statistics_sla && typeof metadata.post_statistics_sla === "object"
    ? {
        ...metadata.post_statistics_sla,
        startedAt: metadata.post_statistics_sla.started_at || null,
        deadlineAt: metadata.post_statistics_sla.deadline_at || null,
        completedAt: metadata.post_statistics_sla.completed_at || null,
        status: metadata.post_statistics_sla.status || null,
      }
    : null;
  const stageWindows = [
    buildStageWindow("commercial", "Etapa Comercial", commercial.role, commercial, nowTs),
    buildStageWindow("review", "Etapa Revision", review.role, review, nowTs),
  ].filter((item) => item.startedAt || item.deadlineAt || item.completedAt || item.role);

  return {
    isActive: true,
    startedAt,
    deadlineAt,
    remainingSeconds: Number.isFinite(deadlineTs)
      ? Math.max(0, Math.floor((deadlineTs - nowTs) / 1000))
      : null,
    isExpired,
    requiredSections,
    completedRequiredSections,
    readyToStartProcess: completedRequiredSections.length === requiredSections.length && !isExpired,
    processCreated: Boolean(metadata.preflow_process_created),
    processType: metadata.preflow_process_type || null,
    processId: metadata.preflow_process_id || null,
    activePhase,
    activeRole:
      activePhase === "review"
        ? metadata.preflow_review_role || null
        : metadata.preflow_commercial_role || "comercial",
    activeRoleLabel: roleToLabel(
      activePhase === "review" ? metadata.preflow_review_role || null : metadata.preflow_commercial_role || "comercial",
    ),
    phaseLabel: phaseToLabel(activePhase),
    commercial,
    review,
    stageWindows,
    postStatisticsSla,
    extensionRequest,
    serverNow: now.toISOString(),
  };
}

function resolveReviewRoleForBusinessCase(businessCase) {
  const type = String(businessCase?.bc_purchase_type || "").toLowerCase();
  return REVIEW_ROLE_BY_TYPE[type] || null;
}

async function updateBusinessCaseMetadata(businessCaseId, metadataPatch = {}) {
  const { rows } = await db.query(
    `SELECT modern_bc_metadata FROM equipment_purchase_requests WHERE id = $1 LIMIT 1`,
    [businessCaseId],
  );
  const current = toObject(rows?.[0]?.modern_bc_metadata);
  const next = { ...current, ...metadataPatch };
  await db.query(
    `UPDATE equipment_purchase_requests
        SET modern_bc_metadata = $1::jsonb,
            updated_at = now()
      WHERE id = $2`,
    [JSON.stringify(next), businessCaseId],
  );
  return next;
}

function mapBusinessCaseEquipmentToRequestList(businessCase) {
  const source = Array.isArray(businessCase?.extra?.equipment_details)
    ? businessCase.extra.equipment_details
    : Array.isArray(businessCase?.equipment_details)
    ? businessCase.equipment_details
    : [];

  const items = [];
  source.forEach((pair) => {
    const primary = pair?.primary || (pair?.primary_id ? { id: pair.primary_id } : null);
    const backup = pair?.backup || (pair?.backup_id ? { id: pair.backup_id } : null);
    const primaryType = normalizeBcEquipmentType(pair?.primary_type || primary?.type);
    const backupType = normalizeBcEquipmentType(pair?.backup_type || backup?.type);

    if (primary?.id) {
      // primary_name viene de saveEquipmentDetailsV2 cuando está disponible
      items.push({ ...primary, _bc_type: primaryType, _resolved_name: pair?.primary_name || null });
    }
    if (backup?.id) {
      items.push({ ...backup, _bc_type: backupType, _resolved_name: pair?.backup_name || null });
    }
  });

  const byKey = new Map();
  items.forEach((item, index) => {
    const id = item?.id || null;
    const name = item?._resolved_name || item?.name || item?.modelo || item?.description || (id ? `Equipo ${id}` : `Equipo ${index + 1}`);
    const type = normalizeBcEquipmentType(item?._bc_type || item?.type);
    const key = `${id || "x"}-${name}-${type}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        id,
        name,
        sku: item?.code || item?.sku || null,
        type,
      });
    }
  });

  return Array.from(byKey.values()).filter((item) => item?.name);
}

function normalizeBcEquipmentType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "cu") return "cu";
  if (normalized === "new_import") return "new_import";
  if (["installed_client", "instalado_cliente", "installed", "instalado_en_cliente"].includes(normalized)) {
    return "installed_client";
  }
  return "new_available";
}

async function getDefaultAcpUser() {
  const { rows } = await db.query(
    `SELECT id, email, fullname, name
       FROM users
      WHERE role = 'acp_comercial'
        AND active = true
      ORDER BY id ASC
      LIMIT 1`,
  );
  return rows?.[0] || null;
}

async function withAdvisoryLock(lockKey, fn) {
  const key = `bc_preflow_${lockKey}`;
  const { rows } = await db.query(`SELECT pg_try_advisory_lock(hashtext($1)) AS ok`, [key]);
  const locked = Boolean(rows?.[0]?.ok);
  if (!locked) {
    return { ok: false, reason: "lock_busy" };
  }
  try {
    return await fn();
  } finally {
    await db.query(`SELECT pg_advisory_unlock(hashtext($1))`, [key]);
  }
}

async function ensurePreflowStarted(businessCaseId, durationHours = DEFAULT_DURATION_HOURS) {
  const bc = await businessCaseService.getBusinessCaseById(businessCaseId);
  if (!isPreflowCase(bc)) return toObject(bc?.modern_bc_metadata);

  const metadata = toObject(bc?.modern_bc_metadata);
  if (metadata.preflow_started_at) return metadata;

  const startedAt = new Date();
  const deadlineAt = new Date(startedAt.getTime() + durationHours * 60 * 60 * 1000);
  return updateBusinessCaseMetadata(businessCaseId, {
    preflow_started_at: startedAt.toISOString(),
    preflow_deadline_at: deadlineAt.toISOString(),
    preflow_phase: "commercial",
    preflow_commercial_role: "comercial",
    preflow_commercial_started_at: startedAt.toISOString(),
    preflow_commercial_deadline_at: deadlineAt.toISOString(),
    preflow_status: "in_progress",
  });
}

async function completeCommercialStageAndStartReview({
  businessCaseId,
  actorUser,
  durationHours = DEFAULT_DURATION_HOURS,
  reason = "stat_document_uploaded",
}) {
  return withAdvisoryLock(`${businessCaseId}:preflow:handoff`, async () => {
    const bc = await businessCaseService.getBusinessCaseById(businessCaseId);
    if (!isPreflowCase(bc)) return { skipped: true, reason: "not_preflow" };

    const reviewRole = resolveReviewRoleForBusinessCase(bc);
    if (!reviewRole) return { skipped: true, reason: "review_role_unresolved" };

    const metadata = toObject(bc?.modern_bc_metadata);
    if (metadata.preflow_review_started_at) {
      return {
        skipped: true,
        reason: "review_already_started",
        review_role: metadata.preflow_review_role || reviewRole,
        review_started_at: metadata.preflow_review_started_at,
      };
    }

    const now = new Date();
    const commercialStartedAt = metadata.preflow_commercial_started_at || metadata.preflow_started_at || null;
    const commercialStartTs = commercialStartedAt ? new Date(commercialStartedAt).getTime() : null;
    const commercialElapsedSeconds = Number.isFinite(commercialStartTs)
      ? Math.max(0, Math.floor((now.getTime() - commercialStartTs) / 1000))
      : null;
    const reviewDeadlineAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
    const actorUuid = resolveActorUuid(actorUser);
    const actorRole = String(actorUser?.role || actorUser?.scope || actorUser?.role_name || "comercial").toLowerCase();

    const nextMetadata = await updateBusinessCaseMetadata(businessCaseId, {
      preflow_phase: "review",
      preflow_status: "commercial_completed_review_in_progress",
      preflow_commercial_completed_at: now.toISOString(),
      preflow_commercial_completed_by_id: actorUser?.id ?? null,
      preflow_commercial_completed_by_email: actorUser?.email || null,
      preflow_commercial_elapsed_seconds: commercialElapsedSeconds,
      preflow_commercial_close_reason: reason,
      preflow_review_role: reviewRole,
      preflow_review_started_at: now.toISOString(),
      preflow_review_deadline_at: reviewDeadlineAt.toISOString(),
      preflow_deadline_at: reviewDeadlineAt.toISOString(),
      preflow_handoff_at: now.toISOString(),
      preflow_handoff_by_email: actorUser?.email || null,
      preflow_handoff_by_role: actorRole,
    });

    await db.query(
      `INSERT INTO business_case_section_ownership_audit
         (business_case_id, section_name, action, performed_by, performed_by_role, canonical_state, metadata, performed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        businessCaseId,
        "preflow",
        "commercial_stage_completed",
        actorUuid,
        actorRole,
        String(bc?.canonical_state || bc?.bc_stage || "draft"),
        JSON.stringify({
          reviewRole,
          commercialElapsedSeconds,
          reason,
        }),
        now,
      ],
    );

    return {
      updated: true,
      review_role: reviewRole,
      commercial_elapsed_seconds: commercialElapsedSeconds,
      review_deadline_at: reviewDeadlineAt.toISOString(),
      metadata: nextMetadata,
    };
  });
}

async function ensurePreflowWorkspaceProcess({ businessCaseId, actorUser, durationHours = DEFAULT_DURATION_HOURS }) {
  return withAdvisoryLock(businessCaseId, async () => {
    const bc = await businessCaseService.getBusinessCaseById(businessCaseId);
    if (!isPreflowCase(bc)) return { skipped: true, reason: "not_preflow" };

    const metadata = toObject(bc?.modern_bc_metadata);
    if (metadata.preflow_process_created && metadata.preflow_process_id) {
      return {
        skipped: true,
        reason: "already_created",
        process_id: metadata.preflow_process_id,
        process_type: metadata.preflow_process_type,
      };
    }

    const deadlineAt = metadata.preflow_deadline_at
      ? new Date(metadata.preflow_deadline_at)
      : new Date(Date.now() + durationHours * 60 * 60 * 1000);
    if (Number.isFinite(deadlineAt.getTime()) && Date.now() > deadlineAt.getTime()) {
      return { skipped: true, reason: "deadline_expired" };
    }

    const ownershipInfo = await BusinessCaseDataOwnership.getOwnershipInfo(businessCaseId);
    const requiredSections = getRequiredSections(bc);
    const completedRequired = requiredSections.filter((key) => Boolean(ownershipInfo?.[key]?.completedAt));
    if (completedRequired.length !== requiredSections.length) {
      return {
        skipped: true,
        reason: "incomplete_sections",
        completed: completedRequired,
        required: requiredSections,
      };
    }

    const purchaseType = String(bc?.bc_purchase_type || "").toLowerCase();
    const normalizedType = purchaseType === "comodato_privado" ? "private_comodato" : purchaseType;
    const clientName = String(bc?.client_name || "Cliente pendiente").trim();
    const equipment = mapBusinessCaseEquipmentToRequestList(bc);
    if (!equipment.length) return { skipped: true, reason: "equipment_missing" };

    let processId = null;
    let processType = null;

    if (normalizedType === "public" || normalizedType === "comodato_publico") {
      const { rows: existingRows } = await db.query(
        `SELECT id
           FROM equipment_purchase_requests
          WHERE request_type = 'purchase'
            AND extra->>'business_case_id' = $1
          LIMIT 1`,
        [businessCaseId],
      );
      processId = existingRows?.[0]?.id || null;
      processType = "public_purchase";

      if (!processId) {
        const acpUser = await getDefaultAcpUser();
        if (!acpUser?.id) return { skipped: true, reason: "missing_acp_assignee" };

        const created = await equipmentPurchasesService.createPurchaseRequest({
          user: actorUser,
          clientId: bc?.client_id || null,
          clientName,
          clientEmail: null,
          assignedTo: acpUser.id,
          equipment,
          notes: `Generada automaticamente desde Business Case ${businessCaseId}`,
          extra: {
            business_case_id: businessCaseId,
            preflow_origin: "business_case_workspace",
            preflow_kind: metadata.preflow_kind || null,
          },
          requestType: "purchase",
        });
        processId = created?.id || null;
      }
    } else if (normalizedType === "private_comodato") {
      const { rows: existingRows } = await db.query(
        `SELECT id
           FROM private_purchase_requests
          WHERE business_case_id = $1
          LIMIT 1`,
        [businessCaseId],
      );
      processId = existingRows?.[0]?.id || null;
      processType = "private_comodato";

      if (!processId) {
        const created = await privatePurchasesService.createPurchaseRequest({
          user: actorUser,
          clientData: {
            name: clientName,
            commercial_name: clientName,
            client_email: null,
            client_identifier: String(bc?.client_id || "").trim() || null,
          },
          equipment,
          offerKind: "comodato",
          notes: `Generada automaticamente desde Business Case ${businessCaseId}`,
          businessCaseId,
        });
        processId = created?.id || null;
      }
    } else {
      return { skipped: true, reason: "unsupported_preflow_type", type: normalizedType };
    }

    const nowIso = new Date().toISOString();
    const nextMetadata = await updateBusinessCaseMetadata(businessCaseId, {
      preflow_process_created: Boolean(processId),
      preflow_process_type: processType,
      preflow_process_id: processId,
      preflow_process_created_at: nowIso,
      preflow_status: "workspace_compras_created",
      preflow_inspection_coordination_required: true,
      preflow_inspection_coordination_required_at: nowIso,
    });

    await db.query(
      `INSERT INTO business_case_section_ownership_audit
         (business_case_id, section_name, action, performed_by, performed_by_role, canonical_state, metadata, performed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        businessCaseId,
        "preflow",
        "preflow_process_created",
        resolveActorUuid(actorUser),
        actorUser?.role || null,
        String(bc?.canonical_state || bc?.bc_stage || "draft"),
        JSON.stringify({ processId, processType, source: "workspace_preflow" }),
        new Date(),
      ],
    );

    const inspectRoles = processType === "public_purchase"
      ? ["jefe_tecnico", "jefe_servicio_tecnico", "acp_comercial", "jefe_comercial"]
      : ["jefe_tecnico", "jefe_servicio_tecnico", "backoffice_comercial", "jefe_comercial"];
    const flowSubjectPrefix = processType === "public_purchase"
      ? "Proceso de compra publica"
      : "Proceso de compra privada";
    const processCode = String(bc?.process_code || "").trim();
    const processSubject = processCode
      ? `${flowSubjectPrefix} - ${clientName} - ${processCode}`
      : `${flowSubjectPrefix} - ${clientName}`;
    const { rows: recipients } = await db.query(
      `SELECT id FROM users WHERE role = ANY($1) AND active = true`,
      [inspectRoles],
    );
    await Promise.all(
      (recipients || []).map((recipient) =>
        notificationManager
          .sendNotification({
            userId: recipient.id,
            customTitle: processSubject,
            customMessage: `Business Case ${businessCaseId} listo para coordinacion de inspeccion.`,
            type: "task",
            source: "business_case.preflow.inspection",
            priority: 2,
            email: true,
            chat: false,
            data: {
              email_subject: processSubject,
            },
            meta: {
              businessCaseId,
              processId,
              processType,
              process_key: `business_case:${businessCaseId}`,
            },
          })
          .catch(() => null),
      ),
    );

    return {
      created: true,
      process_id: processId,
      process_type: processType,
      metadata: nextMetadata,
      idempotency_key: crypto.createHash("sha256").update(String(businessCaseId)).digest("hex").slice(0, 16),
    };
  });
}

async function requestPreflowReopen({
  businessCaseId,
  actorUser,
  reason,
  sections = [],
}) {
  return withAdvisoryLock(`${businessCaseId}:preflow:reopen-request`, async () => {
    const bc = await businessCaseService.getBusinessCaseById(businessCaseId);
    if (!isPreflowCase(bc)) {
      const error = new Error("El Business Case no usa ventana preflow.");
      error.status = 409;
      throw error;
    }

    const preflowInfo = buildPreflowInfo(bc, {}, new Date());
    if (!preflowInfo?.isActive) {
      const error = new Error("No existe una ventana activa para solicitar reapertura.");
      error.status = 409;
      throw error;
    }
    if (!preflowInfo?.isExpired) {
      const error = new Error("La solicitud de reapertura solo aplica cuando la ventana actual ya vencio.");
      error.status = 409;
      throw error;
    }

    const actorRole = normalizeRole(actorUser?.role || actorUser?.scope || actorUser?.role_name);
    if (!actorRole || actorRole !== normalizeRole(preflowInfo.activeRole)) {
      const error = new Error("Solo el responsable de la etapa activa puede solicitar una reapertura.");
      error.status = 403;
      throw error;
    }

    const normalizedReason = String(reason || "").trim();
    if (!normalizedReason) {
      const error = new Error("Debes indicar la razon de la solicitud de reapertura.");
      error.status = 400;
      throw error;
    }

    const metadata = toObject(bc?.modern_bc_metadata);
    const currentRequest = buildExtensionRequest(metadata, preflowInfo.activePhase, preflowInfo.activeRole);
    if (currentRequest?.status === "pending") {
      const error = new Error("Ya existe una solicitud de reapertura pendiente para esta etapa.");
      error.status = 409;
      throw error;
    }

    const isTechnicalReview = preflowInfo.activePhase === "review"
      && normalizeRole(preflowInfo.activeRole) === "jefe_servicio";
    const normalizedSections = isTechnicalReview
      ? ["determinations"]
      : normalizeSectionList(sections);
    const now = new Date();
    const requestPayload = {
      status: "pending",
      phase: preflowInfo.activePhase,
      role: preflowInfo.activeRole,
      requested_at: now.toISOString(),
      requested_by_email: actorUser?.email || null,
      requested_by_role: actorRole,
      reason: normalizedReason,
      sections: normalizedSections,
      technical_subsections: isTechnicalReview ? ["controles", "calibradores", "materiales"] : [],
      previous_deadline_at: preflowInfo.deadlineAt || null,
    };
    const history = Array.isArray(metadata.preflow_reopen_history) ? metadata.preflow_reopen_history : [];
    const nextMetadata = await updateBusinessCaseMetadata(businessCaseId, {
      preflow_reopen_request: requestPayload,
      preflow_reopen_history: [
        ...history,
        {
          ...requestPayload,
          event: "requested",
        },
      ],
    });

    await db.query(
      `INSERT INTO business_case_section_ownership_audit
         (business_case_id, section_name, action, performed_by, performed_by_role, canonical_state, metadata, performed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        businessCaseId,
        "preflow",
        "preflow_reopen_requested",
        resolveActorUuid(actorUser),
        actorRole,
        String(bc?.canonical_state || bc?.bc_stage || "draft"),
        JSON.stringify({
          phase: preflowInfo.activePhase,
          role: preflowInfo.activeRole,
          reason: normalizedReason,
          sections: normalizedSections,
        }),
        now,
      ],
    );

    const { rows: recipients } = await db.query(
      `SELECT id
         FROM users
        WHERE role IN ('jefe_comercial', 'jefe_de_comercial')
          AND active = true`,
    );
    await Promise.all(
      (recipients || []).map((recipient) =>
        notificationManager.sendNotification({
          userId: recipient.id,
          customTitle: "Solicitud de reapertura Business Case",
          customMessage:
            `${actorUser?.email || "Un usuario"} solicito una prorroga de 24 horas para la etapa ${phaseToLabel(preflowInfo.activePhase)} del BC ${businessCaseId}. Justificacion: ${normalizedReason}`,
          type: "task",
          source: "business_case.preflow.reopen_request",
          priority: 2,
          email: true,
          chat: false,
          data: {
            email_subject: `Business Case ${businessCaseId} - Seguimiento de prorroga`,
            target_path: `/dashboard/business-case/workspace/${businessCaseId}`,
            cta_label: "Revisar Business Case",
          },
          meta: {
            businessCaseId,
            phase: preflowInfo.activePhase,
            role: preflowInfo.activeRole,
            requestedBy: actorUser?.email || null,
            process_key: `business_case:${businessCaseId}`,
            email_subject: `Business Case ${businessCaseId} - Seguimiento de prorroga`,
            target_path: `/dashboard/business-case/workspace/${businessCaseId}`,
            cta_label: "Revisar Business Case",
          },
        }).catch(() => null),
      ),
    );

    return {
      requested: true,
      metadata: nextMetadata,
      request: buildExtensionRequest(nextMetadata, preflowInfo.activePhase, preflowInfo.activeRole),
    };
  });
}

async function resolvePreflowReopen({
  businessCaseId,
  actorUser,
  approved,
  additionalHours = 0,
  notes = "",
  sections = [],
}) {
  return withAdvisoryLock(`${businessCaseId}:preflow:reopen-resolve`, async () => {
    const bc = await businessCaseService.getBusinessCaseById(businessCaseId);
    if (!isPreflowCase(bc)) {
      const error = new Error("El Business Case no usa ventana preflow.");
      error.status = 409;
      throw error;
    }

    const actorRole = normalizeRole(actorUser?.role || actorUser?.scope || actorUser?.role_name);
    if (!MANAGER_ROLES.has(actorRole)) {
      const error = new Error("No tienes permisos para resolver solicitudes de reapertura.");
      error.status = 403;
      throw error;
    }

    const metadata = toObject(bc?.modern_bc_metadata);
    const preflowInfo = buildPreflowInfo(bc, {}, new Date());
    const pendingRequest = buildExtensionRequest(metadata, preflowInfo.activePhase, preflowInfo.activeRole);
    if (!pendingRequest || pendingRequest.status !== "pending") {
      const error = new Error("No existe una solicitud pendiente para resolver.");
      error.status = 409;
      throw error;
    }

    const now = new Date();
    const history = Array.isArray(metadata.preflow_reopen_history) ? metadata.preflow_reopen_history : [];
    const normalizedNotes = String(notes || "").trim();
    const technicalReviewExtension = isTechnicalReviewExtension(pendingRequest);
    const requestedSections = technicalReviewExtension
      ? ["determinations"]
      : normalizeSectionList(pendingRequest.sections);
    const resolvedSections = technicalReviewExtension
      ? ["determinations"]
      : normalizeSectionList(sections).length
        ? normalizeSectionList(sections)
        : requestedSections;
    let nextMetadataPatch = {};
    let nextDeadlineAt = null;

    if (approved) {
      const parsedHours = technicalReviewExtension
        ? TECHNICAL_REVIEW_EXTENSION_HOURS
        : Number(additionalHours);
      if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
        const error = new Error("Debes indicar una cantidad valida de horas adicionales.");
        error.status = 400;
        throw error;
      }

      const currentDeadlineTs = preflowInfo?.deadlineAt ? new Date(preflowInfo.deadlineAt).getTime() : null;
      const baseTs = Number.isFinite(currentDeadlineTs) ? Math.max(currentDeadlineTs, now.getTime()) : now.getTime();
      nextDeadlineAt = new Date(baseTs + parsedHours * 60 * 60 * 1000).toISOString();

      nextMetadataPatch = {
        preflow_deadline_at: nextDeadlineAt,
        preflow_status: `${pendingRequest.phase || "commercial"}_reopened`,
        preflow_reopen_request: {
          ...toObject(metadata.preflow_reopen_request),
          status: "approved",
          approved_at: now.toISOString(),
          approved_by_email: actorUser?.email || null,
          approved_by_role: actorRole,
          additional_hours: parsedHours,
          sections: resolvedSections,
          resolution_notes: normalizedNotes,
          new_deadline_at: nextDeadlineAt,
        },
      };

      if ((pendingRequest.phase || "commercial") === "review") {
        nextMetadataPatch.preflow_review_deadline_at = nextDeadlineAt;
      } else {
        nextMetadataPatch.preflow_commercial_deadline_at = nextDeadlineAt;
      }

      if (technicalReviewExtension) {
        const currentGate = toObject(metadata?.determinations_gate);
        nextMetadataPatch.determinations_gate = {
          ...currentGate,
          deadline_at: nextDeadlineAt,
          review_deadline_at: nextDeadlineAt,
          is_expired: false,
          expired_at: null,
          expired_notified_at: null,
          updated_at: now.toISOString(),
        };
      }
    } else {
      nextMetadataPatch = {
        preflow_reopen_request: {
          ...toObject(metadata.preflow_reopen_request),
          status: "rejected",
          rejected_at: now.toISOString(),
          rejected_by_email: actorUser?.email || null,
          rejected_by_role: actorRole,
          resolution_notes: normalizedNotes,
        },
      };
    }

    let resolvedMetadata = await updateBusinessCaseMetadata(businessCaseId, {
      ...nextMetadataPatch,
      preflow_reopen_history: [
        ...history,
        {
          event: approved ? "approved" : "rejected",
          phase: pendingRequest.phase,
          role: pendingRequest.role,
          requested_at: pendingRequest.requestedAt,
          requested_by_email: pendingRequest.requestedByEmail,
          approved_at: approved ? now.toISOString() : null,
          approved_by_email: approved ? actorUser?.email || null : null,
          rejected_at: approved ? null : now.toISOString(),
          rejected_by_email: approved ? null : actorUser?.email || null,
          additional_hours: approved ? (technicalReviewExtension ? TECHNICAL_REVIEW_EXTENSION_HOURS : Number(additionalHours)) : null,
          sections: resolvedSections,
          reason: pendingRequest.reason || "",
          resolution_notes: normalizedNotes,
          previous_deadline_at: pendingRequest.previousDeadlineAt || preflowInfo.deadlineAt || null,
          new_deadline_at: nextDeadlineAt,
        },
      ],
    });

    if (approved && resolvedSections.length) {
      for (const section of resolvedSections) {
        await BusinessCaseDataOwnership.unlockSection(
          businessCaseId,
          section,
          actorUser,
          String(bc?.canonical_state || bc?.bc_stage || "draft"),
          {
            source: "preflow_reopen_approved",
            requested_by_email: pendingRequest.requestedByEmail || null,
            additional_hours: technicalReviewExtension ? TECHNICAL_REVIEW_EXTENSION_HOURS : Number(additionalHours),
            phase: pendingRequest.phase || null,
          },
        );
      }
    }

    // Al aprobar la prorroga de la etapa tecnica, la hoja oficial vuelve a ser
    // consultada inmediatamente. Solo se sincronizan controles, calibradores y
    // materiales: los reactivos ya fueron validados por ACP Comercial y no se
    // deben modificar durante este handoff.
    let sheetSync = null;
    if (approved && technicalReviewExtension) {
      try {
        sheetSync = await businessCaseService.syncConsumptionQuantitiesFromSheet(businessCaseId, {
          itemTypes: ["control", "calibrador", "consumible", "material"],
        });
      } catch (syncError) {
        sheetSync = {
          updated: 0,
          created: 0,
          items: null,
          ok: false,
          code: syncError?.code || "SHEET_SYNC_FAILED",
          message: syncError?.message || "No se pudo sincronizar desde Sheets",
        };
        logger.warn(
          { businessCaseId, error: syncError?.message || String(syncError), code: syncError?.code || null },
          "No se pudo sincronizar controles, calibradores y materiales tras aprobar la prorroga",
        );
      }

      resolvedMetadata = await updateBusinessCaseMetadata(businessCaseId, {
        preflow_reopen_request: {
          ...toObject(resolvedMetadata?.preflow_reopen_request),
          sheet_sync: {
            attempted_at: now.toISOString(),
            ok: sheetSync?.ok !== false,
            updated: Number(sheetSync?.updated || 0),
            created: Number(sheetSync?.created || 0),
            code: sheetSync?.code || null,
            message: sheetSync?.message || null,
            item_types: ["control", "calibrador", "consumible", "material"],
          },
        },
      });
    }

    await db.query(
      `INSERT INTO business_case_section_ownership_audit
         (business_case_id, section_name, action, performed_by, performed_by_role, canonical_state, metadata, performed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        businessCaseId,
        "preflow",
        approved ? "preflow_reopen_approved" : "preflow_reopen_rejected",
        resolveActorUuid(actorUser),
        actorRole,
        String(bc?.canonical_state || bc?.bc_stage || "draft"),
        JSON.stringify({
          phase: pendingRequest.phase || null,
          role: pendingRequest.role || null,
          additional_hours: approved ? Number(additionalHours) : null,
          sections: resolvedSections,
          notes: normalizedNotes,
          previous_deadline_at: pendingRequest.previousDeadlineAt || preflowInfo.deadlineAt || null,
          new_deadline_at: nextDeadlineAt,
        }),
        now,
      ],
    );

    if (pendingRequest.requestedByEmail) {
      const { rows: requesterRows } = await db.query(
        `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
        [pendingRequest.requestedByEmail],
      );
      const requesterId = requesterRows?.[0]?.id || null;
      if (requesterId) {
        await notificationManager.sendNotification({
          userId: requesterId,
          customTitle: approved ? "Reapertura aprobada" : "Reapertura rechazada",
          customMessage: approved
            ? `Se aprobo tu solicitud de prorroga del BC ${businessCaseId} con ${technicalReviewExtension ? TECHNICAL_REVIEW_EXTENSION_HOURS : Number(additionalHours)}h adicionales. Justificacion enviada: ${pendingRequest.reason || "No registrada"}. Respuesta de Jefe Comercial: ${normalizedNotes || "Sin comentarios adicionales"}.`
            : `Se rechazo tu solicitud de prorroga del BC ${businessCaseId}. Justificacion enviada: ${pendingRequest.reason || "No registrada"}. Respuesta de Jefe Comercial: ${normalizedNotes || "Sin comentarios adicionales"}.`,
          type: approved ? "success" : "alert",
          source: approved ? "business_case.preflow.reopen_approved" : "business_case.preflow.reopen_rejected",
          priority: 2,
          email: true,
          chat: false,
          data: {
            email_subject: `Business Case ${businessCaseId} - Seguimiento de prorroga`,
            target_path: `/dashboard/business-case/workspace/${businessCaseId}`,
            cta_label: "Abrir Business Case",
          },
          meta: {
            businessCaseId,
            phase: pendingRequest.phase || null,
            role: pendingRequest.role || null,
            approved,
            additionalHours: approved ? (technicalReviewExtension ? TECHNICAL_REVIEW_EXTENSION_HOURS : Number(additionalHours)) : null,
            process_key: `business_case:${businessCaseId}`,
            email_subject: `Business Case ${businessCaseId} - Seguimiento de prorroga`,
            target_path: `/dashboard/business-case/workspace/${businessCaseId}`,
            cta_label: "Abrir Business Case",
          },
        }).catch(() => null);
      }
    }

    return {
      resolved: true,
      approved: Boolean(approved),
      deadlineAt: nextDeadlineAt,
      metadata: resolvedMetadata,
      sheetSync,
      request: buildExtensionRequest(resolvedMetadata, pendingRequest.phase, pendingRequest.role),
    };
  });
}

module.exports = {
  DEFAULT_DURATION_HOURS,
  REQUIRED_SECTIONS,
  toObject,
  isPreflowCase,
  getRequiredSections,
  buildPreflowInfo,
  updateBusinessCaseMetadata,
  resolveReviewRoleForBusinessCase,
  ensurePreflowStarted,
  completeCommercialStageAndStartReview,
  ensurePreflowWorkspaceProcess,
  requestPreflowReopen,
  resolvePreflowReopen,
};
