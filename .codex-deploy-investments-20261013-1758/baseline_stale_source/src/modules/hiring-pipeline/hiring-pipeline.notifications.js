/**
 * Hiring Pipeline Notifications
 * Correos de notificación para cada evento del proceso de selección
 */

const { sendMail } = require('../../utils/mailer');
const logger = require('../../config/logger');

const EMPRESA = process.env.EMPRESA_NOMBRE || 'FAMPROJECT CIA. LTDA.';
const BASE_URL = process.env.FRONTEND_URL || 'https://spi.fam-project.com';

function currency(amount, cur = 'USD') {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: cur }).format(amount);
}

function formatDate(iso) {
  if (!iso) return 'Por confirmar';
  try {
    return new Date(iso).toLocaleString('es-EC', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'America/Guayaquil',
    });
  } catch {
    return iso;
  }
}

// ── Reunión agendada (postulante) ─────────────────────────────────────────────

async function notifyMeetingScheduled({ applicantEmail, applicantName, stageName, meetingDatetime, modality, meetingLink, notes }) {
  if (!applicantEmail) return;

  const modalityText = modality === 'virtual' ? 'virtual (videollamada)' : 'presencial';
  const linkSection = modality === 'virtual' && meetingLink
    ? `<p style="margin:12px 0;"><strong>Enlace de la reunión:</strong><br>
       <a href="${meetingLink}" style="color:#2563EB;">${meetingLink}</a></p>`
    : '';

  const html = `
    <div style="font-family:'Geist',system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1F2937;">
      <div style="background:#1E293B;padding:24px 32px;border-radius:16px 16px 0 0;">
        <p style="color:#94A3B8;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">${EMPRESA}</p>
        <h1 style="color:#F8FAFC;font-size:20px;font-weight:600;margin:0;">Tienes una reunión agendada</h1>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 16px 16px;">
        <p style="margin:0 0 20px;">Hola <strong>${applicantName || 'postulante'}</strong>,</p>
        <p style="margin:0 0 20px;">El equipo de Talento Humano de ${EMPRESA} ha agendado la etapa de <strong>${stageName}</strong> en tu proceso de selección.</p>
        <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:20px;margin-bottom:20px;">
          <p style="margin:0 0 8px;"><strong>Fecha y hora:</strong><br>${formatDate(meetingDatetime)}</p>
          <p style="margin:0;"><strong>Modalidad:</strong><br>${modalityText}</p>
          ${linkSection}
          ${notes ? `<p style="margin:8px 0 0;"><strong>Notas:</strong><br>${notes}</p>` : ''}
        </div>
        <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Si tienes alguna pregunta sobre la reunión, responde a este correo o contacta directamente al área de Talento Humano.</p>
        <p style="margin:0;color:#6B7280;font-size:13px;">Equipo de Talento Humano<br>${EMPRESA}</p>
      </div>
    </div>
  `;

  return sendMail({
    to: applicantEmail,
    subject: `${EMPRESA} - ${stageName} agendada`,
    html,
    source: 'hiring_pipeline',
  });
}

// ── Prueba técnica: notificar al responsable ──────────────────────────────────

async function notifyTechnicalTestAssigned({ responsibleEmail, responsibleName, applicantName, availableFrom, availableTo, entryId }) {
  if (!responsibleEmail) return;

  const html = `
    <div style="font-family:'Geist',system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1F2937;">
      <div style="background:#1E293B;padding:24px 32px;border-radius:16px 16px 0 0;">
        <p style="color:#94A3B8;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">${EMPRESA}</p>
        <h1 style="color:#F8FAFC;font-size:20px;font-weight:600;margin:0;">Tienes una prueba técnica asignada</h1>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 16px 16px;">
        <p style="margin:0 0 20px;">Hola <strong>${responsibleName || 'colaborador'}</strong>,</p>
        <p style="margin:0 0 20px;">Talento Humano te ha asignado como responsable de la prueba de habilidades del postulante <strong>${applicantName}</strong>.</p>
        <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:20px;margin-bottom:20px;">
          <p style="margin:0 0 8px;"><strong>Postulante:</strong><br>${applicantName}</p>
          <p style="margin:0;"><strong>Rango de fechas disponible:</strong><br>Del ${formatDate(availableFrom)} al ${formatDate(availableTo)}</p>
        </div>
        <p style="margin:0 0 20px;">Por favor, ingresa a FamSPI y selecciona la fecha y hora exacta dentro del rango indicado para coordinar la prueba.</p>
        <a href="${BASE_URL}" style="display:inline-block;background:#2563EB;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Abrir FamSPI</a>
        <p style="margin:20px 0 0;color:#6B7280;font-size:13px;">Equipo de Talento Humano<br>${EMPRESA}</p>
      </div>
    </div>
  `;

  return sendMail({
    to: responsibleEmail,
    subject: `${EMPRESA} - Prueba técnica asignada: ${applicantName}`,
    html,
    source: 'hiring_pipeline',
  });
}

// ── Prueba técnica: fecha confirmada (a los 3) ────────────────────────────────

