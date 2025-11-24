/**
 * Utils: Envío de correos (Gmail OAuth con respaldo a Google Chat)
 * ----------------------------------------------------------------
 * Envía correos usando la cuenta autorizada vía Gmail OAuth.
 * Si no hay cuenta o falla el envío, usa el webhook de Google Chat.
 */

const { google } = require("googleapis");
const logger = require("../config/logger");
const { gmail, createDelegatedJwtClient } = require("../config/google");
const gmailService = require("../services/gmail.service");
const { resolveDelegatedUser } = require("./googleCredentials");
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

const encodeMessage = ({ from, to, subject, html, text, cc, bcc, replyTo }) => {
  const lines = [
    `From: ${from}`,
    `To: ${Array.isArray(to) ? to.join(", ") : to}`,
  ];

  if (cc) lines.push(`Cc: ${Array.isArray(cc) ? cc.join(", ") : cc}`);
  if (bcc) lines.push(`Bcc: ${Array.isArray(bcc) ? bcc.join(", ") : bcc}`);
  if (replyTo) lines.push(`Reply-To: ${replyTo}`);

  lines.push(`Subject: ${subject}`);
  lines.push("MIME-Version: 1.0");
  lines.push("Content-Type: text/html; charset=utf-8");
  lines.push("");
  lines.push(html || text || "");

  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

async function sendViaServiceAccount({
  to,
  subject,
  html,
  text,
  cc,
  bcc,
  replyTo,
  from,
}) {
  const delegatedFrom =
    resolveDelegatedUser(from) ||
    resolveDelegatedUser(process.env.GMAIL_SERVICE_ACCOUNT_SENDER) ||
    resolveDelegatedUser(process.env.SMTP_FROM) ||
    resolveDelegatedUser(process.env.SMTP_USER);

  if (!delegatedFrom) {
    throw new Error("No hay remitente delegado configurado para el envío de correos");
  }

  const delegatedAuth = createDelegatedJwtClient(delegatedFrom);
  try {
    await delegatedAuth.authorize();
  } catch (err) {
    throw new Error(
      `La service account no está autorizada para enviar como ${delegatedFrom}: ${err.message}`,
    );
  }

  const raw = encodeMessage({
    from: delegatedFrom,
    to,
    subject,
    html,
    text,
    cc,
    bcc,
    replyTo: replyTo || delegatedFrom,
  });

  const delegatedGmail = google.gmail({ version: "v1", auth: delegatedAuth });
  const response = await delegatedGmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  logger.info("[MAILER] Email enviado con service account", {
    to: normalizeRecipients(to),
    subject,
    via: "service_account",
    delegatedUser: delegatedFrom,
  });

  return { delivered: true, via: "service_account", response };
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
    logger.warn(
      `[MAILER] Error enviando con Gmail OAuth (${error.message}). Intentando con service account...`
    );

    try {
      return await sendViaServiceAccount({
        to,
        subject,
        html,
        text: text || (!html ? undefined : htmlToText(html)),
        cc,
        bcc,
        replyTo,
        from: fromAddress || delegatedUser || undefined,
      });
    } catch (fallbackError) {
      logger.error({ err: fallbackError }, "[MAILER] Fallback con service account falló");
      throw new Error(
        `No se pudo enviar el correo (Gmail OAuth y service account fallaron): ${fallbackError.message}`
      );
    }
  }
}

module.exports = { sendMail };
