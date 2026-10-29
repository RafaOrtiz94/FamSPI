const db = require("../../config/db");
const logger = require("../../config/logger");
const notificationManager = require("../notifications/notificationManager");
const { getBusinessDate } = require("./attendance.utils");

const TELEWORK_NOTIFICATION_SOURCE = "attendance.telework";
const TELEWORK_REPORT_PATH = "/dashboard/talento-humano/asistencia-reportes";
const TELEWORK_MARKING_PATH = "/dashboard";

const normalizeText = (value, maxLength = 255) => {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
};

const normalizeRole = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const hasExactTalentHumanRole = (user = {}) => {
  const candidates = [
    user.role,
    user.scope,
    user.role_name,
    user.rol,
    ...(Array.isArray(user.roles) ? user.roles : []),
    ...(Array.isArray(user.scopes) ? user.scopes : []),
  ];
  return candidates.some((candidate) => normalizeRole(candidate) === "talento_humano");
};

const normalizeLocation = (value) => {
  const location = normalizeText(value, 120);
  if (!location) return null;
  const [rawLat, rawLng] = location.split(",").map((part) => Number(String(part).trim()));
  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) return null;
  if (rawLat < -90 || rawLat > 90 || rawLng < -180 || rawLng > 180) return null;
  if (Math.abs(rawLat) <= 0.0005 && Math.abs(rawLng) <= 0.0005) return null;
  return `${rawLat},${rawLng}`;
};

