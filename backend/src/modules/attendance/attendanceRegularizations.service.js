const db = require("../../config/db");

const normalizeRole = (value) => String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

const MANAGEMENT_ROLES = new Set([
  "jefe_comercial",
  "jefe_tecnico",
  "jefe_ti",
  "jefe_logistica",
  "jefe_operaciones",
  "jefe_talento_humano",
  "jefe_de_talento_humano",
  "talento_humano",
  "gerencia",
  "gerencia_general",
  "admin",
  "administrador",
]);

const canApproveRegularization = (user = {}) => {
  const roles = [user.role, user.scope, user.role_name, user.rol]
    .map(normalizeRole)
    .filter(Boolean);
  return roles.some((r) => MANAGEMENT_ROLES.has(r));
};

const createRegularization = async ({ requesterUserId, affectedUserId, attendanceDate, regularizationType, reason, originalTimestamp, requestedTimestamp, evidence, requestContext }) => {
  const result = await db.query(
    `INSERT INTO attendance_regularizations (
      requester_user_id, affected_user_id, attendance_date, regularization_type, reason,
      original_timestamp, requested_timestamp, evidence, status, request_id, correlation_id, source_channel
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'pending',$9,$10,$11)
    RETURNING *`,
    [
      requesterUserId,
      affectedUserId,
      attendanceDate,
      regularizationType,
      reason,
      originalTimestamp || null,
      requestedTimestamp || null,
      evidence ? JSON.stringify(evidence) : null,
      requestContext?.requestId || null,
      requestContext?.correlationId || null,
      requestContext?.sourceChannel || null,
    ],
  );

  const regularization = result.rows[0];
  await db.query(
    `INSERT INTO attendance_regularization_events (
      regularization_id, previous_status, new_status, actor_user_id, actor_role, comment,
      request_id, correlation_id, ip, user_agent, source_channel
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      regularization.id,
      "draft",
      "pending",
      requesterUserId,
      null,
      "Solicitud creada",
      requestContext?.requestId || null,
      requestContext?.correlationId || null,
      requestContext?.ip || null,
      requestContext?.userAgent || null,
      requestContext?.sourceChannel || null,
    ],
  );

  return regularization;
};

const listRegularizations = async ({ requesterUserId, includeTeam = false }) => {
  if (includeTeam) {
    const result = await db.query(
      `SELECT r.*
         FROM attendance_regularizations r
        ORDER BY r.created_at DESC
        LIMIT 500`
    );
    return result.rows;
  }

  const result = await db.query(
    `SELECT r.*
       FROM attendance_regularizations r
      WHERE r.requester_user_id = $1 OR r.affected_user_id = $1
      ORDER BY r.created_at DESC
      LIMIT 500`,
    [requesterUserId],
  );
  return result.rows;
};

const transitionRegularization = async ({ regularizationId, actorUserId, actorRole, nextStatus, comment, requestContext }) => {
  const currentRes = await db.query(`SELECT * FROM attendance_regularizations WHERE id = $1 LIMIT 1`, [regularizationId]);
  const current = currentRes.rows[0];
  if (!current) return null;

  const allowed = {
    approved: "approved_at",
    rejected: "rejected_at",
    cancelled: "cancelled_at",
    applied: "applied_at",
  };
  if (!allowed[nextStatus]) {
    throw new Error("INVALID_STATUS_TRANSITION");
  }

  const timestampColumn = allowed[nextStatus];
  const updateSql = `
    UPDATE attendance_regularizations
       SET status = $2,
           approver_user_id = CASE WHEN $2 IN ('approved','rejected') THEN $3 ELSE approver_user_id END,
           approver_comment = COALESCE($4, approver_comment),
           ${timestampColumn} = NOW(),
           updated_at = NOW()
     WHERE id = $1
     RETURNING *`;

  const updated = await db.query(updateSql, [regularizationId, nextStatus, actorUserId, comment || null]);
  const row = updated.rows[0];

  await db.query(
    `INSERT INTO attendance_regularization_events (
      regularization_id, previous_status, new_status, actor_user_id, actor_role, comment,
      request_id, correlation_id, ip, user_agent, source_channel
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      regularizationId,
      current.status,
      nextStatus,
      actorUserId,
      actorRole || null,
      comment || null,
      requestContext?.requestId || null,
      requestContext?.correlationId || null,
      requestContext?.ip || null,
      requestContext?.userAgent || null,
      requestContext?.sourceChannel || null,
    ],
  );

  return row;
};

module.exports = {
  canApproveRegularization,
  createRegularization,
  listRegularizations,
  transitionRegularization,
};
