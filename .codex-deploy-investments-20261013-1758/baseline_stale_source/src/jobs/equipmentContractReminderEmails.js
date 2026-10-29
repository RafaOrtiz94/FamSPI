const db = require('../config/db');
const logger = require('../config/logger');
const { sendMail } = require('../utils/mailer');

const CONTRACT_MAX_DAYS = 110;
const CONTRACT_REMINDER_DAYS_BEFORE = 15;
const CONTRACT_REMINDER_OFFSET_DAYS = CONTRACT_MAX_DAYS - CONTRACT_REMINDER_DAYS_BEFORE;

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email || null;
}

function addUtcDays(value, days) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function toDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatDateEs(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/D';
  return date.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getDaysUntilDate(dateOnly) {
  if (!dateOnly) return null;
  const target = new Date(`${dateOnly}T00:00:00.000Z`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / DAY_MS);
}

async function ensureColumns() {
  await db.query(
    `ALTER TABLE equipment_purchase_requests
        ADD COLUMN IF NOT EXISTS contract_reminder_email_sent_at TIMESTAMPTZ`,
  );
  await db.query(
    `ALTER TABLE equipment_purchase_requests
        ADD COLUMN IF NOT EXISTS contract_reminder_email_to TEXT`,
  );
}

async function runOnce() {
  logger.info('[JOBS][CONTRACT_REMINDER] Ejecutando recordatorios de contrato (15 dias antes)');

  await ensureColumns();

  const { rows } = await db.query(
    `SELECT
        id,
        client_name,
        signed_proforma_uploaded_at,
        assigned_to_email,
        created_by_email
      FROM equipment_purchase_requests
      WHERE COALESCE(request_type, 'purchase') = 'purchase'
        AND signed_proforma_uploaded_at IS NOT NULL
        AND contract_uploaded_at IS NULL
        AND contract_reminder_email_sent_at IS NULL
        AND ((signed_proforma_uploaded_at AT TIME ZONE 'America/Guayaquil')::date + $1::int) <= CURRENT_DATE
      ORDER BY signed_proforma_uploaded_at ASC`,
    [CONTRACT_REMINDER_OFFSET_DAYS],
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const recipient = normalizeEmail(row.assigned_to_email) || normalizeEmail(row.created_by_email);
    if (!recipient) {
      skipped += 1;
      logger.warn(
        { purchaseId: row.id },
        '[JOBS][CONTRACT_REMINDER] Solicitud sin correo destino (assigned_to_email/created_by_email)',
      );
      continue;
    }

    const dueDate = addUtcDays(row.signed_proforma_uploaded_at, CONTRACT_MAX_DAYS);
    const reminderDate = addUtcDays(row.signed_proforma_uploaded_at, CONTRACT_REMINDER_OFFSET_DAYS);
    const dueDateOnly = toDateOnly(dueDate);
    const daysRemaining = getDaysUntilDate(dueDateOnly);

    const subject = `Recordatorio: contrato firmado por vencer · Compra publica #${String(row.id).slice(0, 8)}`;
    const html = `
      <p>Hola,</p>
      <p>La compra publica <strong>#${row.id}</strong> del cliente <strong>${row.client_name || 'N/D'}</strong> tiene contrato pendiente.</p>
      <p>Fecha de recordatorio (15 dias antes): <strong>${formatDateEs(reminderDate)}</strong></p>
      <p>Fecha limite para subir contrato firmado (110 dias): <strong>${formatDateEs(dueDate)}</strong></p>
      <p>Dias restantes aproximados: <strong>${Number.isFinite(daysRemaining) ? daysRemaining : 'N/D'}</strong></p>
      <p>Accion requerida: subir el contrato firmado en SPI para continuar el flujo.</p>
    `;

    try {
      await sendMail({
        to: recipient,
        subject,
        html,
        source: 'equipment_purchases_contract_reminder',
      });

      await db.query(
        `UPDATE equipment_purchase_requests
            SET contract_reminder_email_sent_at = now(),
                contract_reminder_email_to = $1,
                updated_at = now()
          WHERE id = $2`,
        [recipient, row.id],
      );

      sent += 1;
    } catch (error) {
      failed += 1;
      logger.error(
        { error: error?.message, purchaseId: row.id, recipient },
        '[JOBS][CONTRACT_REMINDER] Error enviando recordatorio',
      );
    }
  }

  logger.info(
    {
      scanned: rows.length,
      sent,
      skipped,
      failed,
      reminderOffsetDays: CONTRACT_REMINDER_OFFSET_DAYS,
    },
    '[JOBS][CONTRACT_REMINDER] Finalizado',
  );

  return {
    success: failed === 0,
    scanned: rows.length,
    sent,
    skipped,
    failed,
    reminder_offset_days: CONTRACT_REMINDER_OFFSET_DAYS,
  };
}

module.exports = {
  runOnce,
};