const normalizeRequestDate = (value, now = new Date()) => {
  const currentDate = getBusinessDate(now);
  const candidate = String(value || currentDate).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    const error = new Error("La fecha del teletrabajo no es valida");
    error.status = 400;
    error.code = "TELEWORK_DATE_INVALID";
    throw error;
  }
  const parsed = new Date(`${candidate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate) {
    const error = new Error("La fecha del teletrabajo no es valida");
    error.status = 400;
    error.code = "TELEWORK_DATE_INVALID";
    throw error;
  }
  if (candidate < currentDate) {
    const error = new Error("No puedes solicitar teletrabajo para una fecha pasada");
    error.status = 400;
    error.code = "TELEWORK_DATE_IN_PAST";
    throw error;
  }
  return candidate;
};

const serializeRequest = (row) => ({
  id: Number(row.id),
  user_id: Number(row.user_id),
  user_name: row.user_name || row.user_fullname || row.user_email || `Usuario #${row.user_id}`,
  user_email: row.user_email || null,
  request_date: row.request_date,
  city: row.city,
  location: row.location,
  location_accuracy: row.location_accuracy === null ? null : Number(row.location_accuracy),
  reason: row.reason || null,
  status: row.status,
  reviewed_by_user_id: row.reviewed_by_user_id ? Number(row.reviewed_by_user_id) : null,
  reviewed_at: row.reviewed_at || null,
  review_reason: row.review_reason || null,
  consumed_at: row.consumed_at || null,
  consumed_exception_id: row.consumed_exception_id ? Number(row.consumed_exception_id) : null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const selectRequest = `
  SELECT r.*, u.email AS user_email, COALESCE(u.fullname, u.name, u.email) AS user_name
    FROM attendance_telework_requests r
    JOIN users u ON u.id = r.user_id
`;

const notifyRequestCreated = async (request) => {
  try {
    const [{ rows: requesterRows }, { rows: talentRows }] = await Promise.all([
      db.query(
        "SELECT id, email, COALESCE(fullname, name, email) AS user_name FROM users WHERE id = $1 LIMIT 1",
        [request.user_id],
      ),
      db.query(
        `SELECT id FROM users
          WHERE regexp_replace(LOWER(TRIM(COALESCE(role, ''))), '[[:space:]-]+', '_', 'g') = 'talento_humano'`,
      ),
    ]);
    const requester = requesterRows[0] || {};
    const processKey = `attendance-telework-request:${request.id}`;
    const requesterName = requester.user_name || requester.email || `Usuario #${request.user_id}`;
    const recipients = talentRows
      .map((user) => Number(user.id))
      .filter((userId) => Number.isInteger(userId) && userId > 0);

    await Promise.allSettled(recipients.map((userId) => notificationManager.sendNotification({
      userId,
      customTitle: "Nueva solicitud de teletrabajo",
      customMessage: `${requesterName} solicitó teletrabajo para el ${request.request_date} en ${request.city}. Revisa la solicitud para aprobarla o rechazarla.`,
      type: "task",
      priority: 1,
      source: TELEWORK_NOTIFICATION_SOURCE,
      // Accion exclusiva de TH (nadie mas la recibe) -- solo chat, no correo.
      email: false,
      chat: true,
      meta: {
        process_key: processKey,
        request_id: request.id,
        target_path: TELEWORK_REPORT_PATH,
        cta_label: "Revisar solicitud",
      },
    })));
  } catch (error) {
    logger.warn({ error, requestId: request?.id }, "No se pudo notificar nueva solicitud de teletrabajo");
  }
};

const notifyRequestDecision = async ({ request, status, reviewReason }) => {
  try {
    const approved = status === "APPROVED";
    const reasonText = reviewReason ? ` Motivo: ${reviewReason}.` : "";
    await notificationManager.sendNotification({
      userId: request.user_id,
      customTitle: approved ? "Teletrabajo aprobado" : "Teletrabajo rechazado",
      customMessage: approved
        ? `Tu solicitud de teletrabajo para el ${request.request_date} fue aprobada. Ya puedes registrar la marcación en esa fecha.`
        : `Tu solicitud de teletrabajo para el ${request.request_date} fue rechazada.${reasonText}`,
      type: approved ? "success" : "warning",
      priority: 1,
      source: TELEWORK_NOTIFICATION_SOURCE,
      email: true,
      meta: {
        process_key: `attendance-telework-request:${request.id}`,
        request_id: request.id,
        status,
        target_path: TELEWORK_MARKING_PATH,
        cta_label: approved ? "Registrar teletrabajo" : "Ver asistencia",
      },
    });
  } catch (error) {
    logger.warn({ error, requestId: request?.id }, "No se pudo notificar decisión de teletrabajo");
  }
};

const getRequestForDate = async ({ userId, requestDate, statuses = ["PENDING", "APPROVED"] }) => {
  const result = await db.query(
    `${selectRequest}
      WHERE r.user_id = $1
        AND r.request_date = $2::date
        AND r.status = ANY($3::text[])
      ORDER BY r.id DESC
      LIMIT 1`,
    [Number(userId), requestDate, statuses]
  );
  return result.rows[0] ? serializeRequest(result.rows[0]) : null;
};

const createRequest = async ({ userId, city, location, locationAccuracy, reason, requestDate, now = new Date() }) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    const error = new Error("Usuario invalido");
    error.status = 401;
    error.code = "TELEWORK_USER_REQUIRED";
    throw error;
  }

  const normalizedCity = normalizeText(city, 120);
  const normalizedLocation = normalizeLocation(location);
  if (!normalizedCity) {
    const error = new Error("La ciudad es obligatoria para solicitar teletrabajo");
    error.status = 400;
    error.code = "TELEWORK_CITY_REQUIRED";
    throw error;
  }
  if (!normalizedLocation) {
    const error = new Error("La ubicación actual es obligatoria para solicitar teletrabajo");
    error.status = 400;
    error.code = "TELEWORK_LOCATION_REQUIRED";
    throw error;
  }

  const normalizedRequestDate = normalizeRequestDate(requestDate, now);
  const existing = await getRequestForDate({ userId: normalizedUserId, requestDate: normalizedRequestDate });
  if (existing) return { request: existing, reused: true };

  try {
    const result = await db.query(
      `INSERT INTO attendance_telework_requests (
         user_id, request_date, city, location, location_accuracy, reason
       )
       VALUES ($1, $2::date, $3, $4, $5, $6)
       RETURNING *`,
      [
        normalizedUserId,
        normalizedRequestDate,
        normalizedCity,
        normalizedLocation,
        Number.isFinite(Number(locationAccuracy)) ? Number(locationAccuracy) : null,
        normalizeText(reason, 1000),
      ]
    );
    const request = serializeRequest(result.rows[0]);
    await notifyRequestCreated(request);
    return { request, reused: false };
  } catch (error) {
    if (error?.code === "23505") {
      const concurrent = await getRequestForDate({ userId: normalizedUserId, requestDate: normalizedRequestDate });
      if (concurrent) return { request: concurrent, reused: true };
    }
    throw error;
  }
};

