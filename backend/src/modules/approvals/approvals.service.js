/**
 * Service: Approvals
 * ------------------
 * Maneja el flujo de revisión y aprobación de solicitudes.
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const audit = require("../../utils/audit");
const { sendMail } = require("../../utils/mailer");
const requestsService = require("../requests/requests.service");

const MAIL_ENABLED = process.env.DISABLE_MAIL !== "true";
const REQUEST_TYPE_LABELS = {
  "F.ST-20": "Solicitud de inspección de ambiente",
  "F.ST-21": "Solicitud de retiro de equipo",
  "F.ST-22": "Registro de nuevo cliente",
};

const getRequestLabel = (code, fallback) =>
  (code && REQUEST_TYPE_LABELS[code]) || fallback || code || "Solicitud";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const FINAL_REQUEST_STATUSES = [
  "approved",
  "aprobado",
  "rechazado",
  "rejected",
  "cancelado",
  "cancelled",
];

const buildPendingAssignmentsClause = (actorId, params) => {
  if (!Number.isInteger(actorId)) {
    return "";
  }

  params.push(actorId);
  const actorParam = `$${params.length}`;

  return `
    AND (
      EXISTS (
        SELECT 1
        FROM request_approvals pa
        WHERE pa.request_id = r.id
          AND pa.approver_id = ${actorParam}
          AND pa.action IS NULL
          AND COALESCE(pa.used, FALSE) = FALSE
          AND (pa.token_expires_at IS NULL OR pa.token_expires_at >= NOW())
      )
      OR NOT EXISTS (
        SELECT 1
        FROM request_approvals pa
        WHERE pa.request_id = r.id
          AND pa.action IS NULL
          AND COALESCE(pa.used, FALSE) = FALSE
          AND (pa.token_expires_at IS NULL OR pa.token_expires_at >= NOW())
      )
    )
  `;
};

/**
 * 📋 Listar solicitudes pendientes
 * Filtra por rol o tipo de solicitud.
 */
async function listPending(page = 1, pageSize = 10, actor = {}) {
  const offset = (page - 1) * pageSize;
  const baseParams = [FINAL_REQUEST_STATUSES];
  const visibilityClause = buildPendingAssignmentsClause(actor?.id, baseParams);
  const baseQuery = `
    FROM requests r
    JOIN request_types rt ON r.request_type_id = rt.id
    JOIN users u ON u.id = r.requester_id
    WHERE LOWER(r.status) <> ALL($1::text[])
    ${visibilityClause}
  `;
  const listParams = [...baseParams, pageSize, offset];
  const limitParam = `$${listParams.length - 1}`;
  const offsetParam = `$${listParams.length}`;

  const q = await db.query(
    `
    SELECT r.id,
           r.status,
           r.created_at,
           COALESCE(u.fullname, u.name, u.email) AS requester_name,
           rt.code AS type_code,
           rt.title AS type_title
    ${baseQuery}
    ORDER BY r.created_at DESC
    LIMIT ${limitParam} OFFSET ${offsetParam}
    `,
    listParams
  );

  const totalQ = await db.query(
    `
    SELECT COUNT(*) AS total
    ${baseQuery}
    `,
    baseParams
  );

  const mapped = q.rows.map((row) => ({
    ...row,
    type_title: getRequestLabel(row.type_code, row.type_title),
  }));

  return { rows: mapped, total: parseInt(totalQ.rows[0].total, 10) };
}

/**
 * ✅ Aprobar solicitud
 * Actualiza estado, registra auditoría y envía notificación.
 */
async function approve(request_id, approver_id) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    // Datos de la solicitud y solicitante
    const {
      rows: [requestInfo],
    } = await client.query(
      `SELECT r.id,
              r.requester_id,
              u.email   AS requester_email,
              u.fullname AS requester_name,
              rt.title  AS request_title,
              rt.code   AS request_code
         FROM requests r
         LEFT JOIN users u ON u.id = r.requester_id
         LEFT JOIN request_types rt ON rt.id = r.request_type_id
        WHERE r.id = $1
        LIMIT 1`,
      [request_id]
    );

    // Obtener datos del aprobador para usarlos como remitente delegado
    let approverEmail = null;
    let approverName = null;
    try {
      const { rows } = await client.query(
        "SELECT email, fullname, name FROM users WHERE id = $1 LIMIT 1",
        [approver_id]
      );
      approverEmail = rows[0]?.email || null;
      approverName = rows[0]?.fullname || rows[0]?.name || approverEmail;
    } catch (approverLookupErr) {
      logger.warn({ approverLookupErr }, "No se pudo obtener datos del aprobador");
    }

    // Cambiar estado base a aprobado (independientemente de acta)
    await requestsService.updateRequestStatus(request_id, "aprobado", client);

    // Registrar aprobación
    await client.query(
      `INSERT INTO request_approvals (request_id, approver_id, action, acted_at)
       VALUES ($1,$2,'approve',now())`,
      [request_id, approver_id]
    );

    try {
      await audit.logAction({
        user_id: approver_id,
        module: "approvals",
        action: "approve",
        entity: "requests",
        entity_id: request_id,
      });
    } catch (auditErr) {
      logger.warn({ auditErr }, "No se pudo registrar auditoría en approve");
    }

    await client.query("COMMIT");

    // Notificación (no bloqueante)
    if (MAIL_ENABLED) {
      setImmediate(() => {
        const recipients = [
          requestInfo?.requester_email,
          approverEmail,
        ].filter(Boolean);
        const detailLink = `${FRONTEND_URL}/dashboard/servicio-tecnico?request=${request_id}`;
        const requestTitle = getRequestLabel(
          requestInfo?.request_code,
          requestInfo?.request_title
        );
        const requesterName =
          requestInfo?.requester_name || requestInfo?.requester_email || "Solicitante";
        const scheduleHint =
          requestInfo?.request_code === "F.ST-20"
            ? "<p><strong>Siguiente paso:</strong> agenda la visita de inspección y asigna técnico para coordinar con el cliente.</p>"
            : "";

        sendMail({
          to: recipients.length ? recipients : process.env.SMTP_FROM,
          subject: `Solicitud #${request_id} aprobada`,
          html: `
            <h2>Solicitud aprobada</h2>
            <p><b>${requestTitle}</b> (#${request_id}) fue aprobada por <b>${approverName || approverEmail || "Aprobador"}</b>.</p>
            <p>Solicitante: <b>${requesterName}</b></p>
            ${scheduleHint}
            <p>Revisa el detalle en SPI: <a href="${detailLink}" target="_blank" rel="noopener">${detailLink}</a></p>
          `,
          from: approverEmail ? { email: approverEmail, name: approverName } : undefined,
          replyTo: approverEmail || undefined,
          senderName: approverName || undefined,
          delegatedUser: approverEmail || undefined,
          gmailUserId: approver_id,
        }).catch((mailErr) => {
          logger.warn({ mailErr }, "No se pudo enviar notificación de aprobación");
        });
      });
    } else {
      logger.info("📧 DISABLE_MAIL=true → se omite envío de notificación de aprobación");
    }

    return { status: "approved", request_id };
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error(
      { err, request_id, approver_id },
      "❌ Error aprobando solicitud"
    );
    throw Object.assign(new Error("No se pudo aprobar la solicitud"), {
      status: 500,
      cause: err,
    });
  } finally {
    client.release();
  }
}

