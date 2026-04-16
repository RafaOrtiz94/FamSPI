jest.mock("../../../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock("../../../config/odooIntegration", () => ({
  isOdooIntegrationEnabled: jest.fn(),
}));

const db = require("../../../config/db");
const { isOdooIntegrationEnabled } = require("../../../config/odooIntegration");
const { processPendingOutboxBatch } = require("../integrationOutboxWorker.service");

describe("integrationOutboxWorker.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("con flag OFF marca eventos pendientes como skipped", async () => {
    isOdooIntegrationEnabled.mockReturnValue(false);
    db.query.mockResolvedValueOnce({ rowCount: 2 });

    const summary = await processPendingOutboxBatch({ limit: 10 });

    expect(summary).toMatchObject({
      enabled: false,
      scanned: 2,
      skipped: 2,
      sent: 0,
      failed: 0,
      dead: 0,
    });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it("procesa batch con flag ON y reparte sent/failed", async () => {
    isOdooIntegrationEnabled.mockReturnValue(true);
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            event_type: "delivery_request.created",
            payload: {},
            correlation_id: "corr-1",
            attempt_count: 1,
          },
          {
            id: 2,
            event_type: "delivery_request.created",
            payload: { simulate_failure: true },
            correlation_id: "corr-2",
            attempt_count: 1,
          },
        ],
      }) // claim pending
      .mockResolvedValueOnce({ rowCount: 1 }) // mark sent
      .mockResolvedValueOnce({ rowCount: 1 }); // mark failed

    const summary = await processPendingOutboxBatch({
      limit: 10,
      maxAttempts: 3,
    });

    expect(summary).toMatchObject({
      enabled: true,
      scanned: 2,
      sent: 1,
      failed: 1,
      dead: 0,
      skipped: 0,
    });
    expect(summary.processed_ids).toEqual([1, 2]);
  });

  it("envia a dead cuando supera max_attempts", async () => {
    isOdooIntegrationEnabled.mockReturnValue(true);
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 9,
            event_type: "delivery_request.confirmed",
            payload: { simulate_failure: true },
            correlation_id: "corr-9",
            attempt_count: 3,
          },
        ],
      }) // claim pending
      .mockResolvedValueOnce({ rowCount: 1 }); // mark dead

    const summary = await processPendingOutboxBatch({
      limit: 5,
      maxAttempts: 3,
    });

    expect(summary).toMatchObject({
      enabled: true,
      scanned: 1,
      sent: 0,
      failed: 0,
      dead: 1,
      skipped: 0,
    });
    expect(summary.processed_ids).toEqual([9]);
  });
});

