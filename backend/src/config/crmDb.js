// Configuración de integración con EspoCRM via REST API
// Ya no requiere conexión MySQL directa — EspoCRM expone /api/v1/

const isCrmSyncEnabled = () =>
  String(process.env.CRM_SYNC_ENABLED || "false").toLowerCase() === "true";

const getCrmConfig = () => ({
  enabled: isCrmSyncEnabled(),
  baseUrl: String(process.env.CRM_BASE_URL || "").replace(/\/+$/, ""),
  apiKey: process.env.CRM_API_KEY || "",
  timeoutMs: parseInt(process.env.CRM_TIMEOUT_MS || "8000", 10),
});

module.exports = { isCrmSyncEnabled, getCrmConfig };
