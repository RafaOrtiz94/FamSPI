/**
 * Job: Recordatorio 3x/día de actas de capacitación pendientes de firma
 * -----------------------------------------------------------------------
 * Corre a las 08:00, 13:00 y 18:00. Solo aplica a workflows cuyo
 * source_module = 'trainings'. Umbral entre avisos: 7 h (≈ 3 por día
 * sin solapamiento). Grace period: 1 h desde que el paso quedó disponible.
 *
 * Cubre tanto el acta principal (asistentes) como el acta de inasistentes.
 *
 * Activación manual: POST /internal-jobs/trainings/signature-reminder
 */

const cron   = require("node-cron");
const db     = require("../config/db");
const logger = require("../config/logger");
const { sendMail } = require("../utils/mailer");

const HOURS_GRACE   = 1;   // horas libres antes del primer aviso
const HOURS_BETWEEN = 7;   // mínimo entre avisos (< 8 h para cubrir drift de 3x/día)

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || process.env.APP_BASE_URL || "";

// ---------------------------------------------------------------------------
// Template de email
// ---------------------------------------------------------------------------

function buildHtml({ signer, workflow, training, hoursPending }) {
  const tipoLabel = workflow.source_entity === "acta_inasistentes"
    ? "Acta de Inasistencia"
    : "Acta de Capacitación";

  const pendingLabel = hoursPending < 24
    ? `${hoursPending} hora${hoursPending !== 1 ? "s" : ""}`
    : `${Math.floor(hoursPending / 24)} día${Math.floor(hoursPending / 24) !== 1 ? "s" : ""}`;

  const signLink = signer.access_token
    ? `${FRONTEND_BASE_URL}/firmar/${signer.access_token}`
    : `${FRONTEND_BASE_URL}/dashboard/capacitaciones`;

  const fechaStr = training?.scheduled_date
    ? new Date(training.scheduled_date).toLocaleDateString("es-EC", {
        day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
      })
    : "";

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <div style="background:#1e293b;padding:22px 30px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:17px">
          ${tipoLabel} pendiente de firma — FamSPI
        </h1>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;
                  padding:26px 30px;border-radius:0 0 8px 8px">
        <p style="margin:0 0 14px">
          Hola <strong>${signer.name_snapshot || signer.signer_email || ""}</strong>,
        </p>
        <p style="margin:0 0 18px">
          Tienes pendiente firmar el <strong>${tipoLabel}</strong> de la siguiente capacitación
          desde hace <strong>${pendingLabel}</strong>:
        </p>

        <table style="width:100%;border-collapse:collapse;margin:0 0 22px;font-size:14px">
          <tr style="background:#f1f5f9">
            <td style="padding:9px 13px;font-weight:600;width:42%">Código</td>
            <td style="padding:9px 13px">${training?.code || workflow.workflow_code}</td>
          </tr>
          <tr>
            <td style="padding:9px 13px;font-weight:600;background:#f8fafc">Capacitación</td>
            <td style="padding:9px 13px">${training?.title || workflow.title || "—"}</td>
          </tr>
          ${fechaStr ? `
          <tr style="background:#f1f5f9">
            <td style="padding:9px 13px;font-weight:600">Fecha</td>
            <td style="padding:9px 13px">${fechaStr}</td>
          </tr>` : ""}
          <tr${fechaStr ? "" : ' style="background:#f1f5f9"'}>
            <td style="padding:9px 13px;font-weight:600${fechaStr ? ";background:#f8fafc" : ""}">Área</td>
            <td style="padding:9px 13px">${training?.area || "—"}</td>
          </tr>
          <tr style="background:#f1f5f9">
            <td style="padding:9px 13px;font-weight:600">Flujo FamSign</td>
            <td style="padding:9px 13px">${workflow.workflow_code}</td>
          </tr>
        </table>

        <div style="text-align:center;margin:22px 0">
          <a href="${signLink}"
             style="display:inline-block;background:#2563eb;color:#fff;padding:13px 30px;
                    border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
            Firmar ahora →
          </a>
        </div>

        <p style="font-size:12px;color:#64748b;margin:0;text-align:center">
          Este recordatorio se envía 3 veces al día hasta que completes la firma.
        </p>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Lógica principal
// ---------------------------------------------------------------------------

async function runOnce() {
  logger.info("[JOBS][TRAINING_SIG_REMINDER] Iniciando recordatorios de actas de capacitación");

  const { rows: pendingSigners } = await db.query(
    `SELECT
       s.id,
       s.workflow_id,
       s.user_id,
       s.email_snapshot,
       s.name_snapshot,
       s.access_token,
       s.status,
       s.sequence_order,
       s.available_at,
       s.last_reminder_sent_at,
       EXTRACT(EPOCH FROM (now() - s.available_at)) / 3600 AS hours_pending,
       w.workflow_code,
       w.title          AS workflow_title,
       w.source_entity,
       w.source_entity_id,
       COALESCE(s.email_snapshot, u.email) AS signer_email,
       t.code           AS training_code,
       t.title          AS training_title,
       t.scheduled_date AS training_date,
       t.area           AS training_area
     FROM signature_workflow_signers s
     JOIN signature_workflows w ON w.id = s.workflow_id
     LEFT JOIN users u ON u.id = s.user_id
     LEFT JOIN trainings t ON t.id = w.source_entity_id
     WHERE s.status IN ('available', 'opened')
       AND w.active = true
       AND w.source_module = 'trainings'
       AND s.available_at < now() - make_interval(hours => $1)
       AND (
         s.last_reminder_sent_at IS NULL
         OR s.last_reminder_sent_at < now() - make_interval(hours => $2)
       )
     ORDER BY s.available_at ASC`,
    [HOURS_GRACE, HOURS_BETWEEN]
  );

  let sent = 0, skipped = 0, failed = 0;

  for (const signer of pendingSigners) {
    const toEmail = signer.signer_email?.trim().toLowerCase() || null;
    if (!toEmail) {
      skipped++;
      logger.warn(
        { signerId: signer.id, workflowCode: signer.workflow_code },
        "[JOBS][TRAINING_SIG_REMINDER] Sin email — omitido"
      );
      continue;
    }

    const hoursPending = Math.floor(Number(signer.hours_pending));

    const workflow = {
      workflow_code: signer.workflow_code,
      title:         signer.workflow_title,
      source_entity: signer.source_entity,
    };

    const training = {
      code:           signer.training_code,
      title:          signer.training_title,
      scheduled_date: signer.training_date,
      area:           signer.training_area,
    };

    const tipoLabel = signer.source_entity === "acta_inasistentes"
      ? "Acta de Inasistencia"
      : "Acta de Capacitación";

    try {
      await sendMail({
        to: [toEmail],
        subject: `[Capacitación] Firma pendiente — ${tipoLabel} ${signer.training_code || signer.workflow_code}`,
        html: buildHtml({ signer, workflow, training, hoursPending }),
        source: "training_signature_pending_reminder",
      });

      await db.query(
        "UPDATE signature_workflow_signers SET last_reminder_sent_at = now() WHERE id = $1",
        [signer.id]
      );

      sent++;
      logger.info(
        { signerId: signer.id, workflowCode: signer.workflow_code, to: toEmail },
        "[JOBS][TRAINING_SIG_REMINDER] Recordatorio enviado"
      );
    } catch (err) {
      failed++;
      logger.error(
        { err: err?.message, signerId: signer.id },
        "[JOBS][TRAINING_SIG_REMINDER] Error enviando correo"
      );
    }
  }

  const result = { scanned: pendingSigners.length, sent, skipped, failed };
  logger.info(result, "[JOBS][TRAINING_SIG_REMINDER] Finalizado");
  return result;
}

// ---------------------------------------------------------------------------
// Scheduler cron — 08:00, 13:00, 18:00 cada día
// ---------------------------------------------------------------------------

let _cronTask = null;

function startTrainingSignatureReminderJob() {
  if (_cronTask) return;
  logger.info(
    "[JOBS][TRAINING_SIG_REMINDER] Scheduler configurado — corre a las 08:00, 13:00 y 18:00"
  );
  _cronTask = cron.schedule("0 8,13,18 * * *", () => {
    runOnce().catch((err) =>
      logger.error(
        { error: err?.message },
        "[JOBS][TRAINING_SIG_REMINDER] Error en ejecución programada"
      )
    );
  });
}

module.exports = { runOnce, startTrainingSignatureReminderJob };
