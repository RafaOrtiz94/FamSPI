const db = require("../../config/db");
const notificationsService = require("../notifications/notifications.service");

const TICKET_TYPES = new Set(["fallo", "implementacion", "requerimiento", "problema"]);
const TICKET_PRIORITIES = new Set(["baja", "media", "alta", "critica"]);
const TICKET_STATUSES = new Set(["abierto", "triage", "en_progreso", "en_espera", "resuelto", "cerrado", "reabierto"]);
const TI_ROLES = [
  "ti",
  "jefe_ti",
  "admin_ti",
  "jefe_de_ti",
  "tecnico",
  "jefe_tecnico",
  "servicio_tecnico",
  "jefe_servicio_tecnico",
];
const STATUS_ALIASES = {
  terminado: "resuelto",
};

const ALLOWED_LVL = new Set(["bajo", "medio", "alto"]);
const COMMENT_VISIBILITY = new Set(["public", "internal"]);
let supportSchemaReadyPromise = null;

const SLA_HOURS_BY_PRIORITY = {
  critica: { response: 1, resolution: 8 },
  alta: { response: 4, resolution: 24 },
  media: { response: 8, resolution: 72 },
  baja: { response: 24, resolution: 120 },
};

const ALLOWED_TRANSITIONS = {
  abierto: new Set(["triage", "en_progreso", "en_espera", "resuelto", "cerrado"]),
  triage: new Set(["en_progreso", "en_espera", "resuelto", "cerrado"]),
  en_progreso: new Set(["en_espera", "resuelto", "cerrado"]),
  en_espera: new Set(["triage", "en_progreso", "resuelto", "cerrado"]),
  resuelto: new Set(["cerrado", "reabierto"]),
  cerrado: new Set(["reabierto"]),
  reabierto: new Set(["triage", "en_progreso", "en_espera", "resuelto", "cerrado"]),
};

const normalize = (value) => String(value || "").trim().toLowerCase();
const normalizeStatus = (value) => STATUS_ALIASES[normalize(value)] || normalize(value);

async function ensureSupportSchema() {
  if (supportSchemaReadyPromise) return supportSchemaReadyPromise;

  supportSchemaReadyPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id BIGSERIAL PRIMARY KEY,
        code VARCHAR(24) UNIQUE,
        requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_ti_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ticket_type VARCHAR(20) NOT NULL CHECK (ticket_type IN ('fallo', 'implementacion', 'requerimiento', 'problema')),
        title VARCHAR(180) NOT NULL,
        description TEXT NOT NULL,
        priority VARCHAR(10) NOT NULL DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta', 'critica')),
        status VARCHAR(20) NOT NULL DEFAULT 'abierto',
        impact VARCHAR(10) NOT NULL DEFAULT 'medio',
        urgency VARCHAR(10) NOT NULL DEFAULT 'medio',
        category VARCHAR(100),
        subcategory VARCHAR(100),
        first_response_at TIMESTAMPTZ,
        first_response_due_at TIMESTAMPTZ,
        resolution_due_at TIMESTAMPTZ,
        sla_response_breached BOOLEAN NOT NULL DEFAULT FALSE,
        sla_resolution_breached BOOLEAN NOT NULL DEFAULT FALSE,
        on_hold_reason TEXT,
        reopened_count INTEGER NOT NULL DEFAULT 0,
        last_reopened_at TIMESTAMPTZ,
        closed_by_requester BOOLEAN NOT NULL DEFAULT FALSE,
        satisfaction_score SMALLINT,
        satisfaction_comment TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      );
    `);

    await db.query(`
      ALTER TABLE support_tickets
        ADD COLUMN IF NOT EXISTS impact VARCHAR(10) NOT NULL DEFAULT 'medio',
        ADD COLUMN IF NOT EXISTS urgency VARCHAR(10) NOT NULL DEFAULT 'medio',
        ADD COLUMN IF NOT EXISTS category VARCHAR(100),
        ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100),
        ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS sla_response_breached BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS sla_resolution_breached BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS on_hold_reason TEXT,
        ADD COLUMN IF NOT EXISTS reopened_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_reopened_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS closed_by_requester BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS satisfaction_score SMALLINT,
        ADD COLUMN IF NOT EXISTS satisfaction_comment TEXT;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS support_ticket_events (
        id BIGSERIAL PRIMARY KEY,
        ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        event_type VARCHAR(30) NOT NULL,
        old_status VARCHAR(20),
        new_status VARCHAR(20),
        comment TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS support_ticket_comments (
        id BIGSERIAL PRIMARY KEY,
        ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        visibility VARCHAR(10) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal')),
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.query(`
      DO $$
      BEGIN
        ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
        ALTER TABLE support_tickets
          ADD CONSTRAINT support_tickets_status_check
          CHECK (status IN ('abierto', 'triage', 'en_progreso', 'en_espera', 'resuelto', 'cerrado', 'reabierto'));
      EXCEPTION WHEN duplicate_object THEN
        NULL;
      END $$;
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_requester_id ON support_tickets(requester_id);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_ti ON support_tickets(assigned_ti_user_id);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_type ON support_tickets(ticket_type);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_response_due ON support_tickets(first_response_due_at);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_resolution_due ON support_tickets(resolution_due_at);
      CREATE INDEX IF NOT EXISTS idx_support_ticket_events_ticket_id ON support_ticket_events(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_support_ticket_comments_ticket ON support_ticket_comments(ticket_id, created_at DESC);
    `);
  })().catch((error) => {
    supportSchemaReadyPromise = null;
    throw error;
  });

  return supportSchemaReadyPromise;
}

