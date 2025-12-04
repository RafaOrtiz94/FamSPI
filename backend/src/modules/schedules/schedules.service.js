const db = require("../../config/db");

const MANAGER_ROLES = new Set([
  "jefe_comercial",
  "gerencia",
  "gerencia_general",
  "admin",
  "administrador",
]);

const ADVISOR_ROLES = new Set(["comercial", "acp_comercial", "backoffice_comercial"]);

function isManager(user) {
  return MANAGER_ROLES.has((user?.role || "").toLowerCase());
}

function isAdvisor(user) {
  return isManager(user) || ADVISOR_ROLES.has((user?.role || "").toLowerCase());
}

function assertAdvisor(user) {
  if (!isAdvisor(user)) {
    const error = new Error("No tienes permisos para gestionar cronogramas");
    error.status = 403;
    throw error;
  }
}

function assertManager(user) {
  if (!isManager(user)) {
    const error = new Error("Solo los jefes pueden realizar esta acción");
    error.status = 403;
    throw error;
  }
}

async function findScheduleOrThrow(id) {
  const { rows } = await db.query("SELECT * FROM visit_schedules WHERE id = $1", [id]);
  if (!rows.length) {
    const error = new Error("Cronograma no encontrado");
    error.status = 404;
    throw error;
  }
  return rows[0];
}

function ensureOwner(schedule, user) {
  if (schedule.user_email !== user.email && !isManager(user)) {
    const error = new Error("No puedes modificar cronogramas de otros asesores");
    error.status = 403;
    throw error;
  }
}

async function getClientOrThrow(clientRequestId) {
  const { rows } = await db.query(
    `SELECT id, commercial_name, shipping_city, shipping_province, shipping_address
       FROM client_requests
      WHERE id = $1
      LIMIT 1`,
    [clientRequestId],
  );
  if (!rows.length) {
    const error = new Error("Cliente no encontrado");
    error.status = 404;
    throw error;
  }
  return rows[0];
}

function resolveCity({ city, client }) {
  return (
    city ||
    client?.shipping_city ||
    client?.shipping_province ||
    client?.shipping_address ||
    null
  );
}

async function listMySchedules(user) {
  assertAdvisor(user);
  const { rows } = await db.query(
    `SELECT * FROM visit_schedules WHERE user_email = $1 ORDER BY year DESC, month DESC`,
    [user.email],
  );
  return rows;
}

async function listPendingApproval(user) {
  assertManager(user);
  const { rows } = await db.query(
    `SELECT * FROM visit_schedules WHERE status = 'pending_approval' ORDER BY submitted_at DESC NULLS LAST`,
  );
  return rows;
}

async function listTeamSchedules(user) {
  assertManager(user);
  const { rows } = await db.query(
    `SELECT * FROM visit_schedules ORDER BY year DESC, month DESC, user_email ASC LIMIT 500`,
  );
  return rows;
}

async function getScheduleDetail({ id, user }) {
  assertAdvisor(user);
  const schedule = await findScheduleOrThrow(id);
  ensureOwner(schedule, user);
  const { rows: visits } = await db.query(
    `SELECT
       sv.id,
       sv.schedule_id,
       sv.client_request_id,
       COALESCE(sv.city, cr.shipping_city, cr.shipping_province, cr.shipping_address) AS city,
       sv.planned_date,
       sv.priority,
       sv.notes,
       sv.created_at,
       sv.updated_at,
       cr.commercial_name AS client_name,
       cr.shipping_city AS client_city,
       cr.shipping_province AS client_province,
       cr.shipping_address AS client_address
     FROM scheduled_visits sv
     JOIN client_requests cr ON cr.id = sv.client_request_id
     WHERE sv.schedule_id = $1
     ORDER BY sv.planned_date ASC, sv.priority ASC`,
    [id],
  );
  return { ...schedule, visits };
}

