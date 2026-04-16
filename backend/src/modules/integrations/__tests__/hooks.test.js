jest.mock("../../../config/logger", () => ({
  warn: jest.fn(),
}));

jest.mock("../../../config/odooIntegration", () => ({
  isOdooIntegrationEnabled: jest.fn(),
}));

jest.mock("../integrationOutbox.service", () => ({
  enqueueIntegrationEvent: jest.fn(),
}));

const { isOdooIntegrationEnabled } = require("../../../config/odooIntegration");
const { enqueueIntegrationEvent } = require("../integrationOutbox.service");
const { enqueuePurchaseStatusChangedEvent } = require("../hooks");

describe("integrations/hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("no encola cuando el flag esta OFF", async () => {
    isOdooIntegrationEnabled.mockReturnValue(false);

    const result = enqueuePurchaseStatusChangedEvent({
      purchaseType: "private_purchase",
      id: "123",
      status: "approved",
      businessCaseId: 9,
    });

    expect(result).toMatchObject({
      enqueued: false,
      skipped: true,
      reason: "integration_disabled",
    });
    expect(enqueueIntegrationEvent).not.toHaveBeenCalled();
  });

  it("encola en background con idempotency key estable cuando flag ON", async () => {
    isOdooIntegrationEnabled.mockReturnValue(true);
    enqueueIntegrationEvent.mockResolvedValue({ inserted: true });

    const result = enqueuePurchaseStatusChangedEvent({
      purchaseType: "equipment_purchase",
      id: 42,
      status: "dispatch_ready",
      businessCaseId: 7,
      correlationId: "corr-42",
    });

    await new Promise((resolve) => setImmediate(resolve));

    expect(result).toMatchObject({
      enqueued: true,
      event_type: "equipment_purchase.status_changed",
      idempotency_key: "equipment_purchase:42:status:dispatch_ready",
    });

    expect(enqueueIntegrationEvent).toHaveBeenCalledTimes(1);
    expect(enqueueIntegrationEvent).toHaveBeenCalledWith({
      eventType: "equipment_purchase.status_changed",
      payload: {
        id: 42,
        status: "dispatch_ready",
        business_case_id: 7,
      },
      idempotencyKey: "equipment_purchase:42:status:dispatch_ready",
      correlationId: "corr-42",
    });
  });
});