const normalizeRoleList = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalize).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map(normalize)
    .filter(Boolean);
};

const isTIUser = (user = {}) => {
  const merged = new Set([
    ...normalizeRoleList(user.role),
    ...normalizeRoleList(user.scope),
    ...normalizeRoleList(user.role_name),
  ]);
  return Array.from(merged).some((role) => TI_ROLES.includes(role));
};

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const mapRow = (row) => ({
  id: Number(row.id),
  code: row.code,
  ticket_type: row.ticket_type,
  title: row.title,
  description: row.description,
  priority: row.priority,
  impact: row.impact,
  urgency: row.urgency,
  category: row.category,
  subcategory: row.subcategory,
  status: row.status,
  requester_id: row.requester_id,
  requester_name: row.requester_name,
  requester_email: row.requester_email,
  assigned_ti_user_id: row.assigned_ti_user_id,
  assigned_ti_name: row.assigned_ti_name,
  assigned_ti_email: row.assigned_ti_email,
  created_at: row.created_at,
  updated_at: row.updated_at,
  resolved_at: row.resolved_at,
  first_response_at: row.first_response_at || null,
  first_response_due_at: row.first_response_due_at || null,
  resolution_due_at: row.resolution_due_at || null,
  sla_response_breached: Boolean(row.sla_response_breached),
  sla_resolution_breached: Boolean(row.sla_resolution_breached),
  on_hold_reason: row.on_hold_reason || null,
  reopened_count: Number(row.reopened_count || 0),
  last_reopened_at: row.last_reopened_at || null,
  closed_by_requester: Boolean(row.closed_by_requester),
  satisfaction_score: toNumber(row.satisfaction_score),
  satisfaction_comment: row.satisfaction_comment || null,
  first_assigned_at: row.first_assigned_at || null,
  first_in_progress_at: row.first_in_progress_at || null,
  first_resolved_at: row.first_resolved_at || null,
  response_minutes: toNumber(row.response_minutes),
  cycle_minutes: toNumber(row.cycle_minutes),
  delivery_minutes: toNumber(row.delivery_minutes),
  sla_response_overdue: Boolean(row.sla_response_overdue),
  sla_resolution_overdue: Boolean(row.sla_resolution_overdue),
  comments_count: toNumber(row.comments_count) || 0,
});

const mapEventRow = (row) => ({
  id: Number(row.id),
  ticket_id: Number(row.ticket_id),
  actor_user_id: row.actor_user_id,
  actor_name: row.actor_name,
  event_type: row.event_type,
  old_status: row.old_status,
  new_status: row.new_status,
  comment: row.comment,
  created_at: row.created_at,
});

const mapCommentRow = (row) => ({
  id: Number(row.id),
  ticket_id: Number(row.ticket_id),
  author_user_id: row.author_user_id,
  author_name: row.author_name,
  author_email: row.author_email,
  visibility: row.visibility,
  message: row.message,
  created_at: row.created_at,
});

function derivePriority(impact, urgency) {
  const i = normalize(impact || "medio");
  const u = normalize(urgency || "medio");
  if (i === "alto" && u === "alto") return "critica";
  if (i === "alto" || u === "alto") return "alta";
  if (i === "medio" || u === "medio") return "media";
  return "baja";
}

