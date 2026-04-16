jest.mock("axios", () => ({
  post: jest.fn(),
}));

jest.mock("../../../config/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../../../utils/requestContext", () => ({
  getContext: jest.fn(() => null),
}));

const axios = require("axios");
const logger = require("../../../config/logger");
const { getContext } = require("../../../utils/requestContext");
const {
  callOdoo,
  IntegrationDisabledError,
  OdooClientError,
} = require("../odooClient");

const ORIGINAL_ENV = { ...process.env };

const resetOdooEnv = () => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.ODOO_INTEGRATION_ENABLED;
  delete process.env.ODOO_URL;
  delete process.env.ODOO_BASE_URL;
  delete process.env.ODOO_DB;
  delete process.env.ODOO_DATABASE;
  delete process.env.ODOO_USER;
  delete process.env.ODOO_USERNAME;
  delete process.env.ODOO_API_KEY;
  delete process.env.ODOO_PASSWORD;
  delete process.env.ODOO_TIMEOUT_MS;
  delete process.env.ODOO_ALLOW_INSECURE_TLS;
};

describe("modules/integrations/odooClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetOdooEnv();
    getContext.mockReturnValue(null);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("con flag OFF rechaza sin llamada de red", async () => {
    process.env.ODOO_INTEGRATION_ENABLED = "false";

    await expect(
      callOdoo({
        method: "execute_kw",
        params: { model: "sale.order" },
        correlationId: "corr-off-1",
      }),
    ).rejects.toBeInstanceOf(IntegrationDisabledError);

    expect(axios.post).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        correlation_id: "corr-off-1",
        event_type: "execute_kw",
        result: "disabled",
      }),
      expect.stringContaining("[ODOO_CLIENT]"),
    );
  });

  it("propaga correlationId en request y loguea error con credenciales falsas", async () => {
    process.env.ODOO_INTEGRATION_ENABLED = "true";
    process.env.ODOO_URL = "https://odoo.local";
    process.env.ODOO_DB = "OdooFAM";
    process.env.ODOO_USER = "svc_spi";
    process.env.ODOO_API_KEY = "fake-api-key";
    process.env.ODOO_TIMEOUT_MS = "2500";

    axios.post.mockResolvedValueOnce({
      status: 401,
      data: {
        error: {
          code: 100,
          message: "Access denied",
          data: {
            name: "odoo.exceptions.AccessError",
          },
        },
      },
    });

    await expect(
      callOdoo({
        method: "execute_kw",
        params: { model: "sale.order", fn: "create" },
        correlationId: "corr-fake-401",
        eventType: "delivery_request.confirmed",
      }),
    ).rejects.toBeInstanceOf(OdooClientError);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      "https://odoo.local/jsonrpc",
      expect.objectContaining({
        id: "corr-fake-401",
        params: expect.objectContaining({
          kwargs: {
            context: expect.objectContaining({
              correlation_id: "corr-fake-401",
              event_type: "delivery_request.confirmed",
            }),
          },
        }),
      }),
      expect.objectContaining({
        timeout: 2500,
        headers: expect.objectContaining({
          "x-correlation-id": "corr-fake-401",
          "x-event-type": "delivery_request.confirmed",
        }),
      }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        correlation_id: "corr-fake-401",
        event_type: "delivery_request.confirmed",
        result: "error",
        http_status: 401,
      }),
      expect.stringContaining("[ODOO_CLIENT]"),
    );
  });

  it("usa correlationId del requestContext cuando no se pasa explicitamente", async () => {
    process.env.ODOO_INTEGRATION_ENABLED = "true";
    process.env.ODOO_URL = "https://odoo.local";
    process.env.ODOO_DB = "OdooFAM";
    process.env.ODOO_USER = "svc_spi";
    process.env.ODOO_PASSWORD = "fake-password";
    getContext.mockReturnValue({ correlationId: "ctx-corr-001" });

    axios.post.mockResolvedValueOnce({
      status: 200,
      data: {
        result: { ok: true },
      },
    });

    const result = await callOdoo({
      method: "execute_kw",
      params: { model: "res.partner", fn: "search_read" },
    });

    expect(result).toEqual({ ok: true });
    expect(axios.post).toHaveBeenCalledWith(
      "https://odoo.local/jsonrpc",
      expect.objectContaining({
        id: "ctx-corr-001",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-correlation-id": "ctx-corr-001",
        }),
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        correlation_id: "ctx-corr-001",
        result: "success",
      }),
      expect.stringContaining("[ODOO_CLIENT]"),
    );
  });
});