async function createSchedule({ month, year, notes, user }) {
  assertAdvisor(user);
  if (!month || !year) {
    const error = new Error("Mes y año son obligatorios");
    error.status = 400;
    throw error;
  }

  const { rows: existing } = await db.query(
    `SELECT id FROM visit_schedules WHERE user_email = $1 AND month = $2 AND year = $3 LIMIT 1`,
    [user.email, month, year],
  );
  if (existing.length) {
    const error = new Error("Ya existe un cronograma para ese mes");
    error.status = 409;
    throw error;
  }

  const { rows } = await db.query(
    `INSERT INTO visit_schedules (user_email, month, year, notes) VALUES ($1,$2,$3,$4) RETURNING *`,
    [user.email, month, year, notes || null],
  );
  return rows[0];
}

async function updateSchedule({ id, notes, user }) {
  assertAdvisor(user);
  const schedule = await findScheduleOrThrow(id);
  ensureOwner(schedule, user);
  if (schedule.status !== "draft" && schedule.status !== "rejected") {
    const error = new Error("Solo se pueden editar cronogramas en borrador o rechazados");
    error.status = 400;
    throw error;
  }

  const { rows } = await db.query(
    `UPDATE visit_schedules SET notes = $1, updated_at = NOW(), rejection_reason = NULL WHERE id = $2 RETURNING *`,
    [notes || null, id],
  );
  return rows[0];
}

async function deleteSchedule({ id, user }) {
  assertAdvisor(user);
  const schedule = await findScheduleOrThrow(id);
  ensureOwner(schedule, user);
  if (schedule.status === "approved") {
    const error = new Error("No se puede eliminar un cronograma aprobado");
    error.status = 400;
    throw error;
  }
  if (schedule.status !== "draft" && schedule.status !== "rejected") {
    const error = new Error("Solo se pueden eliminar cronogramas en borrador o rechazados");
    error.status = 400;
    throw error;
  }
  await db.query("DELETE FROM visit_schedules WHERE id = $1", [id]);
  return { deleted: true };
}

async function submitForApproval({ id, user }) {
  assertAdvisor(user);
  const schedule = await findScheduleOrThrow(id);
  ensureOwner(schedule, user);
  if (schedule.status !== "draft" && schedule.status !== "rejected") {
    const error = new Error("Solo puedes enviar cronogramas en borrador o rechazados");
    error.status = 400;
    throw error;
  }
  const { rows: visits } = await db.query(
    `SELECT COUNT(1) AS total FROM scheduled_visits WHERE schedule_id = $1`,
    [id],
  );
  if (Number(visits[0]?.total || 0) === 0) {
    const error = new Error("Agrega al menos una visita antes de enviar");
    error.status = 400;
    throw error;
  }
  const { rows } = await db.query(
    `UPDATE visit_schedules
     SET status = 'pending_approval', submitted_at = NOW(), rejection_reason = NULL
     WHERE id = $1
     RETURNING *`,
    [id],
  );
  return rows[0];
}

async function addVisit({ scheduleId, clientRequestId, plannedDate, city, priority, notes, user }) {
  assertAdvisor(user);
  const schedule = await findScheduleOrThrow(scheduleId);
  ensureOwner(schedule, user);
  if (schedule.status !== "draft" && schedule.status !== "rejected") {
    const error = new Error("Solo se pueden editar visitas en cronogramas en borrador");
    error.status = 400;
    throw error;
  }
  if (!plannedDate || !clientRequestId) {
    const error = new Error("Fecha y cliente son obligatorios");
    error.status = 400;
    throw error;
  }
  const client = await getClientOrThrow(clientRequestId);
  const targetCity = resolveCity({ city, client }) || "Ciudad no especificada";
  const { rows } = await db.query(
    `INSERT INTO scheduled_visits (schedule_id, client_request_id, planned_date, city, priority, notes)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (schedule_id, client_request_id, planned_date) DO UPDATE
     SET city = EXCLUDED.city, priority = EXCLUDED.priority, notes = EXCLUDED.notes, updated_at = NOW()
     RETURNING *`,
    [scheduleId, clientRequestId, plannedDate, targetCity, priority || 1, notes || null],
  );
  return rows[0];
}