function validateCreatePayload(payload = {}) {
  const ticketType = normalize(payload.ticket_type);
  if (!TICKET_TYPES.has(ticketType)) {
    const err = new Error("ticket_type invalido");
    err.status = 400;
    throw err;
  }

  const title = String(payload.title || "").trim();
  if (title.length < 5) {
    const err = new Error("El titulo debe tener al menos 5 caracteres");
    err.status = 400;
    throw err;
  }

  const description = String(payload.description || "").trim();
  if (description.length < 10) {
    const err = new Error("La descripcion debe tener al menos 10 caracteres");
    err.status = 400;
    throw err;
  }

  const impact = normalize(payload.impact || "medio");
  const urgency = normalize(payload.urgency || "medio");
  if (!ALLOWED_LVL.has(impact) || !ALLOWED_LVL.has(urgency)) {
    const err = new Error("impact/urgency invalidos");
    err.status = 400;
    throw err;
  }

  const explicitPriority = normalize(payload.priority || "");
  const priority = explicitPriority && TICKET_PRIORITIES.has(explicitPriority)
    ? explicitPriority
    : derivePriority(impact, urgency);

  if (!TICKET_PRIORITIES.has(priority)) {
    const err = new Error("priority invalida");
    err.status = 400;
    throw err;
  }

  return {
    ticket_type: ticketType,
    title,
    description,
    priority,
    impact,
    urgency,
    category: payload.category ? String(payload.category).trim().slice(0, 100) : null,
    subcategory: payload.subcategory ? String(payload.subcategory).trim().slice(0, 100) : null,
  };
}

function assertTransition(fromStatus, toStatus) {
  const from = normalizeStatus(fromStatus);
  const to = normalizeStatus(toStatus);
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed || !allowed.has(to)) {
    const err = new Error(`Transicion invalida: ${from} -> ${to}`);
    err.status = 400;
    throw err;
  }
}

