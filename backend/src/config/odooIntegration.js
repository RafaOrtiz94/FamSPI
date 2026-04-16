const normalize = (value) => String(value || "").trim();

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = normalize(value).toLowerCase();
  return ["1", "true", "yes", "on", "si"].includes(normalized);
};

const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseText = (value, fallback = null) => {
  const normalized = normalize(value);
  return normalized || fallback;
};

const parseBaseUrl = (value) => {
  const raw = parseText(value, null);
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
};

const getOdooIntegrationConfig = () => {
  const timeoutMs = parseInteger(process.env.ODOO_TIMEOUT_MS, 10000);
  const safeTimeoutMs = Math.max(1000, timeoutMs);
  const parsedUrl = parseBaseUrl(process.env.ODOO_URL || process.env.ODOO_BASE_URL);
  const parsedDatabase = parseText(process.env.ODOO_DB || process.env.ODOO_DATABASE, null);
  const parsedApiKey = parseText(process.env.ODOO_API_KEY, null);
  const parsedUser = parseText(process.env.ODOO_USER || process.env.ODOO_USERNAME, null);
  const parsedPassword = parseText(process.env.ODOO_PASSWORD || process.env.ODOO_PASS, null);

  return Object.freeze({
    enabled: parseBoolean(process.env.ODOO_INTEGRATION_ENABLED, false),
    url: parsedUrl,
    // Backwards compatibility alias
    baseUrl: parsedUrl,
    database: parsedDatabase,
    apiKey: parsedApiKey,
    user: parsedUser,
    password: parsedPassword,
    timeoutMs: safeTimeoutMs,
    allowInsecureTls: parseBoolean(process.env.ODOO_ALLOW_INSECURE_TLS, false),
    outboxTopic: parseText(process.env.ODOO_OUTBOX_TOPIC, "odoo.sync.v1"),
  });
};

const isOdooIntegrationEnabled = () => getOdooIntegrationConfig().enabled;

module.exports = {
  getOdooIntegrationConfig,
  isOdooIntegrationEnabled,
};
