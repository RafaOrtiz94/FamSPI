const axios = require("axios");
const logger = require("../config/logger");

const defaultWebhook = process.env.GCHAT_WEBHOOK_URL || process.env.GCHAT_WEBHOOK;
const CHAT_DISABLED = process.env.DISABLE_GCHAT === "true";

// Space privado de Talento Humano (solo personal TH + el sistema) -- separado
// del grupo general de notificaciones para que las alertas de asistencia
// (irregularidades, solicitudes de regularizacion/teletrabajo) no se mezclen
// con las de Business Case/compras/mantenimientos que usan el webhook default.
const talentoHumanoWebhook = process.env.GCHAT_WEBHOOK_URL_TH;
const TALENTO_HUMANO_CHAT_SOURCES = new Set([
  "attendance.irregularity",
  "attendance.telework",
]);

function resolveWebhookUrlForSource(source) {
  if (TALENTO_HUMANO_CHAT_SOURCES.has(source) && talentoHumanoWebhook) {
    return talentoHumanoWebhook;
  }
  return defaultWebhook;
}

function htmlToText(html = "") {
  return String(html || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sendChatMessage({ text, threadKey = null, webhookUrl = defaultWebhook } = {}) {
  if (CHAT_DISABLED) {
    logger.info("[GCHAT] DISABLE_GCHAT=true → se omite mensaje");
    return { delivered: false, reason: "disabled" };
  }

  if (!webhookUrl) {
    const err = new Error("Webhook de Google Chat no configurado");
    err.code = "GCHAT_WEBHOOK_MISSING";
    throw err;
  }

  const payload = { text };
  if (threadKey) payload.thread = { threadKey };

  const res = await axios.post(webhookUrl, payload, { timeout: 5000 });
  logger.info("[GCHAT] Mensaje enviado", { status: res.status, threadKey });
  return { delivered: true, status: res.status };
}

module.exports = {
  sendChatMessage,
  htmlToText,
  resolveWebhookUrlForSource,
};
