const db = require("../../config/db");
const logger = require("../../config/logger");

const MANAGER_ROLES = new Set([
  "jefe_comercial",
  "gerencia",
  "gerente",
  "admin",
  "administrador",
  "ti",
]);

const ADVISOR_ROLES = new Set([
  "comercial",
  "acp_comercial",
  "backoffice",
]);

const VALID_VISIT_STATUS = new Set(["visited", "pending", "skipped"]);

function isManager(user) {
  return MANAGER_ROLES.has(user?.role?.toLowerCase?.() || "");
}

function isAdvisor(user) {
  return isManager(user) || ADVISOR_ROLES.has(user?.role?.toLowerCase?.() || "");
}

async function ensureTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS client_assignments (
      id SERIAL PRIMARY KEY,
      client_request_id INTEGER NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
      assigned_to_email TEXT NOT NULL,
      assigned_by_email TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(client_request_id, assigned_to_email)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS client_visit_logs (
      id SERIAL PRIMARY KEY,
      client_request_id INTEGER NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
      user_email TEXT NOT NULL,
      visit_date DATE NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('visited','pending','skipped')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(client_request_id, user_email, visit_date)
    );
  `);
}

async function getClientOrThrow(clientId) {
  const { rows } = await db.query(
    "SELECT id, status, commercial_name, created_by FROM client_requests WHERE id = $1",
    [clientId],
  );
  if (!rows.length) {
    const error = new Error("Cliente no encontrado");
    error.status = 404;
    throw error;
  }
  if (rows[0].status !== "approved") {
    const error = new Error("El cliente aún no está aprobado");
    error.status = 400;
    throw error;
  }
  return rows[0];
}

async function listAccessibleClients({ user, q, visitDate }) {
  await ensureTables();
  const dateParam = visitDate || new Date().toISOString().slice(0, 10);

  const params = [user.email, dateParam];
  const clauses = ["cr.status = 'approved'"]; // base status filter

  if (!isManager(user)) {
    params.push(user.email, user.email);
    clauses.push(`(cr.created_by = $${params.length - 1} OR ca.assigned_to_email = $${params.length})`);
  }

  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    const idx = params.length;
    clauses.push(
      `(LOWER(cr.commercial_name) LIKE $${idx} OR LOWER(cr.ruc_cedula) LIKE $${idx} OR CAST(cr.id AS TEXT) LIKE $${idx})`,
    );
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const query = `
    SELECT
      cr.id,
      cr.commercial_name AS nombre,
      cr.ruc_cedula AS identificador,
      cr.created_by,
      cr.status,
      cr.created_at,
      cr.shipping_contact_name,
      cr.shipping_phone,
      cr.shipping_address,
      cr.drive_folder_id,
      COALESCE(json_agg(DISTINCT ca.assigned_to_email) FILTER (WHERE ca.assigned_to_email IS NOT NULL), '[]') AS asignados,
      vl.status AS visit_status
    FROM client_requests cr
    LEFT JOIN client_assignments ca ON ca.client_request_id = cr.id
    LEFT JOIN client_visit_logs vl
      ON vl.client_request_id = cr.id AND vl.user_email = $1 AND vl.visit_date = $2
    ${whereClause}
    GROUP BY cr.id, vl.status
    ORDER BY cr.created_at DESC
    LIMIT 400
  `;

  const { rows } = await db.query(query, params);

  return rows.map((row) => ({
    ...row,
    asignados: Array.isArray(row.asignados) ? row.asignados : [],
    visit_status: row.visit_status || "pending",
  }));
}

async function assignClient({ clientId, assigneeEmail, user }) {
  if (!isManager(user)) {
    const error = new Error("Solo los jefes pueden asignar clientes");
    error.status = 403;
    throw error;
  }
  await ensureTables();
  const client = await getClientOrThrow(clientId);

  const normalizedEmail = (assigneeEmail || "").toLowerCase();
  if (!normalizedEmail) {
    const error = new Error("El correo del asignado es obligatorio");
    error.status = 400;
    throw error;
  }

  await db.query(
    `INSERT INTO client_assignments (client_request_id, assigned_to_email, assigned_by_email)
     VALUES ($1, $2, $3)
     ON CONFLICT (client_request_id, assigned_to_email) DO UPDATE
       SET assigned_by_email = EXCLUDED.assigned_by_email, created_at = NOW()`,
    [clientId, normalizedEmail, user.email],
  );

  return { ok: true, client: clientId, assignee: normalizedEmail };
}

async function upsertVisitStatus({ clientId, user, status, visitDate }) {
  if (!isAdvisor(user)) {
    const error = new Error("No tienes permisos para registrar visitas");
    error.status = 403;
    throw error;
  }
  await ensureTables();
  const client = await getClientOrThrow(clientId);
  const dateValue = visitDate || new Date().toISOString().slice(0, 10);

  // Validar acceso a cliente
  if (!isManager(user)) {
    const { rows } = await db.query(
      `SELECT 1 FROM client_requests cr
       LEFT JOIN client_assignments ca ON ca.client_request_id = cr.id AND ca.assigned_to_email = $2
       WHERE cr.id = $1 AND (cr.created_by = $2 OR ca.assigned_to_email IS NOT NULL)
       LIMIT 1`,
      [clientId, user.email],
    );
    if (!rows.length) {
      const error = new Error("No tienes acceso a este cliente");
      error.status = 403;
      throw error;
    }
  }

  const finalStatus = VALID_VISIT_STATUS.has(status) ? status : "visited";

  const { rows } = await db.query(
    `INSERT INTO client_visit_logs (client_request_id, user_email, visit_date, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (client_request_id, user_email, visit_date)
     DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
     RETURNING id, status`,
    [clientId, user.email, dateValue, finalStatus],
  );

  logger.info({ clientId, user: user.email, status: rows[0].status }, "Visita de cliente registrada");
  return rows[0];
}

module.exports = {
  listAccessibleClients,
  assignClient,
  upsertVisitStatus,
};