const listRequests = async ({ userId, canReview = false, requestDate = null }) => {
  const normalizedUserId = Number(userId);
  const params = [];
  const filters = [];
  if (canReview) {
    filters.push("r.status = 'PENDING'");
  } else {
    params.push(normalizedUserId);
    filters.push("r.user_id = $1");
  }
  if (requestDate) {
    params.push(requestDate);
    filters.push(`r.request_date = $${params.length}::date`);
  }
  const result = await db.query(
    `${selectRequest}
      WHERE ${filters.join(" AND ")}
      ORDER BY r.request_date DESC, r.created_at DESC, r.id DESC
      LIMIT 100`,
    params
  );
  return result.rows.map(serializeRequest);
};

const decideRequest = async ({ requestId, reviewer, decision, reviewReason }) => {
  if (!hasExactTalentHumanRole(reviewer)) {
    const error = new Error("Solo talento_humano puede aprobar solicitudes de teletrabajo");
    error.status = 403;
    error.code = "TELEWORK_APPROVAL_FORBIDDEN";
    throw error;
  }
  const normalizedDecision = String(decision || "").trim().toLowerCase();
  const nextStatus = normalizedDecision === "approve" || normalizedDecision === "approved" ? "APPROVED" :
    normalizedDecision === "reject" || normalizedDecision === "rejected" ? "REJECTED" : null;
  if (!nextStatus) {
    const error = new Error("La decisión debe ser aprobar o rechazar");
    error.status = 400;
    error.code = "TELEWORK_DECISION_INVALID";
    throw error;
  }
  const normalizedReason = normalizeText(reviewReason, 1000);
  if (nextStatus === "REJECTED" && !normalizedReason) {
    const error = new Error("Indica el motivo del rechazo");
    error.status = 400;
    error.code = "TELEWORK_REJECTION_REASON_REQUIRED";
    throw error;
  }

  const result = await db.query(
    `${selectRequest}
      WHERE r.id = $1
        AND r.status = 'PENDING'
      FOR UPDATE`,
    [Number(requestId)]
  );
  const current = result.rows[0];
  if (!current) {
    const error = new Error("La solicitud ya fue atendida o no existe");
    error.status = 404;
    error.code = "TELEWORK_REQUEST_NOT_PENDING";
    throw error;
  }

  const updated = await db.query(
    `UPDATE attendance_telework_requests
        SET status = $1,
            reviewed_by_user_id = $2,
            reviewed_at = NOW(),
            review_reason = $3,
            updated_at = NOW()
      WHERE id = $4
      RETURNING *`,
    [nextStatus, Number(reviewer?.id), normalizedReason, Number(requestId)]
  );
  const row = { ...updated.rows[0], user_email: current.user_email, user_name: current.user_name };
  const request = serializeRequest(row);
  await notifyRequestDecision({
    request,
    status: nextStatus,
    reviewReason: normalizedReason,
  });
  return request;
};

const getApprovedRequestForMarking = async ({ userId, requestId = null, requestDate }) => {
  const params = [Number(userId), requestDate];
  const requestFilter = requestId ? "AND r.id = $3" : "";
  if (requestId) params.push(Number(requestId));
  const result = await db.query(
    `SELECT r.*
       FROM attendance_telework_requests r
      WHERE r.user_id = $1
        AND r.request_date = $2::date
        AND r.status = 'APPROVED'
        ${requestFilter}
      ORDER BY r.id DESC
      LIMIT 1`,
    params
  );
  return result.rows[0] || null;
};

const consumeRequest = async ({ requestId, exceptionId }) => {
  if (!requestId) return;
  await db.query(
    `UPDATE attendance_telework_requests
        SET status = 'CONSUMED', consumed_at = NOW(), consumed_exception_id = $1, updated_at = NOW()
      WHERE id = $2 AND status = 'APPROVED'`,
    [Number(exceptionId), Number(requestId)]
  );
};

module.exports = {
  hasExactTalentHumanRole,
  createRequest,
  listRequests,
  decideRequest,
  getApprovedRequestForMarking,
  consumeRequest,
};
