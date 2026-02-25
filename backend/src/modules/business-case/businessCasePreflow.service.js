const crypto = require("crypto");
const db = require("../../config/db");
const notificationManager = require("../notifications/notificationManager");
const businessCaseService = require("./businessCase.service");
const equipmentPurchasesService = require("../equipment-purchases/equipmentPurchases.service");
const privatePurchasesService = require("../private-purchases/privatePurchases.service");
const { BusinessCaseDataOwnership } = require("./businessCaseDataOwnership");

const REQUIRED_SECTIONS = ["general", "lab", "requirement", "equipment", "lis"];
const DEFAULT_DURATION_HOURS = 48;
const REVIEW_ROLE_BY_TYPE = Object.freeze({
  public: "acp_comercial",
  comodato_publico: "acp_comercial",
  private_comodato: "backoffice_comercial",
  comodato_privado: "backoffice_comercial",
});

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
    phaseLabel: activePhase === "review" ? "Revision" : "Comercial",
    commercial: {
      startedAt: commercialStartedAt,
      deadlineAt: commercialDeadlineAt,
      completedAt: metadata.preflow_commercial_completed_at || null,
      elapsedSeconds: Number.isFinite(Number(metadata.preflow_commercial_elapsed_seconds))
        ? Number(metadata.preflow_commercial_elapsed_seconds)
        : null,
    },
    review: {
      startedAt: reviewStartedAt,
      deadlineAt: reviewDeadlineAt,
      completedAt: metadata.preflow_review_completed_at || null,
      role: metadata.preflow_review_role || null,
      elapsedSeconds: Number.isFinite(Number(metadata.preflow_review_elapsed_seconds))
        ? Number(metadata.preflow_review_elapsed_seconds)
        : null,
    },
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
      items.push({ ...primary, _bc_type: primaryType });
    }
    if (backup?.id) {
      items.push({ ...backup, _bc_type: backupType });
    }
  });

  const byKey = new Map();
  items.forEach((item, index) => {
    const id = item?.id || null;
    const name = item?.name || item?.modelo || item?.description || (id ? `Equipo ${id}` : `Equipo ${index + 1}`);
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
    const { rows: recipients } = await db.query(
      `SELECT id FROM users WHERE role = ANY($1) AND active = true`,
      [inspectRoles],
    );
    await Promise.all(
      (recipients || []).map((recipient) =>
        notificationManager
          .sendNotification({
            userId: recipient.id,
            customTitle: "Coordinar solicitud de inspeccion de ambiente",
            customMessage: `Business Case ${businessCaseId} listo para coordinacion de inspeccion.`,
            type: "task",
            source: "business_case.preflow.inspection",
            priority: 2,
            email: true,
            chat: false,
            meta: { businessCaseId, processId, processType },
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
};
