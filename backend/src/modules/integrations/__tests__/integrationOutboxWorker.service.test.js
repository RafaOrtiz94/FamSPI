jest.mock("../../../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../../../config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock("../crm.service", () => ({
  isCrmSyncEnabled: jest.fn(),
  sendClientApproved: jest.fn(),
}));

const db = require("../../../config/db");
const crmService = require("../crm.service");
const { processPendingOutboxBatch } = require("../integrationOutboxWorker.service");

describe("integrationOutboxWorker.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("marca como skipped un evento no-CRM (Odoo ya no existe, no hay provider)", async () => {
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
        ],
      }) // claim pending
      .mockResolvedValueOnce({ rowCount: 1 }); // mark skipped

    const summary = await processPendingOutboxBatch({ limit: 10 });

    expect(summary).toMatchObject({
      scanned: 1,
      sent: 0,
      failed: 0,
      dead: 0,
      skipped: 1,
    });
    expect(crmService.sendClientApproved).not.toHaveBeenCalled();
  });

  it("procesa batch CRM y reparte sent/failed", async () => {
    crmService.isCrmSyncEnabled.mockReturnValue(true);
    crmService.sendClientApproved
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("CRM transport error"));
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            event_type: "crm.client.approved",
            payload: {},
            correlation_id: "corr-1",
            attempt_count: 1,
          },
          {
            id: 2,
            event_type: "crm.client.approved",
            payload: {},
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
      eventTypeFilter: "crm.%",
    });

    expect(summary).toMatchObject({
      scanned: 2,
      sent: 1,
      failed: 1,
      dead: 0,
      skipped: 0,
    });
    expect(summary.processed_ids).toEqual([1, 2]);
  });

  it("envia a dead cuando supera max_attempts", async () => {
    crmService.isCrmSyncEnabled.mockReturnValue(true);
    crmService.sendClientApproved.mockRejectedValueOnce(new Error("CRM transport error"));
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 9,
            event_type: "crm.client.approved",
            payload: {},
            correlation_id: "corr-9",
            attempt_count: 3,
          },
        ],
      }) // claim pending
      .mockResolvedValueOnce({ rowCount: 1 }); // mark dead

    const summary = await processPendingOutboxBatch({
      limit: 5,
      maxAttempts: 3,
      eventTypeFilter: "crm.%",
    });

    expect(summary).toMatchObject({
      scanned: 1,
      sent: 0,
      failed: 0,
      dead: 1,
      skipped: 0,
    });
    expect(summary.processed_ids).toEqual([9]);
  });
});
