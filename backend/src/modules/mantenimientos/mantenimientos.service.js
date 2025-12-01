const db = require("../../config/db");
const logger = require("../../config/logger");
const {
  createFolder,
  copyTemplate,
  replaceTags,
  exportPdf: driveExportPdf,
} = require("../../utils/drive");
const { logAction } = require("../../utils/audit");
const { sendMail } = require("../../utils/mailer");
const documents = require("../documents/document.service");
const files = require("../files/file.service");

const REMINDER_STATUS = {
  PENDING: "Pendiente",
  CONFLICT: "Conflicto",
  SENT: "Notificado",
};

const normalizeTipo = (tipo = "preventivo") => {
  const clean = String(tipo || "").trim().toLowerCase();
  if (clean.startsWith("corr")) return "Correctivo";
  return "Preventivo";
};

const toUTCDate = (value) => {
  if (!value) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-").map((n) => parseInt(n, 10));
    return new Date(Date.UTC(y, m - 1, d));
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

const dateToISO = (date) => date.toISOString().split("T")[0];

const addMonthsUtc = (date, months = 6) => {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

const formatHumanDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    return new Intl.DateTimeFormat("es-EC", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(`${dateStr}T00:00:00Z`));
  } catch (_err) {
    return dateStr;
  }
};

async function findConflict(client, id_equipo, fecha) {
  const { rows } = await client.query(
    `
      SELECT id, responsable, fecha_programada
      FROM servicio.cronograma_mantenimientos
      WHERE id_equipo = $1
        AND fecha_programada = $2
        AND LOWER(estado) IN ('pendiente','en proceso')
      LIMIT 1
    `,
    [id_equipo, fecha]
  );
  return rows?.[0] || null;
}

