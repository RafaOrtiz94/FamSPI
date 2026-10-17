const webpush = require("web-push");

const normalizeVapidKey = (value) => String(value || "").replace(/\s+/g, "");
const getPublicKey = () => normalizeVapidKey(process.env.WEB_PUSH_PUBLIC_KEY);
const getPrivateKey = () => normalizeVapidKey(process.env.WEB_PUSH_PRIVATE_KEY);
const isAppleWebPushEndpoint = (endpoint) => {
  try {
    return new URL(String(endpoint || "")).hostname === "web.push.apple.com";
  } catch (error) {
    return false;
  }
};
const getSubject = () =>
  String(
    process.env.WEB_PUSH_SUBJECT ||
      process.env.NOTIFICATION_MAIL_ADDRESS ||
      process.env.SYSTEM_MAIL_ADDRESS ||
      "mailto:soporte@famproject.com",
  ).trim();

const isConfigured = () => Boolean(getPublicKey() && getPrivateKey());

const ensureConfigured = () => {
  if (!isConfigured()) {
    throw new Error("WEB_PUSH_NOT_CONFIGURED");
  }

  webpush.setVapidDetails(getSubject(), getPublicKey(), getPrivateKey());
};

const sendToSubscription = async (subscription, payload, options = {}) => {
  ensureConfigured();
  const requestOptions = {
    TTL: Number(options.ttl || 60),
    urgency: options.urgency || "normal",
  };

  if (options.topic && !isAppleWebPushEndpoint(subscription?.endpoint)) {
    requestOptions.topic = options.topic;
  }

  return webpush.sendNotification(subscription, JSON.stringify(payload), requestOptions);
};

module.exports = {
  isConfigured,
  getPublicKey,
  getSubject,
  sendToSubscription,
};
