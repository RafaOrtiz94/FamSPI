/**
 * Utils: Envío de correos (Gmail OAuth con respaldo a Google Chat)
 * ----------------------------------------------------------------
 * Envía correos usando la cuenta autorizada vía Gmail OAuth.
 * Si no hay cuenta o falla el envío, usa el webhook de Google Chat.
 */

const logger = require("../config/logger");
const gmailService = require("../services/gmail.service");
const { htmlToText } = require("./googleChat");
require("dotenv").config();

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
    logger.error({ err: error }, "[MAILER] Error enviando correo con Gmail");
    throw error;
  }
}

module.exports = { sendMail };