async function notifyConflictEmail({
  email,
  equipoLabel,
  fecha,
  tipo,
  conflictId,
  nextDate = false,
}) {
  const recipients = [email, process.env.SMTP_FROM].filter(Boolean);
  if (!recipients.length) return;

  const humanDate = formatHumanDate(fecha);
  const subjectPrefix = nextDate
    ? "Conflicto en recordatorio de mantenimiento"
    : "Conflicto al programar mantenimiento";
  const detail = nextDate
    ? `El recordatorio automático previsto para el ${humanDate} no se pudo agendar`
    : `No se puede registrar el mantenimiento solicitado para el ${humanDate}`;

  await sendMail({
    to: recipients,
    subject: `${subjectPrefix} (${equipoLabel})`,
    html: `
      <p>${detail} porque ya existe un mantenimiento activo ${
        conflictId ? `(#${conflictId})` : ""
      } en la misma fecha.</p>
      <p>Equipo: <strong>${equipoLabel}</strong><br/>
      Tipo: <strong>${tipo}</strong></p>
      <p>Por favor selecciona otra fecha en el módulo de mantenimientos.</p>
    `,
  });
}

/**
 * Crear mantenimiento
 * -------------------
 * Genera el registro en BD, crea documento en Drive con las firmas y evidencias.
 */
async function createMantenimiento({
  data,
  responsable_id,
  responsable_email,
  responsable_nombre,
  firma_responsable,
  firma_receptor,
  evidencias,
}) {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const id_equipo = Number.parseInt(data.id_equipo, 10);
    if (Number.isNaN(id_equipo)) {
      const err = new Error("Debes seleccionar un equipo válido para el mantenimiento.");
      err.status = 400;
      throw err;
    }

    const tipo = normalizeTipo(data.tipo);
    const equipoLabel = data.equipo || data.equipo_nombre || `Equipo ${id_equipo}`;
    const equipo = data.equipo || data.equipo_nombre || equipoLabel;
    const fechaDate = toUTCDate(data.fecha_programada);
    const fecha = dateToISO(fechaDate);

    const existing = await findConflict(client, id_equipo, fecha);
    if (existing) {
      await client.query("ROLLBACK");
      await notifyConflictEmail({
        email: responsable_email,
        equipoLabel,
        fecha,
        tipo,
        conflictId: existing.id,
      });
      const err = new Error(
        `La fecha ${formatHumanDate(fecha)} ya tiene un mantenimiento programado para este equipo.`
      );
      err.status = 409;
      err.code = "MAINTENANCE_DATE_CONFLICT";
      throw err;
    }

    const freq = `${data.frecuencia || ""}`.toLowerCase();
    const monthsToAdd = ["12m", "1y", "12", "1ano"].includes(freq) ? 12 : 6;
    const nextDateIso = dateToISO(addMonthsUtc(fechaDate, monthsToAdd));
    let nextStatus = REMINDER_STATUS.PENDING;
    let nextConflictMessage = null;
    if (nextDateIso) {
      const futureConflict = await findConflict(client, id_equipo, nextDateIso);
      if (futureConflict) {
        nextStatus = REMINDER_STATUS.CONFLICT;
        nextConflictMessage = `Existe un mantenimiento activo el ${formatHumanDate(
          nextDateIso
        )} (#${futureConflict.id}).`;
        await notifyConflictEmail({
          email: responsable_email,
          equipoLabel,
          fecha: nextDateIso,
          tipo,
          conflictId: futureConflict.id,
          nextDate: true,
        });
      }
    }

    // 1️⃣ Insertar registro en BD
    const {
      rows: [row],
    } = await client.query(
      `INSERT INTO servicio.cronograma_mantenimientos
       (id_equipo, tipo, responsable, fecha_programada, observaciones, estado, created_by, next_maintenance_date, next_maintenance_status, next_maintenance_conflict, firma_responsable, firma_receptor)
       VALUES ($1,$2,$3,$4,$5,'Pendiente',$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        id_equipo,
        tipo,
        data.responsable || responsable_nombre || "Sin asignar",
        fecha,
        data.observaciones,
        responsable_id,
        nextDateIso,
        nextStatus,
        nextConflictMessage,
        firma_responsable,
        firma_receptor,
      ]
    );

    // 2️⃣ Crear carpeta específica en Drive
    const baseFolder = process.env.DRIVE_MANTENIMIENTOS_FOLDER_ID || process.env.DRIVE_FOLDER_ID;
    const folder = await createFolder(`MANT-${row.id}`, baseFolder);

    // 3️⃣ Copiar plantilla y reemplazar tags
    const templateId = process.env.DRIVE_TEMPLATE_MANTENIMIENTO_ID;
    if (!templateId) {
      const err = new Error(
        "No se ha configurado la plantilla de mantenimiento (DRIVE_TEMPLATE_MANTENIMIENTO_ID)."
      );
      err.status = 500;
      throw err;
    }
    const doc = await copyTemplate(templateId, `Ficha-MANT-${row.id}`, folder.id);

    await replaceTags(doc.id, {
      ID_MANTENIMIENTO: row.id,
      RESPONSABLE: data.responsable || "",
      EQUIPO: equipo,
      FECHA_PROGRAMADA: fecha,
      OBSERVACIONES: data.observaciones || "",
    });

    // 4️⃣ Insertar firmas si existen
    const images = {};
    if (firma_responsable) images["FIRMA_RESPONSABLE"] = firma_responsable;
    if (firma_receptor) images["FIRMA_RECEPTOR"] = firma_receptor;

    for (const [tag, b64] of Object.entries(images)) {
      await documents.signAtTag({
        documentId: doc.id,
        userId: responsable_id,
        base64: b64,
        tag,
        role_at_sign: tag === "FIRMA_RESPONSABLE" ? "Responsable" : "Receptor",
      });
    }

    // 5️⃣ Subir evidencias (si hay)
    if (evidencias.length > 0) {
      await files.uploadFiles({
        requestId: row.id, // en este caso, el ID mantenimiento
        userId: responsable_id,
        files: evidencias,
      });
    }

    // 6️⃣ Registrar en tabla documents
    await client.query(
      `INSERT INTO documents (request_id, doc_drive_id, folder_drive_id, signed)
       VALUES ($1,$2,$3,true)`,
      [row.id, doc.id, folder.id]
    );

    // 7️⃣ Auditoría y notificación
    await logAction({
      user_id: responsable_id,
      module: "mantenimientos",
      action: "create",
      entity: "servicio.cronograma_mantenimientos",
      entity_id: row.id,
    });

    await client.query("COMMIT");

    await sendMail({
      to: [process.env.SMTP_FROM, responsable_email].filter(Boolean),
      subject: `Nuevo mantenimiento registrado #${row.id}`,
      html: `
        <p>Se ha creado la ficha de mantenimiento <b>${row.id}</b> del equipo <b>${equipoLabel}</b>.</p>
        <p>Fecha programada: <strong>${formatHumanDate(fecha)}</strong></p>
        <p>Próximo recordatorio automático: <strong>${formatHumanDate(nextDateIso)}</strong></p>
        ${
          nextConflictMessage
            ? `<p style="color:#c53030;font-weight:bold;">${nextConflictMessage}</p>`
            : ""
        }
      `,
    });

    return {
      ...row,
      drive_link: `https://drive.google.com/open?id=${doc.id}`,
      nextMaintenance: {
        date: nextDateIso,
        status: nextStatus,
        conflictMessage: nextConflictMessage,
      },
    };
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "❌ Error creando mantenimiento");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Listar mantenimientos
 */
