jest.mock("../../../config/db", () => ({
  query: jest.fn(),
}));

const db = require("../../../config/db");
const { enqueueIntegrationEvent } = require("../integrationOutbox.service");

describe("integrationOutbox.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("no duplica filas para la misma idempotency_key", async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 101, created_at: "2026-04-11T00:00:00.000Z" }],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    const first = await enqueueIntegrationEvent({
      eventType: "delivery_request.created",
      payload: { delivery_request_id: 1 },
      idempotencyKey: "delivery_request:1:created",
      correlationId: "corr-1",
    });

    const second = await enqueueIntegrationEvent({
      eventType: "delivery_request.created",
      payload: { delivery_request_id: 1 },
      idempotencyKey: "delivery_request:1:created",
      correlationId: "corr-1",
    });

    expect(first).toMatchObject({
      inserted: true,
      duplicate: false,
      outbox_id: 101,
      idempotency_key: "delivery_request:1:created",
      correlation_id: "corr-1",
    });
    expect(second).toMatchObject({
      inserted: false,
      duplicate: true,
      idempotency_key: "delivery_request:1:created",
      correlation_id: "corr-1",
    });
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it("usa dbClient transaccional cuando se provee", async () => {
    const txClient = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: 202, created_at: "2026-04-11T01:00:00.000Z" }],
      }),
    };

    const result = await enqueueIntegrationEvent({
      eventType: "delivery_request.confirmed",
      payload: { delivery_request_id: 77 },
      idempotencyKey: "delivery_request:77:confirmed",
      correlationId: "corr-tx-77",
      dbClient: txClient,
    });

    expect(result).toMatchObject({
      inserted: true,
      outbox_id: 202,
      idempotency_key: "delivery_request:77:confirmed",
      correlation_id: "corr-tx-77",
    });
    expect(txClient.query).toHaveBeenCalledTimes(1);
    expect(db.query).not.toHaveBeenCalled();
  });
});

