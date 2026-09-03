const db = require("../../config/db");
const logger = require("../../config/logger");
const notificationManager = require("../notifications/notificationManager");

// Misma cuenta que manda los correos (delegada de Gmail) -- si un usuario de
// prueba tiene ese email con rol jefe_comercial/etc., no debe recibir sus
// propias notificaciones de BC como si fuera un participante real.
const { extractEmail } = require("../../utils/googleCredentials");
const SYSTEM_NOTIFICATION_EMAIL = extractEmail(
  process.env.SYSTEM_MAIL_ADDRESS ||
  process.env.NOTIFICATION_MAIL_ADDRESS ||
  process.env.GMAIL_SERVICE_ACCOUNT_SENDER ||
  process.env.SMTP_FROM ||
  "",
).toLowerCase();

const POST_STATISTICS_SLA_HOURS = 48;
const POST_STATISTICS_SLA_CALCULATION = "weekdays_only_v1";
const SLA_TIMEZONE_OFFSET_MINUTES = -5 * 60; // America/Guayaquil no usa DST.
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PARTICIPANT_ROLES = Object.freeze([
  "acp_comercial",
  "jefe_comercial",
  "jefe_servicio",
  "jefe_operaciones",
  "jefe_financiero",
  "jefe_ti",
  "contador",
]);
const REMINDER_OFFSETS_HOURS = Object.freeze([24, 36, 42, 46, 47, 48]);
const REMINDER_AFTER_DEADLINE_HOURS = 6;

function toObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return { ...value };
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }
  return {};
}

function toValidDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function toSlaLocalDate(date) {
  return new Date(date.getTime() + SLA_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
}

function fromSlaLocalDate(localDate) {
  return new Date(localDate.getTime() - SLA_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
}

function isWeekendForSla(date) {
  const local = toSlaLocalDate(date);
  const day = local.getUTCDay();
  return day === 0 || day === 6;
}

function startOfNextSlaLocalDay(date) {
  const local = toSlaLocalDate(date);
  const nextLocalMidnight = new Date(Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  ));
  return fromSlaLocalDate(nextLocalMidnight);
}

function moveToNextWeekday(date) {
  let cursor = new Date(date);
  while (isWeekendForSla(cursor)) {
    cursor = startOfNextSlaLocalDay(cursor);
  }
  return cursor;
}

function addWeekdayHours(startDate, hours) {
  let cursor = moveToNextWeekday(startDate);
  let remainingMs = Math.max(0, Number(hours) || 0) * HOUR_MS;

  while (remainingMs > 0) {
    cursor = moveToNextWeekday(cursor);
    const nextBoundary = startOfNextSlaLocalDay(cursor);
    const availableMs = Math.max(0, nextBoundary.getTime() - cursor.getTime());
    if (remainingMs <= availableMs) {
      return new Date(cursor.getTime() + remainingMs);
    }
    remainingMs -= availableMs;
    cursor = nextBoundary;
  }

  return cursor;
}

function countWeekdayHoursBetween(startDate, endDate) {
  const start = toValidDate(startDate);
  const end = toValidDate(endDate);
  if (!start || !end || end.getTime() <= start.getTime()) return 0;

  let cursor = new Date(start);
  let countedMs = 0;
  while (cursor.getTime() < end.getTime()) {
    if (isWeekendForSla(cursor)) {
      const nextWeekday = moveToNextWeekday(cursor);
      cursor = nextWeekday.getTime() > cursor.getTime() ? nextWeekday : startOfNextSlaLocalDay(cursor);
      continue;
    }

    const nextBoundary = startOfNextSlaLocalDay(cursor);
    const chunkEnd = new Date(Math.min(nextBoundary.getTime(), end.getTime()));
    countedMs += Math.max(0, chunkEnd.getTime() - cursor.getTime());
    cursor = chunkEnd;
  }

  return countedMs / HOUR_MS;
}

function getWeekdaySlaDeadline(startDate, hours = POST_STATISTICS_SLA_HOURS) {
  const start = toValidDate(startDate);
  if (!start) return null;
  return addWeekdayHours(start, hours);
}

function buildProcessKey(businessCaseId) {
  return `business_case:${businessCaseId}`;
}

function buildEmailSubject(businessCaseId, clientName = null) {
  return `Business Case ${clientName || businessCaseId} - Seguimiento del proceso`;
}

function getDeterminationsValidationAt(metadata = {}, explicitStartedAt = null) {
  const gate = toObject(metadata?.determinations_gate);
  const stored = toObject(metadata?.post_statistics_sla);
  const storedTrigger = String(stored.trigger || "").trim().toLowerCase();
  return toValidDate(
    explicitStartedAt ||
      gate?.completed_commercial_at ||
      gate?.reactivos_validated_at ||
      gate?.review_started_at ||
      (storedTrigger === "determinations_validated_service_handoff" ? stored.started_at : null),
  );
}

function getFeasibilityDecision(metadata = {}) {
  const feasibility = toObject(metadata.feasibility);
  const decision = toObject(feasibility.decision);
  return decision.decided_at || feasibility.closed_at || null;
}

function getPostStatisticsSla(metadata = {}, startedAt = null) {
  const stored = toObject(metadata.post_statistics_sla);
  const storedTrigger = String(stored.trigger || "").trim().toLowerCase();
  const canReuseStoredDeadline =
    storedTrigger === "determinations_validated_service_handoff" &&
    stored.calculation === POST_STATISTICS_SLA_CALCULATION;
  const resolvedStartedAt = getDeterminationsValidationAt(metadata, startedAt);
  if (!resolvedStartedAt) return null;

  const deadlineAt = (canReuseStoredDeadline ? toValidDate(stored.deadline_at) : null) ||
    getWeekdaySlaDeadline(resolvedStartedAt);
  const status = getFeasibilityDecision(metadata)
    ? "completed"
    : String(stored.status || (Date.now() > deadlineAt.getTime() ? "overdue" : "active"));

  return {
    ...stored,
    started_at: resolvedStartedAt.toISOString(),
    deadline_at: deadlineAt.toISOString(),
    calculation: POST_STATISTICS_SLA_CALCULATION,
    status,
    reminders: toObject(stored.reminders),
    notifications: toObject(stored.notifications),
  };
}

function getReminderCode(elapsedHours) {
  const elapsed = Number(elapsedHours);
  if (!Number.isFinite(elapsed) || elapsed < REMINDER_OFFSETS_HOURS[0]) return null;

  for (let index = REMINDER_OFFSETS_HOURS.length - 1; index >= 0; index -= 1) {
    const offset = REMINDER_OFFSETS_HOURS[index];
    const nextOffset = REMINDER_OFFSETS_HOURS[index + 1] || POST_STATISTICS_SLA_HOURS + 1;
    if (elapsed >= offset && elapsed < nextOffset) {
      return `at_${offset}h`;
    }
  }

  const overdueHours = Math.floor(elapsed - POST_STATISTICS_SLA_HOURS);
  return `overdue_${Math.floor(overdueHours / REMINDER_AFTER_DEADLINE_HOURS)}`;
}

function formatHours(value) {
  const hours = Math.max(0, Number(value) || 0);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remaining = Math.floor(hours % 24);
    return `${days}d ${remaining}h`;
  }
  return `${Math.floor(hours)}h`;
}