async function updateVisit({ scheduleId, visitId, city, plannedDate, priority, notes, user }) {
  assertAdvisor(user);
  const schedule = await findScheduleOrThrow(scheduleId);
  ensureOwner(schedule, user);
  if (schedule.status !== "draft" && schedule.status !== "rejected") {
    const error = new Error("Solo se pueden editar visitas en cronogramas en borrador");
    error.status = 400;
    throw error;
  }
  const { rows } = await db.query("SELECT * FROM scheduled_visits WHERE id = $1 AND schedule_id = $2", [visitId, scheduleId]);
  if (!rows.length) {
    const error = new Error("Visita no encontrada");
    error.status = 404;
    throw error;
  }
  const visit = rows[0];
  const client = await getClientOrThrow(visit.client_request_id);
  const targetCity = resolveCity({ city: city || visit.city, client }) || "Ciudad no especificada";
  const { rows: updated } = await db.query(
    `UPDATE scheduled_visits
     SET city = $1, planned_date = $2, priority = $3, notes = $4, updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [targetCity, plannedDate || visit.planned_date, priority || visit.priority, notes || visit.notes, visitId],
  );
  return updated[0];
}

async function deleteVisit({ scheduleId, visitId, user }) {
  assertAdvisor(user);
  const schedule = await findScheduleOrThrow(scheduleId);
  ensureOwner(schedule, user);
  if (schedule.status !== "draft" && schedule.status !== "rejected") {
    const error = new Error("Solo se pueden editar visitas en cronogramas en borrador");
    error.status = 400;
    throw error;
  }
  await db.query("DELETE FROM scheduled_visits WHERE id = $1 AND schedule_id = $2", [visitId, scheduleId]);
  return { deleted: true };
}

async function approveSchedule({ id, user }) {
  assertManager(user);
  const schedule = await findScheduleOrThrow(id);
  if (schedule.status !== "pending_approval") {
    const error = new Error("Solo puedes aprobar cronogramas pendientes");
    error.status = 400;
    throw error;
  }
  const { rows } = await db.query(
    `UPDATE visit_schedules
     SET status = 'approved', reviewed_by_email = $1, reviewed_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [user.email, id],
  );
  return rows[0];
}

async function rejectSchedule({ id, reason, user }) {
  assertManager(user);
  if (!reason) {
    const error = new Error("Debes incluir una razón de rechazo");
    error.status = 400;
    throw error;
  }
  const schedule = await findScheduleOrThrow(id);
  if (schedule.status !== "pending_approval") {
    const error = new Error("Solo puedes rechazar cronogramas pendientes");
    error.status = 400;
    throw error;
  }
  const { rows } = await db.query(
    `UPDATE visit_schedules
     SET status = 'rejected', reviewed_by_email = $1, reviewed_at = NOW(), rejection_reason = $2
     WHERE id = $3
     RETURNING *`,
    [user.email, reason, id],
  );
  return rows[0];
}

async function getAnalytics(user) {
  assertManager(user);
  const { rows } = await db.query(
    `SELECT status, COUNT(*) AS total FROM visit_schedules GROUP BY status`,
  );
  const byStatus = rows.reduce((acc, row) => ({ ...acc, [row.status]: Number(row.total) }), {});
  const { rows: visits } = await db.query(
    `SELECT city, COUNT(*) AS total FROM scheduled_visits GROUP BY city ORDER BY total DESC LIMIT 10`,
  );
  return { byStatus, topCities: visits };
}

module.exports = {
  listMySchedules,
  listPendingApproval,
  listTeamSchedules,
  getScheduleDetail,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  submitForApproval,
  addVisit,
  updateVisit,
  deleteVisit,
  approveSchedule,
  rejectSchedule,
  getAnalytics,
};