async function createEvent(client, { ticketId, actorUserId, eventType, oldStatus, newStatus, comment }) {
  await client.query(
    `
      INSERT INTO support_ticket_events (
        ticket_id, actor_user_id, event_type, old_status, new_status, comment
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [ticketId, actorUserId || null, eventType, oldStatus || null, newStatus || null, comment || null]
  );
}

async function getTIUsers(client) {
  const { rows } = await client.query(
    `
      SELECT id, email, fullname
      FROM users
      WHERE LOWER(COALESCE(role, '')) = ANY($1)
      ORDER BY id ASC
    `,
    [TI_ROLES]
  );
  return rows;
}

async function notifyUsers({ userIds, title, message, source, priority = 1, meta = {} }) {
  const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean)));
  if (!uniqueIds.length) return;
  await Promise.all(
    uniqueIds.map((userId) =>
      notificationsService.createNotification({
        user_id: userId,
        title,
        message,
        type: "task",
        source,
        priority,
        meta,
      })
    )
  );
}

function buildSla(priority) {
  const cfg = SLA_HOURS_BY_PRIORITY[priority] || SLA_HOURS_BY_PRIORITY.media;
  return {
    responseHours: cfg.response,
    resolutionHours: cfg.resolution,
  };
}

async function getTicketBase(client, ticketId) {
  const { rows } = await client.query("SELECT * FROM support_tickets WHERE id = $1 LIMIT 1", [ticketId]);
  if (!rows.length) {
    const err = new Error("Ticket no encontrado");
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function getTicketForActor(ticketId, actorUser) {
  const { rows } = await db.query("SELECT * FROM support_tickets WHERE id = $1 LIMIT 1", [ticketId]);
  if (!rows.length) {
    const err = new Error("Ticket no encontrado");
    err.status = 404;
    throw err;
  }

  const ticket = rows[0];
  const isOwner = Number(ticket.requester_id) === Number(actorUser.id);
  const isTi = isTIUser(actorUser);
  if (!isOwner && !isTi) {
    const err = new Error("No autorizado");
    err.status = 403;
    throw err;
  }

  return { ticket, isOwner, isTi };
}

async function recalcSlaFlags(client, ticketId) {
  await client.query(
    `
      UPDATE support_tickets
      SET
        sla_response_breached = CASE
          WHEN first_response_due_at IS NULL THEN FALSE
          WHEN first_response_at IS NOT NULL AND first_response_at > first_response_due_at THEN TRUE
          WHEN first_response_at IS NULL AND NOW() > first_response_due_at THEN TRUE
          ELSE sla_response_breached
        END,
        sla_resolution_breached = CASE
          WHEN resolution_due_at IS NULL THEN FALSE
          WHEN resolved_at IS NOT NULL AND resolved_at > resolution_due_at THEN TRUE
          WHEN resolved_at IS NULL AND NOW() > resolution_due_at THEN TRUE
          ELSE sla_resolution_breached
        END,
        updated_at = NOW()
      WHERE id = $1
    `,
    [ticketId]
  );
}

function workspaceBaseSelect(whereClause = "", extraOrder = "") {
  return `
    SELECT
      t.*,
      rq.fullname AS requester_name,
      rq.email AS requester_email,
      ati.fullname AS assigned_ti_name,
      ati.email AS assigned_ti_email,
      ev.first_assigned_at,
      ev.first_in_progress_at,
      ev.first_resolved_at,
      CASE
        WHEN ev.first_assigned_at IS NULL THEN NULL
        ELSE ROUND(EXTRACT(EPOCH FROM (ev.first_assigned_at - t.created_at)) / 60.0, 2)
      END AS response_minutes,
      CASE
        WHEN COALESCE(t.resolved_at, ev.first_resolved_at) IS NULL THEN NULL
        ELSE ROUND(EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, ev.first_resolved_at) - t.created_at)) / 60.0, 2)
      END AS cycle_minutes,
      CASE
        WHEN COALESCE(t.resolved_at, ev.first_resolved_at) IS NULL THEN NULL
        ELSE ROUND(
          EXTRACT(EPOCH FROM (
            COALESCE(t.resolved_at, ev.first_resolved_at) -
            COALESCE(ev.first_in_progress_at, ev.first_assigned_at, t.created_at)
          )) / 60.0,
          2
        )
      END AS delivery_minutes,
      (t.first_response_at IS NULL AND t.first_response_due_at IS NOT NULL AND NOW() > t.first_response_due_at) AS sla_response_overdue,
      (t.resolved_at IS NULL AND t.resolution_due_at IS NOT NULL AND NOW() > t.resolution_due_at) AS sla_resolution_overdue,
      COALESCE(cm.comments_count, 0)::int AS comments_count
    FROM support_tickets t
    JOIN users rq ON rq.id = t.requester_id
    LEFT JOIN users ati ON ati.id = t.assigned_ti_user_id
    LEFT JOIN LATERAL (
      SELECT
        MIN(e.created_at) FILTER (WHERE e.event_type = 'assigned') AS first_assigned_at,
        MIN(e.created_at) FILTER (WHERE e.new_status = 'en_progreso') AS first_in_progress_at,
        MIN(e.created_at) FILTER (WHERE e.new_status IN ('resuelto', 'cerrado')) AS first_resolved_at
      FROM support_ticket_events e
      WHERE e.ticket_id = t.id
    ) ev ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS comments_count
      FROM support_ticket_comments c
      WHERE c.ticket_id = t.id
    ) cm ON TRUE
    ${whereClause}
    ORDER BY
      CASE t.priority
        WHEN 'critica' THEN 0
        WHEN 'alta' THEN 1
        WHEN 'media' THEN 2
        ELSE 3
      END,
      t.created_at DESC
    ${extraOrder}
  `;
}

function buildWorkspaceFilters({ status, ticket_type, q }) {
  const filters = [];
  const values = [];

  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus && TICKET_STATUSES.has(normalizedStatus)) {
    values.push(normalizedStatus);
    filters.push(`t.status = $${values.length}`);
  }

  if (ticket_type && TICKET_TYPES.has(normalize(ticket_type))) {
    values.push(normalize(ticket_type));
    filters.push(`t.ticket_type = $${values.length}`);
  }

  if (q && String(q).trim()) {
    values.push(`%${String(q).trim()}%`);
    filters.push(`(t.code ILIKE $${values.length} OR t.title ILIKE $${values.length} OR rq.fullname ILIKE $${values.length})`);
  }

  return {
    whereClause: filters.length ? `WHERE ${filters.join(" AND ")}` : "",
    values,
  };
}

async function createTicket({ requester, payload }) {
  await ensureSupportSchema();
  const validated = validateCreatePayload(payload);
  const sla = buildSla(validated.priority);
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
        INSERT INTO support_tickets (
          requester_id, ticket_type, title, description, priority,
          impact, urgency, category, subcategory,
          first_response_due_at, resolution_due_at, status
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          NOW() + ($10::text || ' hours')::interval,
          NOW() + ($11::text || ' hours')::interval,
          'abierto'
        )
        RETURNING *
      `,
      [
        requester.id,
        validated.ticket_type,
        validated.title,
        validated.description,
        validated.priority,
        validated.impact,
        validated.urgency,
        validated.category,
        validated.subcategory,
        String(sla.responseHours),
        String(sla.resolutionHours),
      ]
    );

    const created = rows[0];
    const ticketCode = `TK-${String(created.id).padStart(6, "0")}`;

    const updateCode = await client.query(
      `UPDATE support_tickets SET code = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [created.id, ticketCode]
    );

    await createEvent(client, {
      ticketId: created.id,
      actorUserId: requester.id,
      eventType: "created",
      newStatus: "abierto",
      comment: "Ticket creado por solicitante",
    });

    const tiUsers = await getTIUsers(client);
    await client.query("COMMIT");

    const ticket = updateCode.rows[0];
    const tiUserIds = tiUsers.map((u) => u.id).filter((id) => Number(id) !== Number(requester.id));

    await notifyUsers({
      userIds: [requester.id],
      title: `Ticket ${ticket.code} creado`,
      message: "Tu ticket fue registrado y enviado al workspace de TI.",
      source: "support_tickets.created",
      priority: 1,
      meta: { ticket_id: ticket.id, ticket_code: ticket.code },
    });

    await notifyUsers({
      userIds: tiUserIds,
      title: `Nuevo ticket ${ticket.code}`,
      message: `${requester.fullname || requester.email} registro un ${ticket.ticket_type}.`,
      source: "support_tickets.incoming",
      priority: validated.priority === "critica" ? 3 : validated.priority === "alta" ? 2 : 1,
      meta: {
        ticket_id: ticket.id,
        ticket_code: ticket.code,
        requester_id: requester.id,
        target_path: `/dashboard/ti/workspace?ticketId=${ticket.id}`,
      },
    });

    return ticket;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listMyTickets(userId) {
  await ensureSupportSchema();
  const { rows } = await db.query(
    workspaceBaseSelect("WHERE t.requester_id = $1", "LIMIT 200"),
    [userId]
  );
  return rows.map(mapRow);
}

async function listWorkspaceTickets(filters) {
  await ensureSupportSchema();
  const { whereClause, values } = buildWorkspaceFilters(filters || {});
  const { rows } = await db.query(
    workspaceBaseSelect(whereClause, "LIMIT 500"),
    values
  );
  return rows.map(mapRow);
}

async function getWorkspaceKpis(filters) {
  await ensureSupportSchema();
  const { whereClause, values } = buildWorkspaceFilters(filters || {});
  const { rows } = await db.query(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE t.status IN ('abierto', 'reabierto'))::int AS abiertos,
        COUNT(*) FILTER (WHERE t.status = 'triage')::int AS triage,
        COUNT(*) FILTER (WHERE t.status = 'en_progreso')::int AS en_progreso,
        COUNT(*) FILTER (WHERE t.status = 'en_espera')::int AS en_espera,
        COUNT(*) FILTER (WHERE t.status IN ('resuelto', 'cerrado'))::int AS terminados,
        COUNT(*) FILTER (
          WHERE t.first_response_at IS NULL
            AND t.first_response_due_at IS NOT NULL
            AND NOW() > t.first_response_due_at
        )::int AS response_overdue,
        COUNT(*) FILTER (
          WHERE t.resolved_at IS NULL
            AND t.resolution_due_at IS NOT NULL
            AND NOW() > t.resolution_due_at
        )::int AS resolution_overdue,
        ROUND(
          AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 60.0)
          FILTER (WHERE t.first_response_at IS NOT NULL),
          2
        ) AS avg_response_minutes,
        ROUND(
          AVG(EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, NOW()) - t.created_at)) / 60.0)
          FILTER (WHERE t.status IN ('resuelto', 'cerrado')),
          2
        ) AS avg_cycle_minutes,
        ROUND(
          AVG(EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, NOW()) - COALESCE(ev.first_in_progress_at, t.first_response_at, t.created_at))) / 60.0)
          FILTER (WHERE t.status IN ('resuelto', 'cerrado')),
          2
        ) AS avg_delivery_minutes
      FROM support_tickets t
      JOIN users rq ON rq.id = t.requester_id
      LEFT JOIN LATERAL (
        SELECT MIN(e.created_at) FILTER (WHERE e.new_status = 'en_progreso') AS first_in_progress_at
        FROM support_ticket_events e
        WHERE e.ticket_id = t.id
      ) ev ON TRUE
      ${whereClause}
    `,
    values
  );

  const row = rows[0] || {};
  return {
    total: Number(row.total || 0),
    abiertos: Number(row.abiertos || 0),
    triage: Number(row.triage || 0),
    en_progreso: Number(row.en_progreso || 0),
    en_espera: Number(row.en_espera || 0),
    terminados: Number(row.terminados || 0),
    response_overdue: Number(row.response_overdue || 0),
    resolution_overdue: Number(row.resolution_overdue || 0),
    avg_response_minutes: toNumber(row.avg_response_minutes),
    avg_cycle_minutes: toNumber(row.avg_cycle_minutes),
    avg_delivery_minutes: toNumber(row.avg_delivery_minutes),
  };
}

