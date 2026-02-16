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
const { htmlToText, sendChatMessage } = require("./googleChat");
require("dotenv").config();

const EMAIL_NOTIFICATIONS_ENABLED = !["false", "0"].includes(
  String(process.env.EMAIL_NOTIFICATIONS_ENABLED ?? "true").trim().toLowerCase()
);
const MAIL_GLOBALLY_DISABLED = String(process.env.DISABLE_MAIL || "false").trim().toLowerCase() === "true";
const EMAIL_SUPPRESS_SOURCES = String(process.env.EMAIL_SUPPRESS_SOURCES || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

function logGoogleApiError(err, context = {}) {
  const payload = {
    ...context,
    message: err?.message,
    code: err?.code,
    status: err?.response?.status,
    apiError: err?.response?.data?.error,
    apiErrorDescription: err?.response?.data?.error_description,
  };

  logger.error(payload, "[MAILER] Error detallado de Google API");
}

const DEFAULT_GMAIL_USER_ID = process.env.GMAIL_DEFAULT_USER_ID
  ? Number(process.env.GMAIL_DEFAULT_USER_ID)
  : null;

const normalizeRecipients = (value) =>
  Array.isArray(value) ? value.filter(Boolean).join(",") : value;

const normalizeSource = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s./-]+/g, "_");

function inferSourceFromStack() {
  try {
    const stack = new Error().stack || "";
    if (stack.includes("/modules/private-purchases/")) return "private_purchases";
    if (stack.includes("/modules/equipment-purchases/")) return "equipment_purchases";
    if (stack.includes("/modules/business-case/")) return "business_case";
    if (stack.includes("/modules/approvals/")) return "approvals";
    if (stack.includes("/modules/requests/")) return "requests";
    return "unknown";
  } catch {
    return "unknown";
  }
}

function isSuppressedSource(source) {
  if (!EMAIL_SUPPRESS_SOURCES.length) return false;
  if (EMAIL_SUPPRESS_SOURCES.includes("*")) return true;
  return EMAIL_SUPPRESS_SOURCES.some((item) => source === item || source.startsWith(`${item}_`));
}

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

const encodeHeaderValue = (value) => {
  if (!value) return "";
  const encoded = Buffer.from(String(value), "utf-8").toString("base64");
  return `=?UTF-8?B?${encoded}?=`;
};

const encodeMessage = ({ from, to, subject, html, text, cc, bcc, replyTo }) => {
  const lines = [
    `From: ${from}`,
    `To: ${Array.isArray(to) ? to.join(", ") : to}`,
  ];

  if (cc) lines.push(`Cc: ${Array.isArray(cc) ? cc.join(", ") : cc}`);
  if (bcc) lines.push(`Bcc: ${Array.isArray(bcc) ? bcc.join(", ") : bcc}`);
  if (replyTo) lines.push(`Reply-To: ${replyTo}`);

  lines.push(`Subject: ${encodeHeaderValue(subject)}`);
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
    logGoogleApiError(err, {
      step: "service_account_authorize",
      delegatedFrom,
      scopes: delegatedAuth?.scopes,
      clientEmail: delegatedAuth?.email,
    });

    const baseMessage = `La service account no está autorizada para enviar como ${delegatedFrom}`;

    if (err?.message === "unauthorized_client") {
      throw new Error(
        `${baseMessage}: el cliente de API no tiene delegación habilitada para los scopes de Gmail. ` +
          "Valida en la consola de Admin que la delegación esté activa para la Service Account " +
          "y que incluya el scope https://www.googleapis.com/auth/gmail.send",
      );
    }

    throw new Error(`${baseMessage}: ${err.message}`);
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
  let response;
  try {
    response = await delegatedGmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
  } catch (err) {
    logGoogleApiError(err, {
      step: "service_account_send",
      delegatedFrom,
      to: normalizeRecipients(to),
      subject,
    });
    throw err;
  }

  logger.info("[MAILER] Email enviado con service account", {
    to: normalizeRecipients(to),
    subject,
    via: "service_account",
    delegatedUser: delegatedFrom,
  });

  return { delivered: true, via: "service_account", response };
}

async function sendViaChatFallback({ to, subject, html, text, cc, bcc, replyTo, from, reason }) {
  const plainBody = text || (!html ? "" : htmlToText(html));
  const summaryLines = [
    `✉️ Fallback Google Chat`,
    `Asunto: ${subject}`,
    `Para: ${normalizeRecipients(to)}`,
  ];
  if (cc) summaryLines.push(`CC: ${normalizeRecipients(cc)}`);
  if (bcc) summaryLines.push(`BCC: ${normalizeRecipients(bcc)}`);
  if (replyTo) summaryLines.push(`Reply-To: ${replyTo}`);
  if (from) summaryLines.push(`De: ${from}`);
  if (reason) summaryLines.push(`Motivo: ${reason}`);

  const bodyPreview = plainBody ? `\n\n${plainBody}` : "";
  const textMessage = `${summaryLines.join("\n")}\n${bodyPreview}`;

  await sendChatMessage({ text: textMessage });

  logger.info("[MAILER] Mensaje enviado a Google Chat como respaldo", {
    to: normalizeRecipients(to),
    subject,
    via: "google_chat",
  });

  return { delivered: true, via: "google_chat" };
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
  source = null,
} = {}) {
  if (!to || !subject || (!html && !text)) {
    return { delivered: false, via: "none", reason: "missing_fields" };
  }

  if (!EMAIL_NOTIFICATIONS_ENABLED || MAIL_GLOBALLY_DISABLED) {
    logger.info("[MAILER] Envio omitido por configuracion global", {
      to: normalizeRecipients(to),
      subject,
      reason: !EMAIL_NOTIFICATIONS_ENABLED ? "EMAIL_NOTIFICATIONS_ENABLED=false" : "DISABLE_MAIL=true",
    });
    return {
      delivered: false,
      via: "none",
      reason: "disabled_globally",
    };
  }

  const resolvedSource = normalizeSource(source) || inferSourceFromStack();
  if (isSuppressedSource(resolvedSource)) {
    logger.info("[MAILER] Envio omitido por supresion de modulo", {
      source: resolvedSource,
      to: normalizeRecipients(to),
      subject,
    });
    return {
      delivered: false,
      via: "none",
      reason: "disabled_for_source",
      source: resolvedSource,
    };
  }

  const fromAddress = resolveFrom({ from, senderName });
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
}

module.exports = { sendMail };
