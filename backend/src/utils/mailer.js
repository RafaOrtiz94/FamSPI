/**
 * Utils: Envío de correos (Gmail OAuth con respaldo a Google Chat)
 * ----------------------------------------------------------------
 * Envía correos usando la cuenta autorizada vía Gmail OAuth.
 * Si no hay cuenta o falla el envío, usa el webhook de Google Chat.
 */

const logger = require("../config/logger");
const gmailService = require("../services/gmail.service");
const { sendChatMessage, htmlToText } = require("./googleChat");
require("dotenv").config();

const CHAT_WEBHOOK = process.env.GCHAT_WEBHOOK_URL || process.env.GCHAT_WEBHOOK;
const CHAT_THREAD_KEY = process.env.GCHAT_THREAD_KEY || null;
const DEFAULT_GMAIL_USER_ID = process.env.GMAIL_DEFAULT_USER_ID
  ? Number(process.env.GMAIL_DEFAULT_USER_ID)
  : null;

const normalizeRecipients = (value) =>
  Array.isArray(value) ? value.filter(Boolean).join(",") : value;

const resolveFrom = ({ from, senderName }) => {
  if (from && typeof from === "object" && from.email) {
    return from.name || senderName ? `${from.name || senderName} <${from.email}>` : from.email;
  }
  if (typeof from === "string") {
    return senderName ? `${senderName} <${from}>` : from;
  }

  const defaultFrom = process.env.SMTP_FROM || process.env.SMTP_USER || null;
  const defaultName = senderName || process.env.SMTP_FROM_NAME || null;
  if (!defaultFrom) return null;
  return defaultName ? `${defaultName} <${defaultFrom}>` : defaultFrom;
};

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

async function sendViaChat({ to, subject, html }) {
  if (!CHAT_WEBHOOK) {
    logger.warn("[GCHAT] GCHAT_WEBHOOK_URL no configurado; se omite notificación de respaldo.");
    return { delivered: false, via: "none", reason: "missing_webhook" };
  }

  const text = buildChatText({ to, subject, html });
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
}

async function sendViaGmail({
  gmailUserId,
  to,
  subject,
  html,
  text,
  cc,
  bcc,
  replyTo,
  from,
}) {
  const userId = gmailUserId || DEFAULT_GMAIL_USER_ID;
  if (!userId) {
    throw new Error("No hay usuario autorizado para enviar correos via Gmail OAuth");
  }

  const response = await gmailService.sendEmail({
    userId,
    to,
    subject,
    html,
    text,
    cc,
    bcc,
    replyTo,
    from,
  });

  logger.info("[MAILER] Email enviado", {
    to: normalizeRecipients(to),
    subject,
    via: "gmail",
    delegatedUser: from,
  });

  return { delivered: true, via: "gmail", response };
}

async function sendMail({
  to,
  subject,
  html,
  text = null,
  from = null,
  senderName = null,
  replyTo = null,
  cc = null,
  bcc = null,
  delegatedUser = null,
  gmailUserId = null,
} = {}) {
  if (!to || !subject || (!html && !text)) {
    return { delivered: false, via: "none", reason: "missing_fields" };
  }

  const fromAddress = resolveFrom({ from, senderName });

  try {
    return await sendViaGmail({
      gmailUserId,
      to,
      subject,
      html,
      text: text || (!html ? undefined : htmlToText(html)),
      cc,
      bcc,
      replyTo,
      from: fromAddress || delegatedUser || undefined,
    });
  } catch (error) {
    logger.warn({ err: error }, "[MAILER] Error enviando correo con Gmail, intentando respaldo en Chat");

    try {
      return await sendViaChat({ to, subject, html: html || text || "" });
    } catch (chatError) {
      logger.error({ err: chatError }, "[MAILER] Falló envío en Chat de respaldo");
      return { delivered: false, via: "chat", reason: chatError.message };
    }
  }
}

module.exports = { sendMail };
