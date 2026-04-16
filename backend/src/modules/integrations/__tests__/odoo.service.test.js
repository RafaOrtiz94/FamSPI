const {
  getOdooIntegrationHealth,
  buildOdooOutboxEnvelope,
} = require("../odoo.service");

const ORIGINAL_ENV = { ...process.env };

const resetOdooEnv = () => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.ODOO_INTEGRATION_ENABLED;
  delete process.env.ODOO_URL;
  delete process.env.ODOO_BASE_URL;
  delete process.env.ODOO_DB;
  delete process.env.ODOO_USER;
  delete process.env.ODOO_PASSWORD;
  delete process.env.ODOO_API_KEY;
};

describe("modules/integrations/odoo.service", () => {
  beforeEach(() => {
    resetOdooEnv();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("reports disabled status and skips envelope creation when flag is off", () => {
    const health = getOdooIntegrationHealth();
    const envelope = buildOdooOutboxEnvelope({
      eventType: "delivery_request.approved",
      payload: { id: 1 },
      correlationId: "corr-1",
      idempotencyKey: "idr-1",
    });

    expect(health.enabled).toBe(false);
    expect(health.status).toBe("disabled");
    expect(envelope).toEqual({
      skipped: true,
      reason: "odoo_integration_disabled",
    });
  });

  it("returns degraded status when mandatory config is missing and flag is on", () => {
    process.env.ODOO_INTEGRATION_ENABLED = "true";

    const health = getOdooIntegrationHealth();

    expect(health.enabled).toBe(true);
    expect(health.status).toBe("degraded_config");
    expect(health.missing_config).toContain("ODOO_URL");
    expect(health.missing_config).toContain("ODOO_DB");
    expect(health.missing_config).toContain("ODOO_USER");
    expect(health.missing_config).toContain("ODOO_API_KEY_OR_PASSWORD");
  });
});
