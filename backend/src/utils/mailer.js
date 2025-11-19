/**
 * Utils: Notificaciones por Google Chat
 * -------------------------------------
 * Reemplaza el envío de correo: ahora solo se notificará vía webhook de Chat.
 */

const logger = require("../config/logger");
const { sendChatMessage, htmlToText } = require("./googleChat");
require("dotenv").config();

const CHAT_WEBHOOK = process.env.GCHAT_WEBHOOK_URL || process.env.GCHAT_WEBHOOK;
const CHAT_THREAD_KEY = process.env.GCHAT_THREAD_KEY || null;

const normalizeRecipients = (value) =>
  Array.isArray(value) ? value.filter(Boolean).join(",") : value;

function buildChatText({ to, subject, html }) {
  const normalizedTo = normalizeRecipients(to);
  const plain = htmlToText(html);
  return [
    subject ? `📢 ${subject}` : null,
    normalizedTo ? `Destinatarios: ${normalizedTo}` : null,
    plain ? `\n${plain}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendMail({
  to,
  subject,
  html,
  // Campos ignorados pero soportados para compatibilidad
  from = null,
  senderName = null,
  replyTo = null,
  delegatedUser = null,
} = {}) {
  if (from || senderName || replyTo || delegatedUser) {
    // Compatibilidad: se aceptan pero se ignoran
  }

  const text = buildChatText({ to, subject, html });

  if (!CHAT_WEBHOOK) {
    logger.warn("[GCHAT] GCHAT_WEBHOOK_URL no configurado; se omite notificación.");
    return { delivered: false, via: "none", reason: "missing_webhook" };
  }

  try {
    const res = await sendChatMessage({
      text,
      threadKey: CHAT_THREAD_KEY,
      webhookUrl: CHAT_WEBHOOK,
    });

    logger.info("[GCHAT] Notificación enviada", {
      to: normalizeRecipients(to),
      subject,
      via: "chat",
    });

    return { delivered: true, via: "chat", response: res };
  } catch (err) {
    logger.warn({ err }, "[GCHAT] No se pudo enviar notificación");
    return { delivered: false, via: "chat", reason: err.message };
  }
}

module.exports = { sendMail };
