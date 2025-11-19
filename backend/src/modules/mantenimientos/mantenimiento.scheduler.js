const db = require("../../config/db");
const logger = require("../../config/logger");
const { sendMail } = require("../../utils/mailer");

const REMINDER_STATUS = {
  PENDING: "pendiente",
  SENT: "notificado",
};

const DEFAULT_INTERVAL_MINUTES = Number(
  process.env.MANTENIMIENTO_REMINDER_INTERVAL_MINUTES || 60
);

const formatHumanDate = (value) => {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("es-EC", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value));
  } catch (_err) {
    return value;
  }
};

async function fetchPendingReminders() {
  const { rows } = await db.query(
    `
      SELECT 
        m.id,
        m.id_equipo,
        m.tipo,
        m.responsable,
        m.next_maintenance_date,
        COALESCE(u.email, $2) AS email_destino,
        COALESCE(u.fullname, u.name, u.email, $2) AS nombre_destino
      FROM servicio.cronograma_mantenimientos m
      LEFT JOIN public.users u ON u.id = m.created_by
      WHERE m.next_maintenance_date IS NOT NULL
        AND m.next_maintenance_status = $1
        AND m.next_maintenance_date <= CURRENT_DATE
    `,
    [REMINDER_STATUS.PENDING, process.env.SMTP_TO || process.env.SMTP_FROM || null]
  );
  return rows || [];
}

async function sendReminderEmail(row) {
  const recipients = [row.email_destino, process.env.SMTP_FROM].filter(Boolean);
  if (recipients.length === 0) {
    logger.warn(
      { mantenimiento_id: row.id },
      "No hay correo para enviar recordatorio de mantenimiento"
    );
    return;
  }

  const humanDate = formatHumanDate(row.next_maintenance_date);
  await sendMail({
    to: recipients,
    subject: `Recordatorio automático – Mantenimiento #${row.id}`,
    html: `
      <p>Hola ${row.nombre_destino || "equipo"},</p>
      <p>
        Te recordamos que el mantenimiento <strong>#${row.id}</strong> del equipo <strong>${row.id_equipo}</strong>
        está programado para el <strong>${humanDate}</strong>.
      </p>
      <p>
        Tipo: <b>${row.tipo}</b><br/>
        Responsable registrado: <b>${row.responsable}</b>
      </p>
      <p>Por favor confirma su ejecución o reagenda la intervención en SPI.</p>
      <p>— SPI2 • Gestión de Mantenimientos</p>
    `,
  });
}

async function processReminders() {
  try {
    const reminders = await fetchPendingReminders();
    if (!reminders.length) return;

    logger.info(
      { count: reminders.length },
      "Procesando recordatorios automáticos de mantenimiento"
    );

    for (const reminder of reminders) {
      try {
        await sendReminderEmail(reminder);
        await db.query(
          `
            UPDATE servicio.cronograma_mantenimientos
            SET next_maintenance_status = $1,
                next_reminder_sent_at = now(),
                updated_at = now()
            WHERE id = $2
          `,
          [REMINDER_STATUS.SENT, reminder.id]
        );
      } catch (err) {
        logger.error(
          { err, mantenimiento_id: reminder.id },
          "No se pudo enviar recordatorio automático"
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "Fallo al procesar recordatorios de mantenimiento");
  }
}

let schedulerInterval = null;

function startReminderScheduler() {
  if (schedulerInterval) {
    return;
  }

  const minutes = Number.isFinite(DEFAULT_INTERVAL_MINUTES)
    ? Math.max(DEFAULT_INTERVAL_MINUTES, 15)
    : 60;
  const intervalMs = minutes * 60 * 1000;

  logger.info(
    `⏱️ Scheduler de mantenimientos activo (cada ${minutes} min, recordatorios en ${REMINDER_STATUS.PENDING})`
  );
  schedulerInterval = setInterval(processReminders, intervalMs);

  // Ejecutar una vez en el arranque
  processReminders().catch((err) =>
    logger.error({ err }, "Error inicial al disparar recordatorios")
  );
}

module.exports = { startReminderScheduler };
