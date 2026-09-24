/**
 * Job: Recordatorio diario de actas pendientes de firma
 * -------------------------------------------------------
 * Corre una vez al día. Envía correo al colaborador y al responsable
 * del área cuando un acta generada lleva más de 48 h sin subirse firmada.
 * Continúa enviando cada 24 h hasta que `is_complete = true`.
 *
 * Activación: POST /internal-jobs/collab-deliveries/actas/pending-signature-reminder
 */

const db      = require("../config/db");
const logger  = require("../config/logger");
const { sendMail } = require("../utils/mailer");

const HOURS_GRACE     = 48;  // horas libres antes del primer aviso
const HOURS_BETWEEN   = 23;  // mínimo entre avisos sucesivos (< 24 para cubrir drift)

// Roles responsables por categoría — deben existir en users.role
const CATEGORY_RESPONSIBLE_ROLES = {
  ropa:        ["talento_humano"],
  epp:         ["talento_humano"],
  herramienta: ["talento_humano", "jefe_tecnico"],
  logistica:   ["financiero", "jefe_financiero"],
  ti:          ["ti", "jefe_ti", "admin_ti"],
  suministros: ["financiero", "jefe_financiero", "talento_humano"],
};

const CATEGORY_LABELS = {
  ropa: "Ropa de trabajo", epp: "EPP", herramienta: "Herramientas de trabajo",
  logistica: "Logística", ti: "Herramientas de comunicación", suministros: "Suministros de oficina",
};

async function _ensureSchema() {
  await db.query(`
    ALTER TABLE public.collab_delivery_actas
      ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ
  `);
}

async function _getResponsibleEmails(category) {
  const roles = CATEGORY_RESPONSIBLE_ROLES[category] || [];
  if (!roles.length) return [];
  const { rows } = await db.query(
    `SELECT email FROM public.users
     WHERE role = ANY($1::text[]) AND active = true AND email IS NOT NULL AND email <> ''`,
    [roles],
  );
  return rows.map((r) => r.email).filter(Boolean);
}

function _buildHtml({ acta, hoursOld }) {
  const catLabel = CATEGORY_LABELS[acta.category] || acta.category;
  const tipoLabel = acta.tipo === "entrega" ? "Entrega" : "Retiro";
  const diasPendiente = Math.floor(hoursOld / 24);

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <div style="background:#1e3a5f;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:18px">Acta pendiente de firma — FamSPI</h1>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px 32px;border-radius:0 0 8px 8px">
        <p style="margin:0 0 16px">Hola,</p>
        <p>El acta <strong>${acta.acta_code}</strong> de <strong>${tipoLabel.toLowerCase()} de ${catLabel}</strong>
          fue generada hace <strong>${diasPendiente} día${diasPendiente !== 1 ? "s" : ""}</strong> y
          <span style="color:#b45309;font-weight:600">aún no ha sido subida firmada</span>.</p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
          <tr style="background:#f1f5f9">
            <td style="padding:8px 12px;font-weight:600;width:40%">Código de acta</td>
            <td style="padding:8px 12px">${acta.acta_code}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:600;background:#f8fafc">Tipo</td>
            <td style="padding:8px 12px">${tipoLabel}</td>
          </tr>
          <tr style="background:#f1f5f9">
            <td style="padding:8px 12px;font-weight:600">Categoría</td>
            <td style="padding:8px 12px">${catLabel}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:600;background:#f8fafc">Colaborador</td>
            <td style="padding:8px 12px">${acta.recipient_nombre || "N/D"}</td>
          </tr>
          <tr style="background:#f1f5f9">
            <td style="padding:8px 12px;font-weight:600">Fecha de generación</td>
            <td style="padding:8px 12px">${new Date(acta.created_at).toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
          </tr>
        </table>

        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:14px 18px;margin-bottom:20px">
          <p style="margin:0;font-size:14px;color:#92400e">
            <strong>Acción requerida:</strong> imprime el acta, fírmala, escanéala y sube el archivo en el sistema SPI
            (módulo <em>Entregas a Colaboradores → Gestión</em>). El documento se sellará con SHA-256 al momento de la carga.
          </p>
        </div>

        <p style="font-size:12px;color:#64748b;margin:0">
          Este recordatorio se enviará diariamente hasta que el acta firmada sea cargada en el sistema.
        </p>
      </div>
    </div>
  `;
}

async function runOnce() {
  logger.info("[JOBS][COLLAB_ACTA_REMINDER] Iniciando recordatorios de actas pendientes de firma");

  await _ensureSchema();

  const { rows: pendingActas } = await db.query(`
    SELECT
      a.id, a.acta_code, a.tipo, a.category, a.created_at,
      a.recipient_user_id, a.recipient_nombre, a.recipient_cedula,
      a.last_reminder_sent_at,
      EXTRACT(EPOCH FROM (now() - a.created_at)) / 3600 AS hours_old,
      u.email AS recipient_email
    FROM public.collab_delivery_actas a
    LEFT JOIN public.users u ON u.id = a.recipient_user_id
    WHERE a.is_complete = false
      AND a.active    = true
      AND a.created_at < now() - make_interval(hours => $1)
      AND (
        a.last_reminder_sent_at IS NULL
        OR a.last_reminder_sent_at < now() - make_interval(hours => $2)
      )
    ORDER BY a.created_at ASC
  `, [HOURS_GRACE, HOURS_BETWEEN]);

  let sent = 0, skipped = 0, failed = 0;

  for (const acta of pendingActas) {
    const hoursOld = Math.floor(Number(acta.hours_old));
    const responsibleEmails = await _getResponsibleEmails(acta.category);
    const recipientEmail    = acta.recipient_email?.trim().toLowerCase() || null;

    const allTo = [...new Set([
      ...(recipientEmail ? [recipientEmail] : []),
      ...responsibleEmails,
    ])].filter(Boolean);

    if (!allTo.length) {
      skipped++;
      logger.warn({ actaId: acta.id, acta_code: acta.acta_code }, "[JOBS][COLLAB_ACTA_REMINDER] Sin destinatarios — omitido");
      continue;
    }

    const subject = `Recordatorio: acta ${acta.acta_code} pendiente de firma (${hoursOld}h)`;
    const html    = _buildHtml({ acta, hoursOld });

    try {
      await sendMail({ to: allTo, subject, html, source: "collab_acta_pending_signature" });

      await db.query(
        `UPDATE public.collab_delivery_actas
            SET last_reminder_sent_at = now()
          WHERE id = $1`,
        [acta.id],
      );

      sent++;
      logger.info({ actaId: acta.id, acta_code: acta.acta_code, to: allTo }, "[JOBS][COLLAB_ACTA_REMINDER] Recordatorio enviado");
    } catch (e) {
      failed++;
      logger.error({ error: e?.message, actaId: acta.id }, "[JOBS][COLLAB_ACTA_REMINDER] Error enviando correo");
    }
  }

  const result = { scanned: pendingActas.length, sent, skipped, failed };
  logger.info(result, "[JOBS][COLLAB_ACTA_REMINDER] Finalizado");
  return result;
}

module.exports = { runOnce };
