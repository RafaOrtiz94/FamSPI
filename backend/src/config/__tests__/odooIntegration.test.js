const {
  getOdooIntegrationConfig,
  isOdooIntegrationEnabled,
} = require("../odooIntegration");

const ORIGINAL_ENV = { ...process.env };

const resetOdooEnv = () => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.ODOO_INTEGRATION_ENABLED;
  delete process.env.ODOO_URL;
  delete process.env.ODOO_BASE_URL;
  delete process.env.ODOO_USER;
  delete process.env.ODOO_USERNAME;
  delete process.env.ODOO_PASSWORD;
  delete process.env.ODOO_PASS;
  delete process.env.ODOO_DATABASE;
  delete process.env.ODOO_DB;
  delete process.env.ODOO_API_KEY;
  delete process.env.ODOO_TIMEOUT_MS;
  delete process.env.ODOO_ALLOW_INSECURE_TLS;
  delete process.env.ODOO_OUTBOX_TOPIC;
};

describe("config/odooIntegration", () => {
  beforeEach(() => {
    resetOdooEnv();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("defaults to integration disabled in development/local env", () => {
    const config = getOdooIntegrationConfig();

    expect(config.enabled).toBe(false);
    expect(config.url).toBeNull();
    expect(isOdooIntegrationEnabled()).toBe(false);
    expect(config.baseUrl).toBeNull();
    expect(config.user).toBeNull();
    expect(config.password).toBeNull();
    expect(config.apiKey).toBeNull();
    expect(config.timeoutMs).toBe(10000);
    expect(config.outboxTopic).toBe("odoo.sync.v1");
  });

  it("parses env overrides and normalizes base url", () => {
    process.env.ODOO_INTEGRATION_ENABLED = "true";
    process.env.ODOO_URL = "https://odoo.local///";
    process.env.ODOO_USER = "svc_spi";
    process.env.ODOO_DB = "OdooFAM";
    process.env.ODOO_API_KEY = "token";
    process.env.ODOO_TIMEOUT_MS = "2500";
    process.env.ODOO_ALLOW_INSECURE_TLS = "1";
    process.env.ODOO_OUTBOX_TOPIC = "spi.odoo.events.v1";

    const config = getOdooIntegrationConfig();

    expect(config.enabled).toBe(true);
    expect(isOdooIntegrationEnabled()).toBe(true);
    expect(config.url).toBe("https://odoo.local");
    expect(config.baseUrl).toBe("https://odoo.local");
    expect(config.user).toBe("svc_spi");
    expect(config.database).toBe("OdooFAM");
    expect(config.apiKey).toBe("token");
    expect(config.timeoutMs).toBe(2500);
    expect(config.allowInsecureTls).toBe(true);
    expect(config.outboxTopic).toBe("spi.odoo.events.v1");
  });

  it("uses safe timeout fallback for invalid values", () => {
    process.env.ODOO_TIMEOUT_MS = "invalid";
    expect(getOdooIntegrationConfig().timeoutMs).toBe(10000);

    process.env.ODOO_TIMEOUT_MS = "100";
    expect(getOdooIntegrationConfig().timeoutMs).toBe(1000);
  });

  it("supports password auth fallback when api key is not provided", () => {
    process.env.ODOO_INTEGRATION_ENABLED = "true";
    process.env.ODOO_URL = "https://odoo.local";
    process.env.ODOO_USER = "svc_spi";
    process.env.ODOO_DB = "OdooFAM";
    process.env.ODOO_PASSWORD = "secret-pass";

    const config = getOdooIntegrationConfig();

    expect(config.apiKey).toBeNull();
    expect(config.password).toBe("secret-pass");
  });
});
