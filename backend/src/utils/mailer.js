/**
 * Utils: Envío de correos (Gmail OAuth con respaldo a Google Chat)
 * ----------------------------------------------------------------
 * Envía correos usando la cuenta autorizada vía Gmail OAuth.
 * Si no hay cuenta o falla el envío, usa el webhook de Google Chat.
 */

const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const logger = require("../config/logger");
const { gmail, createDelegatedJwtClient } = require("../config/google");
const gmailService = require("../services/gmail.service");
const { resolveDelegatedUser } = require("./googleCredentials");
const { htmlToText, sendChatMessage } = require("./googleChat");
const { normalizeHumanText, normalizeEmailAddress } = require("./textEncoding");
require("dotenv").config();

const EMAIL_NOTIFICATIONS_ENABLED = !["false", "0"].includes(
  String(process.env.EMAIL_NOTIFICATIONS_ENABLED ?? "true").trim().toLowerCase()
);
const MAIL_GLOBALLY_DISABLED = String(process.env.DISABLE_MAIL || "false").trim().toLowerCase() === "true";
const EMAIL_SUPPRESS_SOURCES = String(process.env.EMAIL_SUPPRESS_SOURCES || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const SMTP_HOST = process.env.SMTP_HOST || null;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || null;
const SMTP_PASS = process.env.SMTP_PASS || null;
const SMTP_SECURE = String(process.env.SMTP_SECURE || "").trim().toLowerCase() === "true" || SMTP_PORT === 465;
const SYSTEM_MAIL_ADDRESS =
  process.env.SYSTEM_MAIL_ADDRESS ||
  process.env.NOTIFICATION_MAIL_ADDRESS ||
  process.env.GMAIL_SERVICE_ACCOUNT_SENDER ||
  null;
const SYSTEM_MAIL_NAME =
  process.env.SYSTEM_MAIL_NAME ||
  process.env.NOTIFICATION_MAIL_NAME ||
  process.env.SMTP_FROM_NAME ||
  "FamSPI Sistema";
const SYSTEM_MAIL_REPLY_TO =
  process.env.SYSTEM_MAIL_REPLY_TO ||
  process.env.NOTIFICATION_MAIL_REPLY_TO ||
  SYSTEM_MAIL_ADDRESS ||
  null;
const SYSTEM_MAIL_DELEGATED_USER =
  resolveDelegatedUser(process.env.SYSTEM_MAIL_DELEGATED_USER) ||
  resolveDelegatedUser(process.env.NOTIFICATION_MAIL_DELEGATED_USER) ||
  resolveDelegatedUser(process.env.GMAIL_SERVICE_ACCOUNT_SENDER) ||
  resolveDelegatedUser(process.env.GMAIL_DELEGATED_USER) ||
  null;
let smtpTransporter = null;

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
  Array.isArray(value)
    ? value.filter(Boolean).map((item) => normalizeEmailAddress(item)).join(",")
    : normalizeEmailAddress(value);

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

function canUseSmtp() {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
}

function getSmtpTransporter() {
  if (!canUseSmtp()) {
    throw new Error("SMTP no configurado completamente");
  }
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return smtpTransporter;
}

const resolveFrom = ({ from, senderName }) => {
  if (from && typeof from === "object" && from.email) {
    return from.name || senderName ? `${from.name || senderName} <${from.email}>` : from.email;
  }
  if (typeof from === "string") {
    return senderName ? `${senderName} <${from}>` : from;
  }

  const defaultFrom = SYSTEM_MAIL_ADDRESS || process.env.SMTP_FROM || process.env.SMTP_USER || null;
  const defaultName = senderName || SYSTEM_MAIL_NAME || null;
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

  return {
    delivered: true,
    via: "gmail",
    response,
    providerThreadId: response?.threadId || null,
    providerMessageId: response?.messageId || null,
  };
}

const encodeHeaderValue = (value) => {
  if (!value) return "";
  const encoded = Buffer.from(normalizeHumanText(value), "utf-8").toString("base64");
  return `=?UTF-8?B?${encoded}?=`;
};

const encodeAddressHeader = (value) => {
  if (!value) return "";
  const raw = String(value);
  const match = raw.match(/^\s*([^<]+?)\s*<([^>]+)>\s*$/);
  if (!match) return normalizeEmailAddress(raw);
  const displayName = normalizeHumanText(match[1].trim().replace(/^"|"$/g, ""));
  const email = normalizeEmailAddress(match[2]);
  return `${encodeHeaderValue(displayName)} <${email}>`;
};

const encodeMessage = ({ from, to, subject, html, text, cc, bcc, replyTo }) => {
  const lines = [
    `From: ${encodeAddressHeader(from)}`,
    `To: ${Array.isArray(to) ? to.map((item) => normalizeEmailAddress(item)).join(", ") : normalizeEmailAddress(to)}`,
  ];

  if (cc) lines.push(`Cc: ${Array.isArray(cc) ? cc.map((item) => normalizeEmailAddress(item)).join(", ") : normalizeEmailAddress(cc)}`);
  if (bcc) lines.push(`Bcc: ${Array.isArray(bcc) ? bcc.map((item) => normalizeEmailAddress(item)).join(", ") : normalizeEmailAddress(bcc)}`);
  if (replyTo) lines.push(`Reply-To: ${encodeAddressHeader(replyTo)}`);

  lines.push(`Subject: ${encodeHeaderValue(subject)}`);
  lines.push("MIME-Version: 1.0");
  lines.push("Content-Type: text/html; charset=utf-8");
  lines.push("");
  lines.push(normalizeHumanText(html || text || ""));

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
  delegatedUser,
  threadId = null,
}) {
  const delegatedFrom =
    resolveDelegatedUser(delegatedUser) ||
    resolveDelegatedUser(from) ||
    SYSTEM_MAIL_DELEGATED_USER ||
    resolveDelegatedUser(process.env.GMAIL_SERVICE_ACCOUNT_SENDER) ||
    resolveDelegatedUser(process.env.GMAIL_DELEGATED_USER) ||
    resolveDelegatedUser(process.env.GOOGLE_SUBJECT);
  const fromHeader = from || delegatedFrom;

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
    from: fromHeader,
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
    const requestBody = { raw };
    if (threadId) {
      requestBody.threadId = threadId;
    }
    response = await delegatedGmail.users.messages.send({
      userId: "me",
      requestBody,
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

  return {
    delivered: true,
    via: "service_account",
    response,
    providerThreadId: response?.data?.threadId || null,
    providerMessageId: response?.data?.id || null,
  };
}

async function sendViaSmtp({
  to,
  subject,
  html,
  text,
  cc,
  bcc,
  replyTo,
  from,
}) {
  const transporter = getSmtpTransporter();
  const info = await transporter.sendMail({
    from: from || resolveFrom({ from: null, senderName: null }) || SMTP_USER,
    to,
    subject,
    html,
    text,
    cc,
    bcc,
    replyTo,
  });

  logger.info("[MAILER] Email enviado por SMTP", {
    to: normalizeRecipients(to),
    subject,
    via: "smtp",
    messageId: info?.messageId || null,
  });

  return {
    delivered: true,
    via: "smtp",
    response: info,
    providerThreadId: null,
    providerMessageId: info?.messageId || null,
  };
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
  threadId = null,
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

  const fromAddress = normalizeHumanText(resolveFrom({ from, senderName }));
  const normalizedText = normalizeHumanText(text || (!html ? undefined : htmlToText(html)));
  const normalizedHtml = html ? normalizeHumanText(html) : html;
  const normalizedSubject = normalizeHumanText(subject);
  const resolvedReplyTo = normalizeHumanText(replyTo || SYSTEM_MAIL_REPLY_TO || undefined);

  try {
    return await sendViaServiceAccount({
      to,
      subject: normalizedSubject,
      html: normalizedHtml,
      text: normalizedText,
      cc,
      bcc,
      replyTo: resolvedReplyTo,
      from: fromAddress || delegatedUser || undefined,
      delegatedUser: delegatedUser || undefined,
      threadId,
    });
  } catch (serviceAccountError) {
    logger.warn(
      {
        error: serviceAccountError?.message,
        to: normalizeRecipients(to),
        subject,
      },
      "[MAILER] Fallo service account; intentando SMTP",
    );
  }

  if (canUseSmtp()) {
    try {
      return await sendViaSmtp({
        to,
        subject: normalizedSubject,
        html: normalizedHtml,
        text: normalizedText,
        cc,
        bcc,
        replyTo: resolvedReplyTo,
        from: fromAddress || undefined,
      });
    } catch (smtpError) {
      logger.error(
        {
          error: smtpError?.message,
          to: normalizeRecipients(to),
          subject,
        },
        "[MAILER] Fallo SMTP",
      );
    }
  }

  return await sendViaChatFallback({
    to,
    subject: normalizedSubject,
    html: normalizedHtml,
    text: normalizedText,
    cc,
    bcc,
    replyTo: resolvedReplyTo,
    from: fromAddress || delegatedUser || undefined,
    reason: "service_account_and_smtp_failed",
  });
}

module.exports = { sendMail };