async function listTicketEvents(ticketId, actorUser) {
  await ensureSupportSchema();
  await getTicketForActor(ticketId, actorUser);
  const { rows } = await db.query(
    `
      SELECT e.*, u.fullname AS actor_name
      FROM support_ticket_events e
      LEFT JOIN users u ON u.id = e.actor_user_id
      WHERE e.ticket_id = $1
      ORDER BY e.created_at DESC
      LIMIT 200
    `,
    [ticketId]
  );
  return rows.map(mapEventRow);
}

async function listTicketComments(ticketId, actorUser) {
  await ensureSupportSchema();
  const { isTi } = await getTicketForActor(ticketId, actorUser);
  const params = [ticketId];
  let visibilityFilter = "";
  if (!isTi) {
    params.push("public");
    visibilityFilter = `AND c.visibility = $${params.length}`;
  }

  const { rows } = await db.query(
    `
      SELECT
        c.*,
        u.fullname AS author_name,
        u.email AS author_email
      FROM support_ticket_comments c
      LEFT JOIN users u ON u.id = c.author_user_id
      WHERE c.ticket_id = $1
      ${visibilityFilter}
      ORDER BY c.created_at ASC
      LIMIT 500
    `,
    params
  );

  return rows.map(mapCommentRow);
}

async function addTicketComment({ ticketId, actorUser, message, visibility = "public" }) {
  await ensureSupportSchema();
  const { ticket, isTi } = await getTicketForActor(ticketId, actorUser);
  const text = String(message || "").trim();
  if (text.length < 2) {
    const err = new Error("Comentario demasiado corto");
    err.status = 400;
    throw err;
  }

  const normalizedVisibility = normalize(visibility || "public");
  if (!COMMENT_VISIBILITY.has(normalizedVisibility)) {
    const err = new Error("visibility invalida");
    err.status = 400;
    throw err;
  }

  if (!isTi && normalizedVisibility === "internal") {
    const err = new Error("No autorizado para comentarios internos");
    err.status = 403;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
        INSERT INTO support_ticket_comments (ticket_id, author_user_id, visibility, message)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [ticketId, actorUser.id, normalizedVisibility, text]
    );

    if (isTi && !ticket.first_response_at) {
      await client.query(
        `
          UPDATE support_tickets
          SET first_response_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `,
        [ticketId]
      );
    }

    await createEvent(client, {
      ticketId,
      actorUserId: actorUser.id,
      eventType: "commented",
      comment: normalizedVisibility === "internal" ? "Comentario interno agregado" : "Comentario agregado",
    });

    await recalcSlaFlags(client, ticketId);
    await client.query("COMMIT");

    const receivers = normalizedVisibility === "internal"
      ? [ticket.assigned_ti_user_id].filter(Boolean)
      : [ticket.requester_id, ticket.assigned_ti_user_id].filter(Boolean);

    await notifyUsers({
      userIds: receivers,
      title: `Nuevo comentario en ${ticket.code}`,
      message: text.slice(0, 120),
      source: "support_tickets.comment",
      priority: 1,
      meta: { ticket_id: ticket.id, ticket_code: ticket.code },
    });

    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function assignTicketToSelf({ ticketId, tiUser }) {
  await ensureSupportSchema();
  if (!isTIUser(tiUser)) {
    const err = new Error("Solo TI puede asignar tickets");
    err.status = 403;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const before = await getTicketBase(client, ticketId);

    const updated = await client.query(
      `
        UPDATE support_tickets
        SET
          assigned_ti_user_id = $2,
          first_response_at = COALESCE(first_response_at, NOW()),
          status = CASE WHEN status IN ('abierto', 'reabierto') THEN 'triage' ELSE status END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [ticketId, tiUser.id]
    );

    await createEvent(client, {
      ticketId,
      actorUserId: tiUser.id,
      eventType: "assigned",
      oldStatus: before.status,
      newStatus: updated.rows[0].status,
      comment: `${tiUser.fullname || tiUser.email} tomo el ticket`,
    });

    await recalcSlaFlags(client, ticketId);
    await client.query("COMMIT");

    const ticket = updated.rows[0];
    await notifyUsers({
      userIds: [ticket.requester_id, tiUser.id],
      title: `Ticket ${ticket.code} asignado`,
      message: `${tiUser.fullname || tiUser.email} tomo el ticket para gestionarlo.`,
      source: "support_tickets.assigned",
      priority: 1,
      meta: { ticket_id: ticket.id, ticket_code: ticket.code },
    });

    return ticket;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateTicketStatus({ ticketId, status, comment, actorUser }) {
  await ensureSupportSchema();
  if (!isTIUser(actorUser)) {
    const err = new Error("Solo TI puede actualizar estados");
    err.status = 403;
    throw err;
  }

  const nextStatus = normalizeStatus(status);
  if (!TICKET_STATUSES.has(nextStatus)) {
    const err = new Error("Estado invalido");
    err.status = 400;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const previous = await getTicketBase(client, ticketId);

    assertTransition(previous.status, nextStatus);
    if (nextStatus === "en_espera" && !String(comment || "").trim()) {
      const err = new Error("Debes ingresar el motivo de espera");
      err.status = 400;
      throw err;
    }

    const resolvedAtSQL = nextStatus === "reabierto"
      ? "NULL"
      : (nextStatus === "resuelto" || nextStatus === "cerrado" ? "COALESCE(resolved_at, NOW())" : "resolved_at");

    const { rows } = await client.query(
      `
        UPDATE support_tickets
        SET
          status = $2,
          assigned_ti_user_id = COALESCE(assigned_ti_user_id, $3),
          first_response_at = CASE
            WHEN first_response_at IS NULL AND $2 <> 'abierto' THEN NOW()
            ELSE first_response_at
          END,
          on_hold_reason = CASE
            WHEN $2 = 'en_espera' THEN $4
            ELSE NULL
          END,
          resolved_at = ${resolvedAtSQL},
          closed_by_requester = CASE WHEN $2 = 'reabierto' THEN FALSE ELSE closed_by_requester END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [ticketId, nextStatus, actorUser.id, comment ? String(comment).trim() : null]
    );

    await createEvent(client, {
      ticketId,
      actorUserId: actorUser.id,
      eventType: "status_changed",
      oldStatus: previous.status,
      newStatus: nextStatus,
      comment: comment || null,
    });

    if (nextStatus === "reabierto") {
      await client.query(
        `
          UPDATE support_tickets
          SET
            reopened_count = COALESCE(reopened_count, 0) + 1,
            last_reopened_at = NOW(),
            satisfaction_score = NULL,
            satisfaction_comment = NULL,
            updated_at = NOW()
          WHERE id = $1
        `,
        [ticketId]
      );
    }

    await recalcSlaFlags(client, ticketId);
    await client.query("COMMIT");

    const ticket = rows[0];
    await notifyUsers({
      userIds: [ticket.requester_id, ticket.assigned_ti_user_id].filter(Boolean),
      title: `Ticket ${ticket.code} actualizado`,
      message: `Estado actual: ${ticket.status.replace("_", " ")}.`,
      source: "support_tickets.status",
      priority: 1,
      meta: { ticket_id: ticket.id, ticket_code: ticket.code, new_status: ticket.status },
    });

    return ticket;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function closeTicketByRequester({ ticketId, requesterUser, comment }) {
  await ensureSupportSchema();
  const { ticket, isOwner } = await getTicketForActor(ticketId, requesterUser);
  if (!isOwner) {
    const err = new Error("Solo el solicitante puede cerrar");
    err.status = 403;
    throw err;
  }

  if (!["resuelto", "cerrado"].includes(ticket.status)) {
    const err = new Error("Solo se puede cerrar tickets resueltos o cerrados");
    err.status = 400;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
        UPDATE support_tickets
        SET
          status = 'cerrado',
          closed_by_requester = TRUE,
          resolved_at = COALESCE(resolved_at, NOW()),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [ticketId]
    );

    await createEvent(client, {
      ticketId,
      actorUserId: requesterUser.id,
      eventType: "closed_by_requester",
      oldStatus: ticket.status,
      newStatus: "cerrado",
      comment: comment || "Cerrado por solicitante",
    });

    await recalcSlaFlags(client, ticketId);
    await client.query("COMMIT");

    const closed = rows[0];
    await notifyUsers({
      userIds: [closed.assigned_ti_user_id].filter(Boolean),
      title: `Ticket ${closed.code} cerrado por solicitante`,
      message: comment || "El solicitante confirmo la solucion.",
      source: "support_tickets.closed_by_requester",
      priority: 1,
      meta: { ticket_id: closed.id, ticket_code: closed.code },
    });

    return closed;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function reopenTicket({ ticketId, actorUser, reason }) {
  await ensureSupportSchema();
  const { ticket, isOwner, isTi } = await getTicketForActor(ticketId, actorUser);
  if (!isOwner && !isTi) {
    const err = new Error("No autorizado");
    err.status = 403;
    throw err;
  }

  if (!["resuelto", "cerrado"].includes(ticket.status)) {
    const err = new Error("Solo tickets resueltos o cerrados pueden reabrirse");
    err.status = 400;
    throw err;
  }

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
        UPDATE support_tickets
        SET
          status = 'reabierto',
          reopened_count = COALESCE(reopened_count, 0) + 1,
          last_reopened_at = NOW(),
          resolved_at = NULL,
          closed_by_requester = FALSE,
          satisfaction_score = NULL,
          satisfaction_comment = NULL,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [ticketId]
    );

    await createEvent(client, {
      ticketId,
      actorUserId: actorUser.id,
      eventType: "reopened",
      oldStatus: ticket.status,
      newStatus: "reabierto",
      comment: reason || "Ticket reabierto",
    });

    await client.query("COMMIT");

    const reopened = rows[0];
    const tiUsers = await getTIUsers(db);
    const tiIds = tiUsers.map((u) => u.id);

    await notifyUsers({
      userIds: Array.from(new Set([reopened.requester_id, reopened.assigned_ti_user_id, ...tiIds].filter(Boolean))),
      title: `Ticket ${reopened.code} reabierto`,
      message: reason || "Se requiere una nueva revision.",
      source: "support_tickets.reopened",
      priority: reopened.priority === "critica" ? 3 : reopened.priority === "alta" ? 2 : 1,
      meta: { ticket_id: reopened.id, ticket_code: reopened.code, target_path: `/dashboard/ti/workspace?ticketId=${reopened.id}` },
    });

    return reopened;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function rateTicketSatisfaction({ ticketId, requesterUser, score, comment }) {
  await ensureSupportSchema();
  const { ticket, isOwner } = await getTicketForActor(ticketId, requesterUser);
  if (!isOwner) {
    const err = new Error("Solo el solicitante puede calificar");
    err.status = 403;
    throw err;
  }

  if (!["resuelto", "cerrado"].includes(ticket.status)) {
    const err = new Error("Solo tickets terminados pueden calificarse");
    err.status = 400;
    throw err;
  }

  const numericScore = Number(score);
  if (!Number.isInteger(numericScore) || numericScore < 1 || numericScore > 5) {
    const err = new Error("score debe ser entero entre 1 y 5");
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(
    `
      UPDATE support_tickets
      SET
        satisfaction_score = $2,
        satisfaction_comment = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [ticketId, numericScore, comment ? String(comment).trim() : null]
  );

  await notifyUsers({
    userIds: [ticket.assigned_ti_user_id].filter(Boolean),
    title: `CSAT ticket ${ticket.code}`,
    message: `Calificacion: ${numericScore}/5`,
    source: "support_tickets.csat",
    priority: 1,
    meta: { ticket_id: ticket.id, ticket_code: ticket.code, score: numericScore },
  });

  return rows[0];
}

module.exports = {
  TICKET_TYPES: Array.from(TICKET_TYPES),
  TICKET_PRIORITIES: Array.from(TICKET_PRIORITIES),
  TICKET_STATUSES: Array.from(TICKET_STATUSES),
  TI_ROLES,
  isTIUser,
  createTicket,
  listMyTickets,
  listWorkspaceTickets,
  getWorkspaceKpis,
  listTicketEvents,
  listTicketComments,
  addTicketComment,
  assignTicketToSelf,
  updateTicketStatus,
  closeTicketByRequester,
  reopenTicket,
  rateTicketSatisfaction,
};
