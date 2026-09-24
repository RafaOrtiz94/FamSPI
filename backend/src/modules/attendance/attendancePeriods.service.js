const db = require("../../config/db");

const CAN_MANAGE_PERIOD_ROLES = new Set([
  "talento_humano",
  "jefe_talento_humano",
  "jefe_de_talento_humano",
  "gerencia",
  "gerencia_general",
  "admin",
  "administrador",
]);

const normalizeRole = (value) => String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
const canManageAttendancePeriods = (user = {}) => CAN_MANAGE_PERIOD_ROLES.has(normalizeRole(user.role));

const getCurrentPeriod = async () => {
  const result = await db.query(
    `SELECT *
       FROM attendance_periods
      WHERE starts_on <= (NOW() AT TIME ZONE 'America/Guayaquil')::date
        AND ends_on >= (NOW() AT TIME ZONE 'America/Guayaquil')::date
      ORDER BY id DESC
      LIMIT 1`
  );
  return result.rows[0] || null;
};

const transitionPeriod = async ({ periodKey, newStatus, actorUserId, reason, requestContext }) => {
  const current = await db.query(`SELECT * FROM attendance_periods WHERE period_key = $1 LIMIT 1`, [periodKey]);
  const row = current.rows[0];
  if (!row) return null;

  const updated = await db.query(
    `UPDATE attendance_periods
        SET status = $2,
            closed_by_user_id = CASE WHEN $2 = 'closed' THEN $3 ELSE closed_by_user_id END,
            closed_at = CASE WHEN $2 = 'closed' THEN NOW() ELSE closed_at END,
            reopened_by_user_id = CASE WHEN $2 = 'reopened' THEN $3 ELSE reopened_by_user_id END,
            reopened_at = CASE WHEN $2 = 'reopened' THEN NOW() ELSE reopened_at END,
            reopen_count = CASE WHEN $2 = 'reopened' THEN reopen_count + 1 ELSE reopen_count END,
            updated_at = NOW()
      WHERE period_key = $1
      RETURNING *`,
    [periodKey, newStatus, actorUserId],
  );

  const transitioned = updated.rows[0];
  await db.query(
    `INSERT INTO attendance_period_events (
      period_id, previous_status, new_status, reason, actor_user_id,
      request_id, correlation_id, ip, user_agent, source_channel
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      transitioned.id,
      row.status,
      newStatus,
      reason || null,
      actorUserId,
      requestContext?.requestId || null,
      requestContext?.correlationId || null,
      requestContext?.ip || null,
      requestContext?.userAgent || null,
      requestContext?.sourceChannel || null,
    ],
  );

  return transitioned;
};

module.exports = {
  canManageAttendancePeriods,
  getCurrentPeriod,
  transitionPeriod,
};
