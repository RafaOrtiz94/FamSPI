const db = require("../../config/db");
const logger = require("../../config/logger");
const { sendMail } = require("../../utils/mailer");
const { renderProviderEmail } = require("../../utils/emailTemplate");
const { createNotification } = require("../notifications/notifications.service");

const CLOSE_STATUSES = ["confirmed", "rejected", "cu_pending", "import_pending"];
const SUPPLIER_RESULTS = ["available_new", "available_cu", "import_only", "unavailable"];
const VIEW_ALL_ROLES = ["acp_comercial", "jefe_comercial", "gerencia", "gerencia_general", "admin", "administrador"];

const httpError = (message, status = 400, code = "BC_AVAILABILITY_ERROR") =>
  Object.assign(new Error(message), { status, code });

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const normalizeEmails = (value) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : String(value || "").split(/[,\s;]+/))
        .map((e) => String(e || "").trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
    ),
  );

const canViewAll = (user) => VIEW_ALL_ROLES.includes(String(user?.role || "").toLowerCase());

const SELECT_WITH_QUERIES = `
  SELECT r.*,
         COALESCE((
           SELECT json_agg(q ORDER BY q.sent_at, q.id)
             FROM public.bc_availability_supplier_queries q
            WHERE q.availability_id = r.id
         ), '[]'::json) AS queries
    FROM public.bc_availability_requests r`;

async function notifyUsers(userIds, { title, message, meta }) {
  await Promise.all(
    userIds.filter(Boolean).map((user_id) =>
      createNotification({ user_id, title, message, type: "info", source: "bc_availability", meta }).catch((err) =>
        logger.warn({ err, user_id }, "No se pudo notificar disponibilidad BC"),
      ),
    ),
  );
}

async function getAcpUserIds() {
  const { rows } = await db.query("SELECT id FROM users WHERE lower(role) = 'acp_comercial'");
  return rows.map((r) => r.id);
}

async function getById(id, user) {
  const { rows } = await db.query(`${SELECT_WITH_QUERIES} WHERE r.id = $1`, [id]);
  const row = rows[0];
  if (!row) throw httpError("Solicitud de disponibilidad no encontrada", 404, "NOT_FOUND");
  if (!canViewAll(user) && Number(row.requested_by) !== Number(user?.id)) {
    throw httpError("No tienes acceso a esta solicitud", 403, "FORBIDDEN");
  }
  return row;
}

