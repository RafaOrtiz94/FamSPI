const db = require("../../config/db");
const logger = require("../../config/logger");
const schedulesService = require("../schedules/schedules.service");

const MANAGER_ROLES = new Set([
  "jefe_comercial",
  "gerencia",
  "gerente",
  "admin",
  "administrador",
  "ti",
]);

const ADVISOR_ROLES = new Set(["comercial", "acp_comercial", "backoffice"]);

// Estados válidos para registros de visita.
// "in_visit" representa una visita en curso que aún no ha sido cerrada.
const VALID_VISIT_STATUS = new Set(["visited", "pending", "skipped", "in_visit"]);

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
      status TEXT NOT NULL CHECK (status IN ('visited','pending','skipped','in_visit')),
      hora_entrada TIMESTAMPTZ,
      hora_salida TIMESTAMPTZ,
      lat_entrada DOUBLE PRECISION,
      lng_entrada DOUBLE PRECISION,
      lat_salida DOUBLE PRECISION,
      lng_salida DOUBLE PRECISION,
      observaciones TEXT,
      duracion_minutos INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(client_request_id, user_email, visit_date)
    );
  `);

  // Asegurar columnas nuevas en instalaciones existentes
  await db.query(`
    ALTER TABLE client_visit_logs
      ADD COLUMN IF NOT EXISTS hora_entrada TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS hora_salida TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS lat_entrada DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS lng_entrada DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS lat_salida DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS lng_salida DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS observaciones TEXT,
      ADD COLUMN IF NOT EXISTS duracion_minutos INTEGER;
    `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS prospect_visits (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      prospect_name TEXT NOT NULL,
      visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
      status TEXT NOT NULL CHECK (status IN ('in_visit', 'visited')),
      check_in_time TIMESTAMPTZ,
      check_out_time TIMESTAMPTZ,
      check_in_lat DOUBLE PRECISION,
      check_in_lng DOUBLE PRECISION,
      check_out_lat DOUBLE PRECISION,
      check_out_lng DOUBLE PRECISION,
      observations TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
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

async function listAccessibleClients({ user, q, visitDate, includeScheduleInfo = false, filterBySchedule = false }) {
  await ensureTables();
  const dateParam = visitDate || new Date().toISOString().slice(0, 10);

  const normalizedEmail = (user?.email || "").toLowerCase();
  let approvedSchedule = null;
  let plannedVisits = [];

  if (includeScheduleInfo || filterBySchedule) {
    approvedSchedule = await schedulesService.findApprovedScheduleForMonth({
      userEmail: normalizedEmail,
      month: Number(dateParam.slice(5, 7)),
      year: Number(dateParam.slice(0, 4)),
    });

    if (approvedSchedule) {
      const { rows } = await db.query(
        `SELECT client_request_id, planned_date, city, priority, notes, schedule_id
           FROM scheduled_visits
          WHERE schedule_id = $1 AND planned_date = $2`,
        [approvedSchedule.id, dateParam],
      );
      plannedVisits = rows || [];
    }
  }

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

  const prospectsQuery = `
    SELECT
      id,
      prospect_name,
      status,
      check_in_time,
      check_out_time,
      check_in_lat,
      check_in_lng,
      check_out_lat,
      check_out_lng,
      observations
    FROM prospect_visits
    WHERE user_email = $1 AND visit_date = $2
    ORDER BY created_at DESC
  `;

  const prospects = await db.query(prospectsQuery, [user.email, dateParam]);

  if (filterBySchedule && approvedSchedule) {
    params.push(plannedVisits.map((v) => v.client_request_id));
    clauses.push(`cr.id = ANY($${params.length})`);
  }

  if (filterBySchedule && !approvedSchedule) {
    return {
      clients: [],
      prospects: prospects.rows,
      scheduleMeta: {
        total: 0,
        visited: 0,
        pending: 0,
        planned_today: 0,
        has_approved_schedule: false,
        cities_today: [],
      },
    };
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const query = `
    SELECT
      cr.id,
      cr.commercial_name AS nombre,
      cr.ruc_cedula AS identificador,
      cr.created_by,
      COALESCE(NULLIF(cr.client_email, ''), NULLIF(cr.consent_recipient_email, '')) AS client_email,
      COALESCE(
        NULLIF(cr.client_type, ''),
        CASE
          WHEN NULLIF(cr.legal_person_business_name, '') IS NOT NULL THEN 'persona_juridica'
          WHEN NULLIF(cr.natural_person_firstname, '') IS NOT NULL THEN 'persona_natural'
        END
      ) AS client_type,
      cr.status,
      cr.created_at,
      cr.shipping_contact_name,
      cr.shipping_city,
      cr.shipping_province,
      cr.shipping_phone,
      cr.shipping_address,
      cr.drive_folder_id,
      COALESCE(json_agg(DISTINCT ca.assigned_to_email) FILTER (WHERE ca.assigned_to_email IS NOT NULL), '[]') AS asignados,
      vl.status AS visit_status,
      vl.hora_entrada,
      vl.hora_salida,
      vl.lat_entrada,
      vl.lng_entrada,
      vl.lat_salida,
      vl.lng_salida,
      vl.observaciones,
      vl.duracion_minutos
    FROM client_requests cr
    LEFT JOIN client_assignments ca ON ca.client_request_id = cr.id
    LEFT JOIN client_visit_logs vl
      ON vl.client_request_id = cr.id AND vl.user_email = $1 AND vl.visit_date = $2
    ${whereClause}
    GROUP BY
      cr.id,
      vl.status,
      vl.hora_entrada,
      vl.hora_salida,
      vl.lat_entrada,
      vl.lng_entrada,
      vl.lat_salida,
      vl.lng_salida,
      vl.observaciones,
      vl.duracion_minutos
    ORDER BY cr.created_at DESC
    LIMIT 400
  `;

  const { rows } = await db.query(query, params);

  const plannedByClient = plannedVisits.reduce((acc, visit) => {
    acc[visit.client_request_id] = {
      is_planned: true,
      planned_date: visit.planned_date,
      planned_city: visit.city,
      priority: visit.priority,
      notes: visit.notes,
      schedule_id: visit.schedule_id,
    };
    return acc;
  }, {});

  const clients = rows.map((row) => {
    let asignados = row.asignados;
    // PostgreSQL puede devolver json_agg como string JSON, parsearlo si es necesario
    if (typeof asignados === "string") {
      try {
        asignados = JSON.parse(asignados);
      } catch (e) {
        asignados = [];
      }
    }
    // Asegurar que siempre sea un array
    if (!Array.isArray(asignados)) {
      asignados = [];
    }
    const scheduled_info = includeScheduleInfo
      ? {
        ...(plannedByClient[row.id] || { is_planned: false, schedule_id: approvedSchedule?.id || null }),
      }
      : undefined;

    return {
      ...row,
      asignados,
      visit_status: row.visit_status || "pending",
      scheduled_info,
    };
  });

  // Also fetch prospect visits for this user and date
  const visitedCount = clients.filter((c) => (c.visit_status || "").toLowerCase() === "visited").length;
  const citiesToday = [...new Set(plannedVisits.map((v) => v.city).filter(Boolean))];

  return {
    clients,
    prospects: prospects.rows, // Return prospects too
    scheduleMeta: {
      total: clients.length,
      visited: visitedCount,
      pending: Math.max(0, clients.length - visitedCount),
      planned_today: plannedVisits.length,
      has_approved_schedule: Boolean(approvedSchedule),
      cities_today: citiesToday,
    },
  };
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

async function upsertVisitStatus({
  clientId,
  user,
  status,
  visitDate,
  hora_entrada,
  hora_salida,
  lat_entrada,
  lng_entrada,
  lat_salida,
  lng_salida,
  observaciones,
}) {
  if (!isAdvisor(user)) {
    const error = new Error("No tienes permisos para registrar visitas");
    error.status = 403;
    throw error;
  }
  await ensureTables();
  const client = await getClientOrThrow(clientId);

  const now = new Date();
  const baseDate =
    visitDate ||
    hora_entrada ||
    hora_salida ||
    now.toISOString().slice(0, 10);
  const dateValue =
    typeof baseDate === "string" && baseDate.length > 10
      ? baseDate.slice(0, 10)
      : baseDate;

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

  // Determinar estado final y duración
  let finalStatus;
  if (status && VALID_VISIT_STATUS.has(status)) {
    finalStatus = status;
  } else if (hora_salida) {
    finalStatus = "visited";
  } else if (hora_entrada) {
    finalStatus = "in_visit";
  } else {
    finalStatus = "visited";
  }

  let duracionMinutos = null;
  try {
    if (hora_entrada && hora_salida) {
      const start = new Date(hora_entrada);
      const end = new Date(hora_salida);
      const diffMs = end - start;
      if (Number.isFinite(diffMs) && diffMs >= 0) {
        duracionMinutos = Math.round(diffMs / 60000);
      }
    }
  } catch (e) {
    logger.warn({ e }, "No se pudo calcular la duración de la visita");
  }

  const { rows } = await db.query(
    `INSERT INTO client_visit_logs (
       client_request_id,
       user_email,
       visit_date,
       status,
       hora_entrada,
       hora_salida,
       lat_entrada,
       lng_entrada,
       lat_salida,
       lng_salida,
       observaciones,
       duracion_minutos
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (client_request_id, user_email, visit_date)
     DO UPDATE SET
       status = EXCLUDED.status,
       updated_at = NOW(),
       hora_entrada = COALESCE(client_visit_logs.hora_entrada, EXCLUDED.hora_entrada),
       hora_salida = COALESCE(EXCLUDED.hora_salida, client_visit_logs.hora_salida),
       lat_entrada = COALESCE(client_visit_logs.lat_entrada, EXCLUDED.lat_entrada),
       lng_entrada = COALESCE(client_visit_logs.lng_entrada, EXCLUDED.lng_entrada),
       lat_salida = COALESCE(EXCLUDED.lat_salida, client_visit_logs.lat_salida),
       lng_salida = COALESCE(EXCLUDED.lng_salida, client_visit_logs.lng_salida),
       observaciones = COALESCE(EXCLUDED.observaciones, client_visit_logs.observaciones),
       duracion_minutos = COALESCE(EXCLUDED.duracion_minutos, client_visit_logs.duracion_minutos)
     RETURNING
       id,
       status,
       hora_entrada,
       hora_salida,
       lat_entrada,
       lng_entrada,
       lat_salida,
       lng_salida,
       observaciones,
       duracion_minutos`,
    [
      clientId,
      user.email,
      dateValue,
      finalStatus,
      hora_entrada || null,
      hora_salida || null,
      lat_entrada ?? null,
      lng_entrada ?? null,
      lat_salida ?? null,
      lng_salida ?? null,
      observaciones || null,
      duracionMinutos,
    ],
  );

  logger.info(
    { clientId, user: user.email, status: rows[0].status },
    "Visita de cliente registrada",
  );
  return rows[0];
}

async function upsertProspectVisit({
  user,
  prospectName,
  checkInTime,
  checkOutTime,
  checkInLat,
  checkInLng,
  checkOutLat,
  checkOutLng,
  observations,
  visitDate,
  visitId // Optional, if updating
}) {
  await ensureTables();
  const dateValue = visitDate || new Date().toISOString().slice(0, 10);
  let status = 'in_visit';
  if (checkOutTime) status = 'visited';

  let result;

  if (visitId) {
    // Update existing
    const query = `
      UPDATE prospect_visits
      SET 
        status = $1, 
        check_out_time = COALESCE($2, check_out_time),
        check_out_lat = COALESCE($3, check_out_lat),
        check_out_lng = COALESCE($4, check_out_lng),
        observations = COALESCE($5, observations),
        updated_at = NOW()
      WHERE id = $6 AND user_email = $7
      RETURNING *
    `;
    result = await db.query(query, [status, checkOutTime, checkOutLat, checkOutLng, observations, visitId, user.email]);
  } else {
    // Insert new
    const query = `
      INSERT INTO prospect_visits 
        (user_email, prospect_name, visit_date, status, check_in_time, check_in_lat, check_in_lng, observations)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    result = await db.query(query, [user.email, prospectName, dateValue, status, checkInTime, checkInLat, checkInLng, observations]);
  }

  return result.rows[0];
}

module.exports = {
  listAccessibleClients,
  assignClient,
  upsertVisitStatus,
  upsertProspectVisit
};