async function listMantenimientos(userId, role) {
  const query =
    role === "gerencia"
      ? `SELECT * FROM servicio.cronograma_mantenimientos ORDER BY created_at DESC`
      : `SELECT * FROM servicio.cronograma_mantenimientos WHERE created_by=$1 ORDER BY created_at DESC`;

  const { rows } = await db.query(query, role === "gerencia" ? [] : [userId]);
  return rows;
}

/**
 * Detalle completo
 */
async function getDetail(id) {
  const { rows } = await db.query(
    `SELECT m.*, d.doc_drive_id, d.pdf_drive_id
     FROM servicio.cronograma_mantenimientos m
     LEFT JOIN documents d ON d.request_id=m.id
     WHERE m.id=$1`,
    [id]
  );
  return rows[0];
}

/**
 * Firmar posteriormente
 */
async function sign({ id, user_id, base64, tag }) {
  const { rows } = await db.query(
    `SELECT d.doc_drive_id FROM documents d WHERE d.request_id=$1`,
    [id]
  );
  const doc = rows[0];
  if (!doc) throw new Error("Documento no encontrado para mantenimiento");
  const result = await documents.signAtTag({
    documentId: doc.doc_drive_id,
    userId: user_id,
    base64,
    tag,
  });
  await logAction({
    user_id,
    module: "mantenimientos",
    action: "sign",
    entity: "servicio.cronograma_mantenimientos",
    entity_id: id,
    details: { tag },
  });
  return result;
}

/**
 * Aprobar mantenimiento (gerencia)
 */
async function approve({ id, approver_id }) {
  await db.query(
    `UPDATE servicio.cronograma_mantenimientos SET estado='aprobado', updated_at=now() WHERE id=$1`,
    [id]
  );
  await logAction({
    user_id: approver_id,
    module: "mantenimientos",
    action: "approve",
    entity: "servicio.cronograma_mantenimientos",
    entity_id: id,
  });
  await sendMail({
    to: process.env.SMTP_FROM,
    subject: `Mantenimiento #${id} aprobado`,
    html: `<p>El mantenimiento <b>${id}</b> ha sido aprobado por gerencia.</p>`,
  });
  return { id, estado: "aprobado" };
}

/**
 * Exportar documento a PDF
 */
async function exportPdf(id) {
  const { rows } = await db.query(
    `SELECT d.doc_drive_id, d.folder_drive_id FROM documents d WHERE d.request_id=$1`,
    [id]
  );
  if (!rows[0]) throw new Error("Documento no encontrado");
  const pdf = await driveExportPdf(rows[0].doc_drive_id, rows[0].folder_drive_id);
  await db.query(
    `UPDATE documents SET pdf_drive_id=$1 WHERE request_id=$2`,
    [pdf.id, id]
  );
  return pdf;
}


module.exports = {
  createMantenimiento,
  listMantenimientos,
  getDetail,
  sign,
  approve,
  exportPdf,
};