/**
 * ❌ Rechazar solicitud
 * Similar a approve pero con status 'rejected'.
 */
async function reject(request_id, approver_id, note = null) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const {
      rows: [requestInfo],
    } = await client.query(
      `SELECT r.id,
              r.requester_id,
              u.email   AS requester_email,
              u.fullname AS requester_name,
              rt.title  AS request_title,
              rt.code   AS request_code
         FROM requests r
         LEFT JOIN users u ON u.id = r.requester_id
         LEFT JOIN request_types rt ON rt.id = r.request_type_id
        WHERE r.id = $1
        LIMIT 1`,
      [request_id]
    );

    let approverEmail = null;
    let approverName = null;
    try {
      const { rows } = await client.query(
        "SELECT email, fullname, name FROM users WHERE id = $1 LIMIT 1",
        [approver_id]
      );
      approverEmail = rows[0]?.email || null;
      approverName = rows[0]?.fullname || rows[0]?.name || approverEmail;
    } catch (approverLookupErr) {
      logger.warn({ approverLookupErr }, "No se pudo obtener datos del aprobador");
    }

    await requestsService.updateRequestStatus(request_id, "rechazado", client);

    await client.query(
      `INSERT INTO request_approvals (request_id, approver_id, action, comments, acted_at)
       VALUES ($1,$2,'reject',$3,now())`,
      [request_id, approver_id, note]
    );

    try {
      await audit.logAction({
        user_id: approver_id,
        module: "approvals",
        action: "reject",
        entity: "requests",
        entity_id: request_id,
        details: { note },
      });
    } catch (auditErr) {
      logger.warn({ auditErr }, "No se pudo registrar auditoría en reject");
    }

    await client.query("COMMIT");

    if (MAIL_ENABLED) {
      setImmediate(() => {
        const recipients = [
          requestInfo?.requester_email,
          approverEmail,
        ].filter(Boolean);
        const detailLink = `${FRONTEND_URL}/dashboard/servicio-tecnico?request=${request_id}`;
        const requestTitle = getRequestLabel(
          requestInfo?.request_code,
          requestInfo?.request_title
        );
        const requesterName =
          requestInfo?.requester_name || requestInfo?.requester_email || "Solicitante";

        sendMail({
          to: recipients.length ? recipients : process.env.SMTP_FROM,
          subject: `Solicitud #${request_id} rechazada`,
          html: `
            <h2>Solicitud rechazada</h2>
            <p><b>${requestTitle}</b> (#${request_id}) fue rechazada por <b>${approverName || approverEmail || "Aprobador"}</b>.</p>
            <p>Solicitante: <b>${requesterName}</b></p>
            <p>Motivo: ${note || "sin especificar"}</p>
            <p>Revisa el detalle en SPI: <a href="${detailLink}" target="_blank" rel="noopener">${detailLink}</a></p>
          `,
          from: approverEmail ? { email: approverEmail, name: approverName } : undefined,
          replyTo: approverEmail || undefined,
          senderName: approverName || undefined,
          delegatedUser: approverEmail || undefined,
          gmailUserId: approver_id,
        }).catch((mailErr) => {
          logger.warn({ mailErr }, "No se pudo enviar notificación de rechazo");
        });
      });
    } else {
      logger.info("📧 DISABLE_MAIL=true → se omite envío de notificación de rechazo");
    }

    return { status: "rejected", request_id };
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error(
      { err, request_id, approver_id },
      "❌ Error rechazando solicitud"
    );
    throw Object.assign(new Error("No se pudo rechazar la solicitud"), {
      status: 500,
      cause: err,
    });
  } finally {
    client.release();
  }
}

module.exports = { listPending, approve, reject };