async function notifyTechnicalTestConfirmed({ applicantEmail, applicantName, responsibleEmail, responsibleName, thEmail, selectedDatetime }) {
  const dateStr = formatDate(selectedDatetime);

  const recipients = [applicantEmail, responsibleEmail, thEmail].filter(Boolean);
  if (!recipients.length) return;

  const html = `
    <div style="font-family:'Geist',system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1F2937;">
      <div style="background:#1E293B;padding:24px 32px;border-radius:16px 16px 0 0;">
        <p style="color:#94A3B8;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">${EMPRESA}</p>
        <h1 style="color:#F8FAFC;font-size:20px;font-weight:600;margin:0;">Fecha de prueba confirmada</h1>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 16px 16px;">
        <p style="margin:0 0 20px;">La fecha para la prueba de habilidades ha sido confirmada.</p>
        <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:20px;margin-bottom:20px;">
          <p style="margin:0 0 8px;"><strong>Postulante:</strong> ${applicantName}</p>
          <p style="margin:0 0 8px;"><strong>Responsable:</strong> ${responsibleName}</p>
          <p style="margin:0;font-size:16px;font-weight:600;color:#15803D;"><strong>Fecha y hora:</strong><br>${dateStr}</p>
        </div>
        <p style="margin:0;color:#6B7280;font-size:13px;">Equipo de Talento Humano<br>${EMPRESA}</p>
      </div>
    </div>
  `;

  return sendMail({
    to: recipients,
    subject: `${EMPRESA} - Fecha de prueba técnica confirmada: ${applicantName}`,
    html,
    source: 'hiring_pipeline',
  });
}

// ── Propuesta salarial ────────────────────────────────────────────────────────

async function notifySalaryProposal({ applicantEmail, applicantName, proposal }) {
  if (!applicantEmail) return;

  const html = `
    <div style="font-family:'Geist',system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1F2937;">
      <div style="background:#1E293B;padding:24px 32px;border-radius:16px 16px 0 0;">
        <p style="color:#94A3B8;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">${EMPRESA}</p>
        <h1 style="color:#F8FAFC;font-size:20px;font-weight:600;margin:0;">Propuesta de oferta laboral</h1>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 16px 16px;">
        <p style="margin:0 0 20px;">Hola <strong>${applicantName || 'postulante'}</strong>,</p>
        <p style="margin:0 0 20px;">Nos complace extenderte la siguiente propuesta de oferta laboral (propuesta N.${proposal.proposal_number}).</p>
        <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:20px;margin-bottom:20px;">
          <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1D4ED8;">${currency(proposal.base_salary, proposal.currency)}<span style="font-size:14px;font-weight:400;color:#6B7280;"> / mes</span></p>
          ${proposal.benefits ? `<p style="margin:12px 0 0;"><strong>Beneficios adicionales:</strong><br>${proposal.benefits}</p>` : ''}
          ${proposal.extra_notes ? `<p style="margin:12px 0 0;"><strong>Notas:</strong><br>${proposal.extra_notes}</p>` : ''}
        </div>
        <p style="margin:0 0 20px;color:#6B7280;font-size:14px;">Por favor, comunica tu respuesta al equipo de Talento Humano a la brevedad posible.</p>
        <p style="margin:0;color:#6B7280;font-size:13px;">Equipo de Talento Humano<br>${EMPRESA}</p>
      </div>
    </div>
  `;

  return sendMail({
    to: applicantEmail,
    subject: `${EMPRESA} - Propuesta de oferta laboral`,
    html,
    source: 'hiring_pipeline',
  });
}

// ── Contratación finalizada ───────────────────────────────────────────────────

async function notifyHiringComplete({ applicantEmail, applicantName, requestId }) {
  if (!applicantEmail) return;

  const html = `
    <div style="font-family:'Geist',system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1F2937;">
      <div style="background:#15803D;padding:24px 32px;border-radius:16px 16px 0 0;">
        <p style="color:#BBF7D0;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">${EMPRESA}</p>
        <h1 style="color:#F0FDF4;font-size:20px;font-weight:600;margin:0;">Bienvenido al equipo</h1>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 16px 16px;">
        <p style="margin:0 0 20px;">Hola <strong>${applicantName || 'nuevo colaborador'}</strong>,</p>
        <p style="margin:0 0 20px;">Es un gusto informarte que tu proceso de selección ha concluido exitosamente. Eres parte del equipo de <strong>${EMPRESA}</strong>.</p>
        <p style="margin:0 0 20px;">El equipo de Talento Humano se pondrá en contacto contigo para coordinar los detalles de tu incorporación.</p>
        <p style="margin:0;color:#6B7280;font-size:13px;">Equipo de Talento Humano<br>${EMPRESA}</p>
      </div>
    </div>
  `;

  return sendMail({
    to: applicantEmail,
    subject: `${EMPRESA} - Bienvenido al equipo`,
    html,
    source: 'hiring_pipeline',
  });
}

module.exports = {
  notifyMeetingScheduled,
  notifyTechnicalTestAssigned,
  notifyTechnicalTestConfirmed,
  notifySalaryProposal,
  notifyHiringComplete,
};
