const db = require("../../config/db");
const logger = require("../../config/logger");
const { sendMail } = require("../../utils/mailer");
const notificationManager = require("../notifications/notificationManager");

async function getSingleUserByRole(role) {
  if (!role) return null;
  try {
    const { rows } = await db.query(
      "SELECT id, email, fullname, name, role FROM users WHERE LOWER(role) = LOWER($1) ORDER BY id ASC LIMIT 1",
      [role]
    );
    return rows[0] || null;
  } catch (error) {
    logger.warn({ error, role }, "No se pudo obtener usuario por rol");
    return null;
  }
}

async function getUserById(userId) {
  if (!userId) return null;
  try {
    const { rows } = await db.query(
      "SELECT id, email, fullname, name, role FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );
    return rows[0] || null;
  } catch (error) {
    logger.warn({ error, userId }, "No se pudo obtener usuario por id");
    return null;
  }
}

function uniqueRecipients(...emails) {
  const recipients = emails.flat().filter(Boolean);
  return [...new Set(recipients.map((email) => String(email).trim().toLowerCase()))];
}

async function notifyUsers({ users = [], subject, html, text, notification, sendEmail = true }) {
  if (sendEmail) {
    const recipients = uniqueRecipients(users.map((user) => user?.email).filter(Boolean));
    if (recipients.length) {
      try {
        await sendMail({
          to: recipients,
          subject,
          html,
          text,
        });
      } catch (error) {
        logger.warn({ error }, "No se pudo enviar correo de notificacion de personal");
      }
    }
  }

  if (notification) {
    await Promise.all(
      users
        .filter((user) => user?.id)
        .map((user) =>
          notificationManager.sendNotification({
            userId: user.id,
            customTitle: notification.title,
            customMessage: notification.message,
            type: notification.type || "info",
            source: notification.source || "personnel_requests",
            priority: notification.priority || 0,
            email: false,
            meta: notification.meta || {},
          })
        )
    );
  }
}

module.exports = {
  getSingleUserByRole,
  getUserById,
  uniqueRecipients,
  notifyUsers,
};