async function list({ user, businessCaseId, status }) {
  const params = [];
  const where = [];
  if (businessCaseId) {
    params.push(businessCaseId);
    where.push(`r.business_case_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`r.status = $${params.length}`);
  }
  if (!canViewAll(user)) {
    params.push(user?.id);
    where.push(`r.requested_by = $${params.length}`);
  }
  const { rows } = await db.query(
    `${SELECT_WITH_QUERIES} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY r.created_at DESC LIMIT 200`,
    params,
  );
  return rows;
}

// Comercial solicita; no genera ningun formulario ni solicitud generica (no existe procedimiento F.ST para esto).
async function create({ user, businessCaseId, servicioEquipoId, equipmentName, notes }) {
  const bc = await db.query("SELECT id FROM public.equipment_purchase_requests WHERE id = $1", [businessCaseId]);
  if (!bc.rows[0]) throw httpError("Business Case no encontrado", 404, "BC_NOT_FOUND");

  const open = await db.query(
    `SELECT id FROM public.bc_availability_requests
      WHERE business_case_id = $1 AND servicio_equipo_id = $2 AND status IN ('requested','in_progress')`,
    [businessCaseId, String(servicioEquipoId)],
  );
  if (open.rows[0]) {
    throw httpError("Ya hay una solicitud abierta para este equipo en el Business Case", 409, "ALREADY_OPEN");
  }

  const { rows } = await db.query(
    `INSERT INTO public.bc_availability_requests
       (business_case_id, servicio_equipo_id, equipment_name, notes, requested_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [businessCaseId, String(servicioEquipoId), equipmentName || null, notes || null, user.id],
  );
  const created = rows[0];

  await notifyUsers(await getAcpUserIds(), {
    title: "Nueva solicitud de disponibilidad de equipo",
    message: `${equipmentName || "Equipo"} — Business Case ${businessCaseId}`,
    meta: { availability_id: created.id, business_case_id: businessCaseId },
  });
  return created;
}

// ACP consulta a uno o varios proveedores (un correo por proveedor para poder registrar cada respuesta).
async function sendToSuppliers({ id, user, providerEmails, notes }) {
  const emails = normalizeEmails(providerEmails);
  if (!emails.length) throw httpError("Ingresa al menos un correo de proveedor válido", 400, "PROVIDER_EMAIL_REQUIRED");

  const request = await getById(id, user);
  if (!["requested", "in_progress"].includes(request.status)) {
    throw httpError("La solicitud ya fue cerrada", 409, "ALREADY_CLOSED");
  }

  const html = renderProviderEmail({
    title: "Solicitud de disponibilidad de equipo",
    bodyHtml: `
      <p>Nos gustaría confirmar la disponibilidad del siguiente equipo:</p>
      <p>• <strong>${escapeHtml(request.equipment_name || "Equipo")}</strong></p>
      ${notes || request.notes ? `<p><strong>Notas:</strong> ${escapeHtml(notes || request.notes)}</p>` : ""}
      <p>Por favor indíquenos si está disponible nuevo, en condición de uso (CU), solo vía importación o no disponible.</p>`,
    user,
  });

  const sent = [];
  for (const email of emails) {
    const result = await sendMail({
      to: email,
      subject: `Solicitud de disponibilidad - ${request.equipment_name || "Equipo"} (#${request.id})`,
      html,
      gmailUserId: user?.id,
      from: user?.email,
      replyTo: user?.email,
    });
    const { rows } = await db.query(
      `INSERT INTO public.bc_availability_supplier_queries (availability_id, provider_email, email_thread_id)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, email, result?.providerThreadId || null],
    );
    sent.push(rows[0]);
  }

  await db.query(
    "UPDATE public.bc_availability_requests SET status = 'in_progress', updated_at = now() WHERE id = $1",
    [id],
  );
  return { sent, request: await getById(id, user) };
}

async function recordSupplierResponse({ id, queryId, user, result, notes }) {
  if (!SUPPLIER_RESULTS.includes(result)) throw httpError("Resultado del proveedor inválido", 400, "INVALID_RESULT");
  const request = await getById(id, user);
  if (["confirmed", "rejected"].includes(request.status)) throw httpError("La solicitud ya fue cerrada", 409, "ALREADY_CLOSED");

  const { rowCount } = await db.query(
    `UPDATE public.bc_availability_supplier_queries
        SET response_result = $1, response_notes = $2, responded_at = now()
      WHERE id = $3 AND availability_id = $4`,
    [result, notes || null, queryId, id],
  );
  if (!rowCount) throw httpError("Consulta a proveedor no encontrada", 404, "QUERY_NOT_FOUND");
  return getById(id, user);
}

// ACP cierra con resultado consolidado y avisa al comercial solicitante.
async function close({ id, user, status, notes }) {
  if (!CLOSE_STATUSES.includes(status)) throw httpError("Estado de cierre inválido", 400, "INVALID_STATUS");
  const request = await getById(id, user);
  if (["confirmed", "rejected"].includes(request.status)) throw httpError("La solicitud ya fue cerrada", 409, "ALREADY_CLOSED");

  await db.query(
    `UPDATE public.bc_availability_requests
        SET status = $1, result_notes = $2, closed_by = $3, closed_at = now(), updated_at = now()
      WHERE id = $4`,
    [status, notes || null, user.id, id],
  );

  const labels = {
    confirmed: "confirmada",
    rejected: "rechazada",
    cu_pending: "disponible en CU (requiere aprobación del cliente)",
    import_pending: "solo vía importación (requiere compromiso del cliente)",
  };
  await notifyUsers([request.requested_by], {
    title: "Disponibilidad de equipo respondida",
    message: `${request.equipment_name || "Equipo"}: ${labels[status]}${notes ? ` — ${notes}` : ""}`,
    meta: { availability_id: id, business_case_id: request.business_case_id, status },
  });
  return getById(id, user);
}

module.exports = { list, getById, create, sendToSuppliers, recordSupplierResponse, close, SUPPLIER_RESULTS, CLOSE_STATUSES };
