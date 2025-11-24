/**
 * Utils: Envío de correos (SMTP con fallback a Google Chat)
 * --------------------------------------------------------
 * Intenta enviar correos reales usando la configuración SMTP.
 * Si falta configuración, usa el webhook de Google Chat como respaldo.
 */

const nodemailer = require("nodemailer");
const logger = require("../config/logger");
const { sendChatMessage, htmlToText } = require("./googleChat");
require("dotenv").config();

const CHAT_WEBHOOK = process.env.GCHAT_WEBHOOK_URL || process.env.GCHAT_WEBHOOK;
const CHAT_THREAD_KEY = process.env.GCHAT_THREAD_KEY || null;

let smtpTransport = null;

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

const getSmtpTransport = () => {
  if (smtpTransport) return smtpTransport;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    logger.warn("[MAILER] Configuración SMTP incompleta; se usará Google Chat como respaldo.");
    return null;
  }

  smtpTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true" || Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return smtpTransport;
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
} = {}) {
  if (!to || !subject || (!html && !text)) {
    return { delivered: false, via: "none", reason: "missing_fields" };
  }

  const transporter = getSmtpTransport();
  const fromAddress = resolveFrom({ from, senderName });
  const mailOptions = {
    from: fromAddress || undefined,
    to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject,
    html: html || undefined,
    text: text || (!html ? undefined : htmlToText(html)),
    replyTo: replyTo || undefined,
  };

  try {
    if (!transporter) throw new Error("SMTP no configurado");

    const response = await transporter.sendMail(mailOptions);
    logger.info("[MAILER] Email enviado", {
      to: normalizeRecipients(to),
      subject,
      via: "smtp",
      delegatedUser,
    });

    return { delivered: true, via: "smtp", response };
  } catch (error) {
    logger.warn({ err: error }, "[MAILER] Error enviando correo, intentando respaldo en Chat");

    try {
      return await sendViaChat({ to, subject, html: html || text || "" });
    } catch (chatError) {
      logger.error({ err: chatError }, "[MAILER] Falló envío en Chat de respaldo");
      return { delivered: false, via: "chat", reason: chatError.message };
    }
  }
}

module.exports = { sendMail };