async function getBusinessCaseRow(businessCaseId, client = db) {
  const { rows } = await client.query(
    `SELECT id, client_name, created_by, modern_bc_metadata
       FROM equipment_purchase_requests
      WHERE id = $1
      LIMIT 1`,
    [businessCaseId],
  );
  return rows[0] || null;
}

async function ensurePostStatisticsWindow({ businessCaseId, startedAt = null, force = false }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const businessCase = await getBusinessCaseRow(businessCaseId, client);
    if (!businessCase) {
      await client.query("ROLLBACK");
      return { started: false, reason: "business_case_not_found" };
    }

    const metadata = toObject(businessCase.modern_bc_metadata);
    const existing = toObject(metadata.post_statistics_sla);
    const existingStarted = toValidDate(existing.started_at);
    const existingTrigger = String(existing.trigger || "").trim().toLowerCase();
    if (
      existingStarted &&
      existingTrigger === "determinations_validated_service_handoff" &&
      existing.calculation === POST_STATISTICS_SLA_CALCULATION &&
      !force
    ) {
      await client.query("COMMIT");
      return {
        started: false,
        sla: getPostStatisticsSla(metadata),
      };
    }

    const start = getDeterminationsValidationAt(metadata, startedAt);
    if (!start) {
      await client.query("COMMIT");
      return { started: false, reason: "determinations_validation_not_completed" };
    }

    const deadline = getWeekdaySlaDeadline(start);
    const nowIso = new Date().toISOString();
    const postStatisticsSla = {
      ...existing,
      started_at: start.toISOString(),
      deadline_at: deadline.toISOString(),
      status: getFeasibilityDecision(metadata) ? "completed" : "active",
      completed_at: existing.completed_at || null,
      completed_by_email: existing.completed_by_email || null,
      trigger: "determinations_validated_service_handoff",
      calculation: POST_STATISTICS_SLA_CALCULATION,
      reminders: toObject(existing.reminders),
      notifications: toObject(existing.notifications),
      updated_at: nowIso,
    };

    // Patch minimo + merge JSONB atomico (`||`) en vez de reemplazar todo
    // modern_bc_metadata -- evita perder cambios concurrentes en otras
    // claves top-level (mismo fix aplicado a updateBusinessCase /
    // updateBusinessCaseMetadata tras el bug de la prorroga de SLA perdida).
    // Tambien se dejaron de escribir determinations_gate.review_deadline_at /
    // post_statistics_sla_started_at / post_statistics_sla_deadline_at:
    // ningun lector los usa, eran copias muertas que solo podian
    // desincronizarse de sus fuentes reales.
    const metadataPatch = {
      post_statistics_sla: postStatisticsSla,
      // Keep the legacy preflow/readiness fields aligned with the single
      // post-statistics deadline so old UI gates do not show another window.
      preflow_review_started_at: metadata.preflow_review_started_at || start.toISOString(),
      preflow_review_deadline_at: deadline.toISOString(),
      preflow_deadline_at: deadline.toISOString(),
      preflow_phase: "review",
      preflow_status: getFeasibilityDecision(metadata) ? "completed" : "determinations_validated_service_handoff_in_progress",
      determinations_gate: {
        ...toObject(metadata.determinations_gate),
        deadline_at: deadline.toISOString(),
      },
    };

    await client.query(
      `UPDATE equipment_purchase_requests
          SET modern_bc_metadata = COALESCE(modern_bc_metadata, '{}'::jsonb) || $1::jsonb,
              updated_at = NOW()
        WHERE id = $2`,
      [JSON.stringify(metadataPatch), businessCaseId],
    );
    await client.query("COMMIT");
    return { started: true, sla: postStatisticsSla };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function claimMetadataKey({ businessCaseId, bucket, key, value }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const businessCase = await getBusinessCaseRow(businessCaseId, client);
    if (!businessCase) {
      await client.query("ROLLBACK");
      return { claimed: false, reason: "business_case_not_found" };
    }

    const metadata = toObject(businessCase.modern_bc_metadata);
    const sla = toObject(metadata.post_statistics_sla);
    if (!toValidDate(sla.started_at)) {
      await client.query("ROLLBACK");
      return { claimed: false, reason: "sla_not_started" };
    }
    const currentBucket = toObject(sla[bucket]);
    if (currentBucket[key]) {
      await client.query("ROLLBACK");
      return { claimed: false, reason: "already_claimed" };
    }

    const nextSla = {
      ...sla,
      [bucket]: {
        ...currentBucket,
        [key]: value,
      },
      updated_at: new Date().toISOString(),
    };
    await client.query(
      `UPDATE equipment_purchase_requests
          SET modern_bc_metadata = jsonb_set(modern_bc_metadata, '{post_statistics_sla}', $1::jsonb, true),
              updated_at = NOW()
        WHERE id = $2`,
      [JSON.stringify(nextSla), businessCaseId],
    );
    await client.query("COMMIT");
    return { claimed: true, businessCase, sla: nextSla };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deferWorkflowNotification({
  businessCaseId,
  eventKey,
  title,
  message,
  actorEmail = null,
  excludeActor = true,
  type = "alert",
  priority = 2,
  extraData = {},
  notifyPersonal = true,
}) {
  const event = {
    title,
    message,
    actorEmail,
    excludeActor,
    type,
    priority,
    extraData,
    notifyPersonal,
    deferred_at: new Date().toISOString(),
  };
  await db.query(
    `UPDATE equipment_purchase_requests
        SET modern_bc_metadata = jsonb_set(
          COALESCE(modern_bc_metadata, '{}'::jsonb),
          '{post_statistics_sla,deferred_workflow_events}',
          COALESCE(modern_bc_metadata->'post_statistics_sla'->'deferred_workflow_events', '{}'::jsonb) || $1::jsonb,
          true
        ),
            updated_at = NOW()
      WHERE id = $2`,
    [JSON.stringify({ [eventKey]: event }), businessCaseId],
  );
}

async function clearDeferredWorkflowNotification({ businessCaseId, eventKey }) {
  await db.query(
    `UPDATE equipment_purchase_requests
        SET modern_bc_metadata = jsonb_set(
          COALESCE(modern_bc_metadata, '{}'::jsonb),
          '{post_statistics_sla,deferred_workflow_events}',
          COALESCE(modern_bc_metadata->'post_statistics_sla'->'deferred_workflow_events', '{}'::jsonb) - $1,
          true
        ),
            updated_at = NOW()
      WHERE id = $2`,
    [eventKey, businessCaseId],
  );
}

async function getParticipants(businessCaseId) {
  const businessCase = await getBusinessCaseRow(businessCaseId);
  if (!businessCase) return { businessCase: null, participants: [] };

  const { rows } = await db.query(
    `SELECT id, email, fullname, role
       FROM users
      WHERE active = true
        AND (role = ANY($1::text[]) OR id = $2)
        AND ($3 = '' OR lower(email) <> $3)
      ORDER BY id`,
    [PARTICIPANT_ROLES, businessCase.created_by || null, SYSTEM_NOTIFICATION_EMAIL],
  );
  const unique = new Map();
  rows.forEach((user) => {
    const key = String(user.email || user.id).trim().toLowerCase();
    if (key && !unique.has(key)) unique.set(key, user);
  });
  return { businessCase, participants: Array.from(unique.values()) };
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeConsumptionType(value) {
  const raw = normalizeRole(value);
  if (raw === "reactivo" || raw === "reactivos" || raw === "determinacion") return "reactivos";
  if (raw === "control" || raw === "controles") return "controles";
  if (raw === "calibrador" || raw === "calibradores") return "calibradores";
  return "materiales";
}

function buildPersonalPendingTasks({ role, metadata = {}, consumptionItems = [], investments = [] }) {
  const normalizedRole = normalizeRole(role);
  const gate = toObject(metadata.determinations_gate);
  const locks = toObject(gate.section_locks);
  const tasks = [];
  const subsectionLabels = {
    controles: "controles",
    calibradores: "calibradores",
    materiales: "materiales",
  };

  if (normalizedRole === "jefe_servicio") {
    Object.entries(subsectionLabels).forEach(([subsection, label]) => {
      if (locks[subsection] === true) return;
      const items = consumptionItems.filter(
        (item) => normalizeConsumptionType(item.item_type) === subsection,
      );
      const missingAnnual = items.filter((item) => {
        const quantity = Number(item.annual_qty);
        return !Number.isFinite(quantity) || quantity <= 0;
      });
      const itemNames = missingAnnual
        .map((item) => String(item.name || "").trim())
        .filter(Boolean)
        .slice(0, 5);
      let detail = `Completa ${label} en el Sheet usando cantidades anuales y valida la seccion.`;
      if (!items.length) {
        detail = `Carga ${label} en el Sheet, registra sus cantidades anuales y valida la seccion.`;
      } else if (itemNames.length) {
        detail = `Completa cantidades anuales de ${itemNames.join(", ")} y valida la seccion.`;
      }
      tasks.push({
        key: `determinations_${subsection}`,
        label: `Completar ${label} en el Sheet con cantidades anuales`,
        detail,
        sheetRequired: true,
      });
    });
  }

  if (normalizedRole === "acp_comercial" && locks.reactivos !== true) {
    tasks.push({
      key: "determinations_reactivos",
      label: "Validar reactivos",
      detail: "Revisa la sincronizacion y valida la seccion de reactivos para habilitar el siguiente paso.",
      sheetRequired: true,
    });
  }

  const selectedInvestments = investments.filter((item) => item.selected !== false);
  if (normalizedRole === "jefe_financiero") {
    const missingValues = selectedInvestments.some(
      (item) => item.unit_price_financial === null || item.unit_price_financial === undefined,
    );
    if (missingValues) {
      tasks.push({
        key: "financial_investment_values",
        label: "Registrar valores financieros de las inversiones",
        detail: "Completa los precios financieros de las inversiones seleccionadas.",
        sheetRequired: false,
      });
    }
  }

  if (normalizedRole === "jefe_operaciones") {
    const missingValues = selectedInvestments.some(
      (item) => item.unit_price === null || item.unit_price === undefined,
    );
    if (missingValues) {
      tasks.push({
        key: "operational_investment_values",
        label: "Registrar valores operativos de las inversiones",
        detail: "Completa los precios operativos de las inversiones seleccionadas.",
        sheetRequired: false,
      });
    }
  }

  return tasks;
}

function isParticipantStageComplete({ role, metadata = {}, investments = [] }) {
  const normalizedRole = normalizeRole(role);
  const gate = toObject(metadata.determinations_gate);
  const locks = toObject(gate.section_locks);
  const selectedInvestments = investments.filter((item) => item.selected !== false);

  if (normalizedRole === "acp_comercial") {
    return locks.reactivos === true;
  }

  if (normalizedRole === "jefe_servicio") {
    return ["controles", "calibradores", "materiales"]
      .every((section) => locks[section] === true);
  }

  if (normalizedRole === "jefe_financiero") {
    return selectedInvestments.every(
      (item) => item.unit_price_financial !== null && item.unit_price_financial !== undefined,
    );
  }

  if (normalizedRole === "jefe_operaciones") {
    return selectedInvestments.every(
      (item) => item.unit_price !== null && item.unit_price !== undefined,
    );
  }

  if (normalizedRole === "jefe_comercial") {
    return Boolean(getFeasibilityDecision(metadata));
  }

  return false;
}

async function getPersonalPendingTaskContext(businessCaseId) {
  const { businessCase } = await getParticipants(businessCaseId);
  if (!businessCase) return { businessCase: null, participants: [], consumptionItems: [], investments: [] };

  const [consumptionResult, investmentResult, participantResult] = await Promise.all([
    db.query(
      `SELECT item_type, name, annual_qty
         FROM bc_consumption_items
        WHERE business_case_id = $1
        ORDER BY item_type, name`,
      [businessCaseId],
    ),
    db.query(
      `SELECT s.catalog_id, s.selected, s.quantity, s.unit_price, s.unit_price_financial,
              c.name, c.investment_class
         FROM bc_investment_selections s
         LEFT JOIN bc_investment_catalog c ON c.id = s.catalog_id
        WHERE s.business_case_id = $1
        ORDER BY c.name NULLS LAST, s.catalog_id`,
      [businessCaseId],
    ),
    db.query(
      `SELECT id, email, fullname, role
         FROM users
        WHERE active = true
          AND (role = ANY($1::text[]) OR id = $2)
          AND ($3 = '' OR lower(email) <> $3)
        ORDER BY id`,
      [PARTICIPANT_ROLES, businessCase.created_by || null, SYSTEM_NOTIFICATION_EMAIL],
    ),
  ]);

  return {
    businessCase,
    participants: participantResult.rows || [],
    consumptionItems: consumptionResult.rows || [],
    investments: investmentResult.rows || [],
  };
}

async function notifyPersonalPendingTasks({
  businessCaseId,
  eventKey,
  actorEmail = null,
  excludeActor = false,
}) {
  if (!notificationManager.getEmailScheduleState().allowed) {
    return { sent: 0, reason: "outside_email_schedule" };
  }
  const context = await getPersonalPendingTaskContext(businessCaseId);
  if (!context.businessCase) return { sent: 0, reason: "business_case_not_found" };

  const metadata = toObject(context.businessCase.modern_bc_metadata);
  const sla = getPostStatisticsSla(metadata);
  const deadlineAt = sla?.deadline_at || null;
  const sheetUrl = toObject(metadata)?.bc_sheet_generation?.last?.sheet_url || null;
  const targetPath = `/dashboard/business-case/workspace/${businessCaseId}`;
  const subject = buildEmailSubject(businessCaseId, context.businessCase.client_name);
  const normalizedActor = normalizeRole(actorEmail);
  let sent = 0;

  for (const participant of context.participants) {
    if (
      excludeActor &&
      normalizedActor &&
      normalizeRole(participant.email) === normalizedActor
    ) continue;

    const tasks = buildPersonalPendingTasks({
      role: participant.role,
      metadata,
      consumptionItems: context.consumptionItems,
      investments: context.investments,
    });
    if (!tasks.length) continue;

    const role = normalizeRole(participant.role) || "participante";
    const taskKey = tasks.map((task) => task.key).sort().join(",");
    const claim = await claimMetadataKey({
      businessCaseId,
      bucket: "personal_notifications",
      key: `${eventKey}:${role}:${taskKey}`,
      value: {
        notified_at: new Date().toISOString(),
        recipient_email: participant.email || null,
        task_keys: tasks.map((task) => task.key),
      },
    });
    if (!claim.claimed) continue;

    const taskText = tasks.map((task) => `${task.label}: ${task.detail}`).join(" ");
    const deadlineText = deadlineAt
      ? new Date(deadlineAt).toLocaleString("es-EC", { timeZone: process.env.APP_TIMEZONE || "America/Guayaquil" })
      : "48 horas desde la validacion de determinaciones";
    await notificationManager.sendNotification({
      userId: participant.id,
      template: "custom_html",
      customTitle: `Te falta completar pasos en ${context.businessCase.client_name || "Business Case"}`,
      customMessage: `Te falta realizar este paso en el Business Case: ${taskText} El SLA completo vence el ${deadlineText}.`,
      type: "alert",
      priority: 3,
      email: true,
      chat: false,
      source: `business_case.workflow.personal_pending.${eventKey}`,
      data: {
        business_case_id: businessCaseId,
        client_name: context.businessCase.client_name || "Cliente",
        target_path: targetPath,
        cta_label: "Abrir Business Case",
        secondary_cta_url: sheetUrl,
        secondary_cta_label: sheetUrl ? "Abrir Sheet oficial" : null,
        email_subject: subject,
        workflow_event: eventKey,
        pending_tasks: tasks,
        post_statistics_deadline_at: deadlineAt,
      },
      meta: {
        businessCaseId,
        process_key: buildProcessKey(businessCaseId),
        event: eventKey,
        recipient_role: role,
        pending_task_keys: tasks.map((task) => task.key),
        post_statistics_deadline_at: deadlineAt,
        target_path: targetPath,
        cta_label: "Abrir Business Case",
        email_subject: subject,
      },
    });
    sent += 1;
  }

  return { sent };
}

async function notifyParticipants({
  businessCaseId,
  eventKey,
  title,
  message,
  actorEmail = null,
  excludeActor = true,
  type = "alert",
  priority = 2,
  extraData = {},
  notifyPersonal = true,
}) {
  if (!notificationManager.getEmailScheduleState().allowed) {
    await deferWorkflowNotification({
      businessCaseId,
      eventKey,
      title,
      message,
      actorEmail,
      excludeActor,
      type,
      priority,
      extraData,
      notifyPersonal,
    });
    return { sent: false, reason: "outside_email_schedule" };
  }
  await ensurePostStatisticsWindow({ businessCaseId });
  const claim = await claimMetadataKey({
    businessCaseId,
    bucket: "notifications",
    key: eventKey,
    value: {
      notified_at: new Date().toISOString(),
      actor_email: actorEmail || null,
    },
  });
  if (!claim.claimed) return { sent: false, reason: claim.reason };

  const { businessCase, participants } = await getParticipants(businessCaseId);
  if (!businessCase) return { sent: false, reason: "business_case_not_found" };
  const normalizedActor = String(actorEmail || "").trim().toLowerCase();
  const sla = getPostStatisticsSla(toObject(businessCase.modern_bc_metadata));
  const deadlineAt = sla?.deadline_at || null;
  const sheetUrl = toObject(businessCase.modern_bc_metadata)?.bc_sheet_generation?.last?.sheet_url || null;
  const targetPath = `/dashboard/business-case/workspace/${businessCaseId}`;
  const subject = buildEmailSubject(businessCaseId, businessCase.client_name);
  const deadlineText = deadlineAt
    ? new Date(deadlineAt).toLocaleString("es-EC", { timeZone: process.env.APP_TIMEZONE || "America/Guayaquil" })
    : "48 horas desde la validacion de determinaciones";

  const taskContext = await getPersonalPendingTaskContext(businessCaseId);
  const metadata = toObject(businessCase.modern_bc_metadata);
  const recipients = participants.filter((user) => {
    if (excludeActor && normalizedActor && String(user.email || "").trim().toLowerCase() === normalizedActor) {
      return false;
    }
    return !isParticipantStageComplete({
      role: user.role,
      metadata,
      investments: taskContext.investments,
    });
  });
  if (!recipients.length) return { sent: false, reason: "no_recipients" };

  // Un solo hilo de correo compartido por BC: to=creador (o el primero si el
  // creador no quedo entre los recipients), cc=el resto. Antes se mandaba un
  // correo 1:1 por persona (N hilos privados) -- mismo patron ya probado en
  // resolveBusinessCaseMailingList (businessCase.controller.js).
  const primary = recipients.find((u) => u.id === businessCase.created_by) || recipients[0];
  const ccEmails = [...new Set(
    recipients
      .filter((u) => u.id !== primary.id)
      .map((u) => String(u.email || "").trim().toLowerCase())
      .filter(Boolean),
  )];

  // Tareas pendientes por persona, fusionadas en el mismo correo grupal (ya
  // no un segundo correo privado via notifyPersonalPendingTasks) -- el
  // equipo entero ve que le falta a cada quien.
  let pendingSection = "";
  if (notifyPersonal) {
    const perPerson = recipients
      .map((user) => {
        const tasks = buildPersonalPendingTasks({
          role: user.role,
          metadata,
          consumptionItems: taskContext.consumptionItems,
          investments: taskContext.investments,
        });
        if (!tasks.length) return null;
        const name = user.fullname || user.email || "Participante";
        return `${name} (${normalizeRole(user.role) || "participante"}): ${tasks.map((t) => t.label).join("; ")}.`;
      })
      .filter(Boolean);
    if (perPerson.length) {
      pendingSection = ` Pendientes por persona: ${perPerson.join(" | ")}`;
    }
  }

  const customMessage = `${message} El SLA completo vence el ${deadlineText}.${pendingSection}`;
  const commonPayload = {
    template: "custom_html",
    customTitle: title,
    customMessage,
    type,
    priority,
    source: `business_case.workflow.${eventKey}`,
    data: {
      business_case_id: businessCaseId,
      client_name: businessCase.client_name || "Cliente",
      target_path: targetPath,
      cta_label: "Abrir Business Case",
      secondary_cta_url: sheetUrl,
      secondary_cta_label: "Abrir Sheet oficial",
      email_subject: subject,
      workflow_event: eventKey,
      post_statistics_deadline_at: deadlineAt,
      ...extraData,
    },
    meta: {
      businessCaseId,
      process_key: buildProcessKey(businessCaseId),
      event: eventKey,
      actor_email: actorEmail || null,
      post_statistics_deadline_at: deadlineAt,
      target_path: targetPath,
      cta_label: "Abrir Business Case",
      email_subject: subject,
    },
  };

  await notificationManager.sendNotification({
    ...commonPayload,
    userId: primary.id,
    email: true,
    chat: false,
    data: { ...commonPayload.data, email_to: primary.email, email_cc: ccEmails },
    meta: { ...commonPayload.meta, email_to: primary.email, email_cc: ccEmails },
  });

  // El resto queda en cc del correo (ya lo recibio), pero igual necesita su
  // propia fila en `notifications` para verlo en la campanita/historial.
  await Promise.all(
    recipients
      .filter((user) => user.id !== primary.id)
      .map((user) => notificationManager.sendNotification({
        ...commonPayload,
        userId: user.id,
        email: false,
        chat: false,
      })),
  );

  return { sent: true, recipientCount: recipients.length, eventKey };
}

async function claimNotificationEvent({ businessCaseId, eventKey, actorEmail = null }) {
  return claimMetadataKey({
    businessCaseId,
    bucket: "notifications",
    key: eventKey,
    value: {
      notified_at: new Date().toISOString(),
      actor_email: actorEmail || null,
    },
  });
}

async function markCompleted({ businessCaseId, actorEmail = null }) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const businessCase = await getBusinessCaseRow(businessCaseId, client);
    if (!businessCase) {
      await client.query("ROLLBACK");
      return { completed: false, reason: "business_case_not_found" };
    }
    const metadata = toObject(businessCase.modern_bc_metadata);
    const sla = toObject(metadata.post_statistics_sla);
    if (!sla.started_at || sla.completed_at) {
      await client.query("COMMIT");
      return { completed: Boolean(sla.completed_at), reason: sla.completed_at ? "already_completed" : "sla_not_started" };
    }
    const nowIso = new Date().toISOString();
    const nextSla = {
      ...sla,
      status: "completed",
      completed_at: nowIso,
      completed_by_email: actorEmail || null,
      updated_at: nowIso,
    };
    const nextMetadata = {
      ...metadata,
      post_statistics_sla: nextSla,
      preflow_status: "completed",
    };
    await client.query(
      `UPDATE equipment_purchase_requests
          SET modern_bc_metadata = $1::jsonb,
              updated_at = NOW()
        WHERE id = $2`,
      [JSON.stringify(nextMetadata), businessCaseId],
    );
    await client.query("COMMIT");
    return { completed: true, sla: nextSla };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function buildReminderMessage({ elapsedHours, deadlineAt }) {
  const remainingHours = Math.max(0, countWeekdayHoursBetween(new Date(), deadlineAt));
  if (remainingHours > 0) {
    return `Recordatorio: el Business Case aun tiene pasos pendientes. Quedan aproximadamente ${formatHours(remainingHours)} habiles para completar el flujo y registrar la factibilidad.`;
  }
  return `El SLA de 48 horas habiles del Business Case vencio hace aproximadamente ${formatHours(elapsedHours - POST_STATISTICS_SLA_HOURS)} habiles. Completa el flujo de inmediato y registra la factibilidad.`;
}

async function runReminderSweep() {
  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT e.id, e.modern_bc_metadata
         FROM equipment_purchase_requests e
        WHERE e.request_type = 'business_case'
          AND (
            e.modern_bc_metadata ? 'post_statistics_sla'
            OR e.modern_bc_metadata->'determinations_gate'->>'completed_commercial_at' IS NOT NULL
          )`
    ));
  } catch (error) {
    if (error?.code === "42P01") return { scanned: 0, sent: 0 };
    throw error;
  }

  let sent = 0;
  for (const row of rows || []) {
    try {
      const metadata = toObject(row.modern_bc_metadata);
      const existingSla = getPostStatisticsSla(metadata);
      if (!existingSla) continue;

      const deferredEvents = toObject(existingSla.deferred_workflow_events);
      for (const [eventKey, event] of Object.entries(deferredEvents)) {
        const result = await notifyParticipants({
          businessCaseId: row.id,
          eventKey,
          title: event.title,
          message: event.message,
          actorEmail: event.actorEmail || null,
          excludeActor: event.excludeActor !== false,
          type: event.type || "alert",
          priority: event.priority ?? 2,
          extraData: toObject(event.extraData),
          notifyPersonal: event.notifyPersonal !== false,
        });
        if (result.sent || result.reason === "already_claimed") {
          await clearDeferredWorkflowNotification({ businessCaseId: row.id, eventKey });
          sent += result.sent ? 1 : 0;
        }
      }

      if (existingSla.completed_at || existingSla.status === "completed") continue;

      const startedAt = new Date(existingSla.started_at);
      const deadlineAt = new Date(existingSla.deadline_at);
      const now = new Date();
      const elapsedHours = countWeekdayHoursBetween(startedAt, now);
      const reminderCode = getReminderCode(elapsedHours);
      if (!reminderCode) continue;

      const ensured = await ensurePostStatisticsWindow({
        businessCaseId: row.id,
      });
      const currentSla = ensured.sla || existingSla;
      if (currentSla.completed_at || currentSla.status === "completed") continue;

      const isOverdue = now.getTime() >= new Date(currentSla.deadline_at).getTime();
      const reminderTitle = isOverdue
        ? "SLA vencido: Business Case pendiente"
        : "Recordatorio de SLA: Business Case pendiente";
      const result = await notifyParticipants({
        businessCaseId: row.id,
        eventKey: `sla_reminder:${reminderCode}`,
        title: reminderTitle,
        message: buildReminderMessage({ elapsedHours, deadlineAt: currentSla.deadline_at }),
        actorEmail: null,
        excludeActor: false,
        type: isOverdue ? "warning" : "alert",
        priority: isOverdue ? 3 : 2,
        notifyPersonal: false,
        extraData: {
          reminder_code: reminderCode,
          elapsed_hours: elapsedHours,
        },
      });
      if (result.sent) sent += 1;
      const personal = await notifyPersonalPendingTasks({
        businessCaseId: row.id,
        eventKey: `sla_reminder:${reminderCode}`,
      });
      sent += personal.sent;

      if (isOverdue && currentSla.status !== "overdue") {
        await db.query(
          `UPDATE equipment_purchase_requests
              SET modern_bc_metadata = jsonb_set(
                modern_bc_metadata,
                '{post_statistics_sla,status}',
                '"overdue"'::jsonb,
                true
              ), updated_at = NOW()
            WHERE id = $1`,
          [row.id],
        );
      }
    } catch (error) {
      logger.warn({ businessCaseId: row.id, error: error.message }, "No se pudo procesar recordatorio SLA de Business Case");
    }
  }

  return { scanned: rows?.length || 0, sent };
}

module.exports = {
  POST_STATISTICS_SLA_HOURS,
  PARTICIPANT_ROLES,
  REMINDER_OFFSETS_HOURS,
  REMINDER_AFTER_DEADLINE_HOURS,
  buildProcessKey,
  buildEmailSubject,
  addWeekdayHours,
  countWeekdayHoursBetween,
  getPostStatisticsSla,
  getReminderCode,
  buildPersonalPendingTasks,
  isParticipantStageComplete,
  ensurePostStatisticsWindow,
  claimNotificationEvent,
  notifyParticipants,
  notifyPersonalPendingTasks,
  deferWorkflowNotification,
  markCompleted,
  runReminderSweep,
};
