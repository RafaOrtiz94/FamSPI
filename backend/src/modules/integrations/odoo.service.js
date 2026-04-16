const {
  getOdooIntegrationConfig,
  isOdooIntegrationEnabled,
} = require("../../config/odooIntegration");

const getOdooIntegrationHealth = () => {
  const config = getOdooIntegrationConfig();
  const missingConfig = [];

  if (config.enabled && !config.url) missingConfig.push("ODOO_URL");
  if (config.enabled && !config.database) missingConfig.push("ODOO_DB");
  if (config.enabled && !config.user) missingConfig.push("ODOO_USER");
  if (config.enabled && !config.apiKey && !config.password) {
    missingConfig.push("ODOO_API_KEY_OR_PASSWORD");
  }

  let status = "disabled";
  if (config.enabled && missingConfig.length > 0) {
    status = "degraded_config";
  } else if (config.enabled) {
    status = "ready";
  }

  return {
    provider: "odoo",
    status,
    enabled: config.enabled,
    url_configured: Boolean(config.url),
    base_url_configured: Boolean(config.baseUrl),
    api_key_configured: Boolean(config.apiKey),
    password_configured: Boolean(config.password),
    user_configured: Boolean(config.user),
    database_configured: Boolean(config.database),
    timeout_ms: config.timeoutMs,
    allow_insecure_tls: config.allowInsecureTls,
    outbox_topic: config.outboxTopic,
    missing_config: missingConfig,
  };
};

const buildOdooOutboxEnvelope = ({
  eventType,
  payload,
  correlationId,
  idempotencyKey,
}) => {
  if (!isOdooIntegrationEnabled()) {
    return {
      skipped: true,
      reason: "odoo_integration_disabled",
    };
  }

  return {
    skipped: false,
    provider: "odoo",
    event_type: eventType,
    payload: payload || {},
    correlation_id: correlationId || null,
    idempotency_key: idempotencyKey || null,
    queued_at: new Date().toISOString(),
  };
};

module.exports = {
  getOdooIntegrationHealth,
  buildOdooOutboxEnvelope,
};
