/**
 * Job: Recordatorio diario de documentos pendientes de firma en workflows
 * -------------------------------------------------------------------------
 * Corre una vez al día a las 09:00. Envía correo al firmante cuando lleva
 * más de 24 h con un paso disponible/abierto sin firmar.
 * Evita re-enviar si ya se envió un recordatorio en las últimas 23 h.
 *
 * Activación: POST /internal-jobs/signature-workflows/reminder
 */

const cron = require("node-cron");
const db = require("../config/db");
const logger = require("../config/logger");
const { sendMail } = require("../utils/mailer");

const HOURS_GRACE   = 24; // horas libres antes del primer aviso
const HOURS_BETWEEN = 23; // mínimo entre avisos sucesivos (< 24 para cubrir drift)

async function _ensureSchema() {
  await db.query(`
    ALTER TABLE public.signature_workflow_signers
      ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ
  `);
}

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || process.env.APP_BASE_URL || "";

function _buildHtml({ signer, workflow, hoursPending }) {
  const stepLabel = signer.sequence_order != null ? `Paso ${signer.sequence_order}` : "—";
  const daysPending = Math.floor(hoursPending / 24);
  const pendingLabel = daysPending >= 1
    ? `${daysPending} día${daysPending !== 1 ? "s" : ""}`
    : `${hoursPending} hora${hoursPending !== 1 ? "s" : ""}`;
  const signLink = signer.access_token
    ? `${FRONTEND_BASE_URL}/firmar/${signer.access_token}`
    : null;

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <div style="background:#1e3a5f;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:18px">Documento pendiente de firma — FamSPI</h1>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:28px 32px;border-radius:0 0 8px 8px">
        <p style="margin:0 0 16px">Hola,</p>
        <p>Tienes un documento pendiente de firma desde hace
          <strong>${pendingLabel}</strong> en el flujo de firmas
          <strong>${workflow.workflow_code}</strong>.</p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
          <tr style="background:#f1f5f9">
            <td style="padding:8px 12px;font-weight:600;width:40%">Código de flujo</td>
            <td style="padding:8px 12px">${workflow.workflow_code}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:600;background:#f8fafc">Título del documento</td>
            <td style="padding:8px 12px">${workflow.title || "—"}</td>
          </tr>
          <tr style="background:#f1f5f9">
            <td style="padding:8px 12px;font-weight:600">Paso</td>
            <td style="padding:8px 12px">${stepLabel}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:600;background:#f8fafc">Tiempo pendiente</td>
            <td style="padding:8px 12px">${pendingLabel}</td>
          </tr>
          <tr style="background:#f1f5f9">
            <td style="padding:8px 12px;font-weight:600">Estado del paso</td>
            <td style="padding:8px 12px">${signer.status}</td>
          </tr>
        </table>

        ${signLink ? `
        <div style="text-align:center;margin:24px 0">
          <a href="${signLink}"
             style="background:#1e3a5f;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
            Ir a firmar ahora →
          </a>
        </div>` : `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:14px 18px;margin-bottom:20px">
          <p style="margin:0;font-size:14px;color:#92400e">
            <strong>Acción requerida:</strong> Ingresa a FamSPI y dirígete a
            <em>Flujos de Firma → Mis documentos pendientes</em>.
          </p>
        </div>`}

        <p style="font-size:12px;color:#64748b;margin:0">
          Este recordatorio se enviará diariamente hasta que el documento sea firmado o el flujo expire.
        </p>
      </div>
    </div>
  `;
}

async function runOnce() {
  logger.info("[JOBS][SIG_WORKFLOW_REMINDER] Iniciando recordatorios de documentos pendientes de firma");

  await _ensureSchema();

  const { rows: pendingSigners } = await db.query(`
    SELECT
      s.id,
      s.workflow_id,
      s.user_id,
      s.email_snapshot,
      s.access_token,
      s.status,
      s.sequence_order,
      s.available_at,
      s.last_reminder_sent_at,
      EXTRACT(EPOCH FROM (now() - s.available_at)) / 3600 AS hours_pending,
      w.title        AS workflow_title,
      w.workflow_code,
      w.verification_token,
      COALESCE(s.email_snapshot, u.email) AS signer_email
    FROM public.signature_workflow_signers s
    JOIN public.signature_workflows w ON w.id = s.workflow_id
    LEFT JOIN public.users u ON u.id = s.user_id
    WHERE s.status IN ('available', 'opened')
      AND w.active = true
      AND s.available_at < now() - make_interval(hours => $1)
      AND (
        s.last_reminder_sent_at IS NULL
        OR s.last_reminder_sent_at < now() - make_interval(hours => $2)
      )
    ORDER BY s.available_at ASC
  `, [HOURS_GRACE, HOURS_BETWEEN]);

  let sent = 0, skipped = 0, failed = 0;

  for (const signer of pendingSigners) {
    const hoursPending = Math.floor(Number(signer.hours_pending));
    const toEmail = signer.signer_email?.trim().toLowerCase() || null;

    if (!toEmail) {
      skipped++;
      logger.warn(
        { signerId: signer.id, workflowCode: signer.workflow_code },
        "[JOBS][SIG_WORKFLOW_REMINDER] Sin email de firmante — omitido",
      );
      continue;
    }

    const workflow = {
      title: signer.workflow_title,
      workflow_code: signer.workflow_code,
      verification_token: signer.verification_token,
    };

    const subject = `Recordatorio: tienes un documento pendiente de firma — ${signer.workflow_code}`;
    const html = _buildHtml({ signer, workflow, hoursPending });

    try {
      await sendMail({
        to: [toEmail],
        subject,
        html,
        source: "signature_workflow_pending_reminder",
      });

      await db.query(
        `UPDATE public.signature_workflow_signers
            SET last_reminder_sent_at = now()
          WHERE id = $1`,
        [signer.id],
      );

      sent++;
      logger.info(
        { signerId: signer.id, workflowCode: signer.workflow_code, to: toEmail },
        "[JOBS][SIG_WORKFLOW_REMINDER] Recordatorio enviado",
      );
    } catch (e) {
      failed++;
      logger.error(
        { error: e?.message, signerId: signer.id, workflowCode: signer.workflow_code },
        "[JOBS][SIG_WORKFLOW_REMINDER] Error enviando correo",
      );
    }
  }

  const result = { scanned: pendingSigners.length, sent, skipped, failed };
  logger.info(result, "[JOBS][SIG_WORKFLOW_REMINDER] Finalizado");
  return result;
}

let _cronTask = null;
function startSignatureWorkflowReminderJob() {
  if (_cronTask) return;
  logger.info("[JOBS][SIG_WORKFLOW_REMINDER] Scheduler configurado — corre diariamente a las 09:00");
  _cronTask = cron.schedule("0 9 * * *", () => {
    runOnce().catch((err) =>
      logger.error({ error: err?.message }, "[JOBS][SIG_WORKFLOW_REMINDER] Error en ejecución programada"),
    );
  });
}

module.exports = { runOnce, startSignatureWorkflowReminderJob };
