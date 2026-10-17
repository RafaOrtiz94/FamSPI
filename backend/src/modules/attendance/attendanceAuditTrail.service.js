const db = require("../../config/db");
const logger = require("../../config/logger");

const logAttendanceAuditEvent = async ({
  actorUserId = null,
  affectedUserId = null,
  action,
  endpoint = null,
  method = null,
  oldValue = null,
  newValue = null,
  result = "ok",
  reason = null,
  requestContext = {},
}) => {
  try {
    await db.query(
      `INSERT INTO attendance_audit_events (
        actor_user_id, affected_user_id, action, endpoint, method,
        old_value, new_value, result, reason,
        request_id, correlation_id, source_channel, ip, user_agent
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,$14)`,
      [
        actorUserId,
        affectedUserId,
        action,
        endpoint,
        method,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        result,
        reason,
        requestContext.requestId || null,
        requestContext.correlationId || null,
        requestContext.sourceChannel || null,
        requestContext.ip || null,
        requestContext.userAgent || null,
      ],
    );
  } catch (err) {
    logger.warn({ err: err?.message, action }, "attendance_audit_events insert failed");
  }
};

module.exports = {
  logAttendanceAuditEvent,
};
