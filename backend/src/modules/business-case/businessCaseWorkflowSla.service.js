const db = require("../../config/db");
const logger = require("../../config/logger");
const notificationManager = require("../notifications/notificationManager");

const POST_STATISTICS_SLA_HOURS = 48;
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

function buildProcessKey(businessCaseId) {
  return `business_case:${businessCaseId}`;
}

function buildEmailSubject(businessCaseId) {
  return `Business Case ${businessCaseId} - Seguimiento del proceso`;
}

function getDocumentUploadedAt(metadata = {}, documentUploadedAt = null) {
  return toValidDate(
    documentUploadedAt ||
      metadata?.post_statistics_sla?.started_at ||
      metadata?.determinations_gate?.document?.uploaded_at ||
      metadata?.determinations_gate?.enabled_at,
  );
}

function getFeasibilityDecision(metadata = {}) {
  const feasibility = toObject(metadata.feasibility);
  const decision = toObject(feasibility.decision);
  return decision.decided_at || feasibility.closed_at || null;
}

function getPostStatisticsSla(metadata = {}, documentUploadedAt = null) {
  const stored = toObject(metadata.post_statistics_sla);
  const startedAt = toValidDate(stored.started_at) || getDocumentUploadedAt(metadata, documentUploadedAt);
  if (!startedAt) return null;

  const deadlineAt = toValidDate(stored.deadline_at) ||
    new Date(startedAt.getTime() + POST_STATISTICS_SLA_HOURS * 60 * 60 * 1000);
  const status = getFeasibilityDecision(metadata)
    ? "completed"
    : String(stored.status || (Date.now() > deadlineAt.getTime() ? "overdue" : "active"));

  return {
    ...stored,
    started_at: startedAt.toISOString(),
    deadline_at: deadlineAt.toISOString(),
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

async function ensurePostStatisticsWindow({ businessCaseId, startedAt = null, documentUploadedAt = null }) {
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
    if (existingStarted) {
      await client.query("COMMIT");
      return {
        started: false,
        sla: getPostStatisticsSla(metadata, documentUploadedAt),
      };
    }

    const start = toValidDate(startedAt) || getDocumentUploadedAt(metadata, documentUploadedAt);
    if (!start) {
      await client.query("COMMIT");
      return { started: false, reason: "statistics_document_not_uploaded" };
    }

    const deadline = new Date(start.getTime() + POST_STATISTICS_SLA_HOURS * 60 * 60 * 1000);
    const nowIso = new Date().toISOString();
    const postStatisticsSla = {
      ...existing,
      started_at: start.toISOString(),
      deadline_at: deadline.toISOString(),
      status: getFeasibilityDecision(metadata) ? "completed" : "active",
      completed_at: existing.completed_at || null,
      completed_by_email: existing.completed_by_email || null,
      reminders: toObject(existing.reminders),
      notifications: toObject(existing.notifications),
      updated_at: nowIso,
    };

    const nextMetadata = {
      ...metadata,
      post_statistics_sla: postStatisticsSla,
      // Keep the legacy preflow/readiness fields aligned with the single
      // post-statistics deadline so old UI gates do not show another window.
      preflow_review_started_at: metadata.preflow_review_started_at || start.toISOString(),
      preflow_review_deadline_at: deadline.toISOString(),
      preflow_deadline_at: deadline.toISOString(),
      preflow_phase: "review",
      preflow_status: getFeasibilityDecision(metadata) ? "completed" : "post_statistics_in_progress",
      determinations_gate: {
        ...toObject(metadata.determinations_gate),
        deadline_at: deadline.toISOString(),
        review_deadline_at: deadline.toISOString(),
        post_statistics_sla_started_at: start.toISOString(),
        post_statistics_sla_deadline_at: deadline.toISOString(),
      },
    };

    await client.query(
      `UPDATE equipment_purchase_requests
          SET modern_bc_metadata = $1::jsonb,
              updated_at = NOW()
        WHERE id = $2`,
      [JSON.stringify(nextMetadata), businessCaseId],
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
      ORDER BY id`,
    [PARTICIPANT_ROLES, businessCase.created_by || null],
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

function getInvestmentCartStatus(metadata = {}) {
  const cart = toObject(metadata.investments_cart);
  const legacyConfirmed = Boolean(cart.confirmed);
  const legacyRole = normalizeRole(cart.confirmed_by_role);
  const legacyServiceConfirmation = legacyConfirmed && legacyRole === "jefe_servicio";
  return {
    acpConfirmed: Boolean(cart.acp_confirmed ?? cart.acpConfirmed ?? (legacyConfirmed && !legacyServiceConfirmation)),
    serviceConfirmed: Boolean(cart.service_confirmed ?? cart.serviceConfirmed ?? legacyServiceConfirmation),
  };
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

    const cart = getInvestmentCartStatus(metadata);
    if (cart.acpConfirmed && !cart.serviceConfirmed) {
      tasks.push({
        key: "service_investment_cart",
        label: "Cerrar el carrito de inversiones de Servicio",
        detail: "Revisa las inversiones propias y confirma el carrito de Servicio en el Business Case.",
        sheetRequired: false,
      });
    }
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
    const cart = getInvestmentCartStatus(metadata);
    const missingValues = cart.acpConfirmed && selectedInvestments.some(
      (item) => item.unit_price_financial === null || item.unit_price_financial === undefined,
    );
    if (missingValues) {
      tasks.push({
        key: "financial_investment_values",
        label: "Registrar valores financieros de las inversiones",
        detail: "Completa los precios financieros de los items del carrito ACP.",
        sheetRequired: false,
      });
    }
  }

  if (normalizedRole === "jefe_operaciones") {
    const cart = getInvestmentCartStatus(metadata);
    const missingValues = cart.serviceConfirmed && selectedInvestments.some(
      (item) => item.unit_price === null || item.unit_price === undefined,
    );
    if (missingValues) {
      tasks.push({
        key: "operational_investment_values",
        label: "Registrar valores operativos de las inversiones",
        detail: "Completa los precios operativos de los items del carrito General.",
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
  const cart = getInvestmentCartStatus(metadata);
  const selectedInvestments = investments.filter((item) => item.selected !== false);

  if (normalizedRole === "acp_comercial") {
    return locks.reactivos === true;
  }

  if (normalizedRole === "jefe_servicio") {
    return cart.serviceConfirmed && ["controles", "calibradores", "materiales"]
      .every((section) => locks[section] === true);
  }

  if (normalizedRole === "jefe_financiero") {
    return cart.acpConfirmed && selectedInvestments.every(
      (item) => item.unit_price_financial !== null && item.unit_price_financial !== undefined,
    );
  }

  if (normalizedRole === "jefe_operaciones") {
    return cart.serviceConfirmed && selectedInvestments.every(
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
        ORDER BY id`,
      [PARTICIPANT_ROLES, businessCase.created_by || null],
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
  const subject = buildEmailSubject(businessCaseId);
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
      : "48 horas desde la carga del documento de estadistica";
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
  const subject = buildEmailSubject(businessCaseId);
  const deadlineText = deadlineAt
    ? new Date(deadlineAt).toLocaleString("es-EC", { timeZone: process.env.APP_TIMEZONE || "America/Guayaquil" })
    : "48 horas desde la carga del documento de estadistica";

  const taskContext = await getPersonalPendingTaskContext(businessCaseId);
  const recipients = participants.filter((user) => {
    if (excludeActor && normalizedActor && String(user.email || "").trim().toLowerCase() === normalizedActor) {
      return false;
    }
    return !isParticipantStageComplete({
      role: user.role,
      metadata: toObject(businessCase.modern_bc_metadata),
      investments: taskContext.investments,
    });
  });

  await Promise.all(recipients.map((user) => notificationManager.sendNotification({
    userId: user.id,
    template: "custom_html",
    customTitle: title,
    customMessage: `${message} El SLA completo vence el ${deadlineText}.`,
    type,
    priority,
    email: true,
    chat: false,
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
  })));

  const personal = notifyPersonal
    ? await notifyPersonalPendingTasks({ businessCaseId, eventKey, actorEmail, excludeActor })
    : { sent: 0 };

  return { sent: true, recipientCount: recipients.length, personalRecipientCount: personal.sent, eventKey };
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
  const remainingHours = Math.max(0, (new Date(deadlineAt).getTime() - Date.now()) / 3600000);
  if (remainingHours > 0) {
    return `Recordatorio: el Business Case aun tiene pasos pendientes. Quedan aproximadamente ${formatHours(remainingHours)} para completar el flujo y registrar la factibilidad.`;
  }
  return `El SLA de 48 horas del Business Case vencio hace aproximadamente ${formatHours(elapsedHours - POST_STATISTICS_SLA_HOURS)}. Completa el flujo de inmediato y registra la factibilidad.`;
}

async function runReminderSweep() {
  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT e.id, e.modern_bc_metadata, d.uploaded_at
         FROM equipment_purchase_requests e
         LEFT JOIN LATERAL (
           SELECT uploaded_at
             FROM bc_determinations_documents
            WHERE business_case_id = e.id
              AND is_current = true
            ORDER BY uploaded_at DESC, id DESC
            LIMIT 1
         ) d ON true
        WHERE e.request_type = 'business_case'
          AND (e.modern_bc_metadata ? 'post_statistics_sla' OR d.uploaded_at IS NOT NULL)`
    ));
  } catch (error) {
    if (error?.code === "42P01") return { scanned: 0, sent: 0 };
    throw error;
  }

  let sent = 0;
  for (const row of rows || []) {
    try {
      const metadata = toObject(row.modern_bc_metadata);
      const existingSla = getPostStatisticsSla(metadata, row.uploaded_at);
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
      const elapsedHours = (Date.now() - startedAt.getTime()) / 3600000;
      const reminderCode = getReminderCode(elapsedHours);
      if (!reminderCode) continue;

      const ensured = await ensurePostStatisticsWindow({
        businessCaseId: row.id,
        documentUploadedAt: row.uploaded_at,
      });
      const currentSla = ensured.sla || existingSla;
      if (currentSla.completed_at || currentSla.status === "completed") continue;

      const reminderTitle = elapsedHours >= POST_STATISTICS_SLA_HOURS
        ? "SLA vencido: Business Case pendiente"
        : "Recordatorio de SLA: Business Case pendiente";
      const result = await notifyParticipants({
        businessCaseId: row.id,
        eventKey: `sla_reminder:${reminderCode}`,
        title: reminderTitle,
        message: buildReminderMessage({ elapsedHours, deadlineAt: currentSla.deadline_at }),
        actorEmail: null,
        excludeActor: false,
        type: elapsedHours >= POST_STATISTICS_SLA_HOURS ? "warning" : "alert",
        priority: elapsedHours >= POST_STATISTICS_SLA_HOURS ? 3 : 2,
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

      if (elapsedHours >= POST_STATISTICS_SLA_HOURS && currentSla.status !== "overdue") {
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
