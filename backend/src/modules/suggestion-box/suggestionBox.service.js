const crypto = require("crypto");
const db = require("../../config/db");

const SUBMISSION_TYPES = new Set(["suggestion", "complaint"]);
const STATUSES = new Set(["received", "in_review", "resolved", "closed"]);

const MANAGER_ROLES = [
  "calidad",
  "jefe_calidad",
  "jefe_de_calidad",
  "gerencia",
  "gerencia_general",
  "gerente_general",
  "director",
  "gerente",
  "ti",
  "jefe_ti",
  "jefe_de_ti",
  "admin_ti",
  "admin",
  "administrador",
];

function error(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function text(value, { required = false, max = 0, field = "Campo" } = {}) {
  const normalized = String(value || "").trim();
  if (required && !normalized) throw error(`${field} es obligatorio`);
  if (max && normalized.length > max) throw error(`${field} excede el máximo permitido`);
  return normalized || null;
}

function bool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!SUBMISSION_TYPES.has(normalized)) throw error("Tipo de mensaje no permitido");
  return normalized;
}

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!STATUSES.has(normalized)) throw error("Estado no permitido");
  return normalized;
}

function referenceCode() {
  return `BQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function createSubmission(payload = {}, { source, user = null } = {}) {
  const submissionType = normalizeType(payload.submission_type);
  if (bool(payload.is_anonymous)) {
    throw error("El envio anonimo no esta disponible");
  }
  const isAnonymous = false;
  const subject = text(payload.subject, { required: true, max: 160, field: "Asunto" });
  const message = text(payload.message, { required: true, max: 5000, field: "Mensaje" });
  const reporterName = isAnonymous ? null : text(source === "internal" ? (user?.fullname || user?.name) : payload.reporter_name, { max: 160, field: "Nombre" });
  const reporterEmail = isAnonymous ? null : text(source === "internal" ? user?.email : payload.reporter_email, { max: 254, field: "Correo" });
  const reporterPhone = isAnonymous ? null : text(payload.reporter_phone, { max: 50, field: "Teléfono" });

  if (!isAnonymous && source === "external" && !reporterName && !reporterEmail) {
    throw error("Indica tu nombre o correo, o selecciona envío anónimo");
  }
  if (reporterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) throw error("Correo no válido");
  if (text(payload.website, { max: 0 }) !== null) throw error("No se pudo registrar el mensaje");

  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO public.suggestion_box_submissions
         (reference_code, submission_type, source, is_anonymous, reporter_name, reporter_email, reporter_phone, reporter_user_id, subject, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, reference_code, submission_type, status, created_at`,
      [referenceCode(), submissionType, source, isAnonymous, reporterName, reporterEmail, reporterPhone, source === "internal" ? user?.id || null : null, subject, message],
    );
    const submission = rows[0];
    await client.query(
      `INSERT INTO public.suggestion_box_events (submission_id, event_type, payload, created_by)
       VALUES ($1,'submission_created',$2::jsonb,$3)`,
      [submission.id, JSON.stringify({ source, submission_type: submissionType, is_anonymous: isAnonymous }), source === "internal" ? user?.id || null : null],
    );
    await client.query("COMMIT");
    return submission;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function listSubmissions({ status, submissionType, q, limit = 100 } = {}) {
  const params = [];
  const where = [];
  if (status) { params.push(normalizeStatus(status)); where.push(`s.status = $${params.length}`); }
  if (submissionType) { params.push(normalizeType(submissionType)); where.push(`s.submission_type = $${params.length}`); }
  if (q && String(q).trim()) {
    params.push(`%${String(q).trim().toLowerCase()}%`);
    where.push(`(LOWER(s.reference_code) LIKE $${params.length} OR LOWER(s.subject) LIKE $${params.length} OR LOWER(COALESCE(s.reporter_name,'')) LIKE $${params.length} OR LOWER(COALESCE(s.reporter_email,'')) LIKE $${params.length})`);
  }
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
  params.push(safeLimit);
  const { rows } = await db.query(
    `SELECT s.*, COALESCE(a.fullname, a.name, a.email) AS assigned_to_name
       FROM public.suggestion_box_submissions s
       LEFT JOIN public.users a ON a.id = s.assigned_to_user_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY CASE s.status WHEN 'received' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END, s.created_at DESC
      LIMIT $${params.length}`,
    params,
  );
  return rows;
}

async function getSubmission(submissionId) {
  const { rows } = await db.query(
    `SELECT s.*, COALESCE(a.fullname, a.name, a.email) AS assigned_to_name
       FROM public.suggestion_box_submissions s
       LEFT JOIN public.users a ON a.id = s.assigned_to_user_id
      WHERE s.id = $1`,
    [submissionId],
  );
  if (!rows.length) throw error("Registro no encontrado", 404);
  const events = await db.query(
    `SELECT e.*, COALESCE(u.fullname, u.name, u.email) AS created_by_name
       FROM public.suggestion_box_events e
       LEFT JOIN public.users u ON u.id = e.created_by
      WHERE e.submission_id = $1
      ORDER BY e.created_at ASC, e.id ASC`,
    [submissionId],
  );
  return { ...rows[0], events: events.rows };
}

async function updateStatus(submissionId, payload = {}, userId) {
  const status = normalizeStatus(payload.status);
  const resolutionNotes = text(payload.resolution_notes, { max: 5000, field: "Notas de resolución" });
  const assignedToUserId = payload.assigned_to_user_id ? Number(payload.assigned_to_user_id) : null;
  if (assignedToUserId && (!Number.isInteger(assignedToUserId) || assignedToUserId <= 0)) throw error("Responsable no válido");
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE public.suggestion_box_submissions
          SET status = $1,
              resolution_notes = COALESCE($2, resolution_notes),
              assigned_to_user_id = COALESCE($3, assigned_to_user_id),
              resolved_at = CASE WHEN $1 IN ('resolved','closed') THEN now() ELSE NULL END,
              updated_at = now()
        WHERE id = $4
        RETURNING *`,
      [status, resolutionNotes, assignedToUserId, submissionId],
    );
    if (!rows.length) throw error("Registro no encontrado", 404);
    await client.query(
      `INSERT INTO public.suggestion_box_events (submission_id, event_type, payload, created_by)
       VALUES ($1,'status_updated',$2::jsonb,$3)`,
      [submissionId, JSON.stringify({ status, resolution_notes: resolutionNotes, assigned_to_user_id: assignedToUserId }), userId],
    );
    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { MANAGER_ROLES, createSubmission, listSubmissions, getSubmission, updateStatus };
