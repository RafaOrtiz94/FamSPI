jest.mock("../../../config/db", () => ({
  getClient: jest.fn(),
}));

jest.mock("../../../config/logger", () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const db = require("../../../config/db");
const service = require("../deliveryRequests.service");

const buildClient = () => ({
  query: jest.fn(),
  release: jest.fn(),
});

describe("deliveryRequests.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza creacion cuando el ceiling no esta activo", async () => {
    const client = buildClient();
    db.getClient.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 11, status: "draft", purchase_type: "private" }],
      }) // ceiling FOR UPDATE
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      service.createDeliveryRequest({
        ceilingId: 11,
        lines: [{ ceilingLineId: 101, requestedQty: 1 }],
        actorUser: { id: 9 },
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "CEILING_NOT_ACTIVE",
    });
  });

  it("devuelve MAX_EXCEEDED cuando requestedQty excede remaining", async () => {
    const client = buildClient();
    db.getClient.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 20, status: "active", purchase_type: "private" }] }) // ceiling FOR UPDATE
      .mockResolvedValueOnce({
        rows: [
          {
            id: 401,
            delivery_ceiling_id: 20,
            max_quantity: "10.000",
            delivered_qty: "3.000",
          },
        ],
      }) // line FOR UPDATE
      .mockResolvedValueOnce({
        rows: [{ delivery_ceiling_line_id: 401, reserved_qty: "2.000" }],
      }) // open reservations
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      service.createDeliveryRequest({
        ceilingId: 20,
        lines: [{ ceilingLineId: 401, requestedQty: 6 }],
        actorUser: { id: 7 },
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "MAX_EXCEEDED",
    });
  });

  it("rechaza segundo request cuando delivered_qty ya consumio el nuevo saldo", async () => {
    const client = buildClient();
    db.getClient.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 22, status: "active", purchase_type: "private" }] }) // ceiling FOR UPDATE
      .mockResolvedValueOnce({
        rows: [
          {
            id: 402,
            delivery_ceiling_id: 22,
            max_quantity: "10.000",
            delivered_qty: "7.000",
          },
        ],
      }) // line FOR UPDATE
      .mockResolvedValueOnce({ rows: [] }) // open reservations
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      service.createDeliveryRequest({
        ceilingId: 22,
        lines: [{ ceilingLineId: 402, requestedQty: 4 }],
        actorUser: { id: 15 },
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "MAX_EXCEEDED",
    });
  });

  it("compra publica sin plan aprobado devuelve PUBLIC_PLAN_NOT_APPROVED", async () => {
    const client = buildClient();
    db.getClient.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 30, status: "active", purchase_type: "public" }] }) // ceiling
      .mockResolvedValueOnce({
        rows: [
          {
            id: 410,
            delivery_ceiling_id: 30,
            max_quantity: "10.000",
            delivered_qty: "1.000",
          },
        ],
      }) // ceiling lines
      .mockResolvedValueOnce({ rows: [] }) // open reservations
      .mockResolvedValueOnce({ rows: [] }) // approved plan lookup
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      service.createDeliveryRequest({
        ceilingId: 30,
        asOfDate: "2026-04-12",
        lines: [{ ceilingLineId: 410, requestedQty: 2 }],
        actorUser: { id: 8 },
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "PUBLIC_PLAN_NOT_APPROVED",
    });
  });

  it("compra publica con plan en draft devuelve PUBLIC_PLAN_NOT_APPROVED", async () => {
    const client = buildClient();
    db.getClient.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 301, status: "active", purchase_type: "public" }] }) // ceiling
      .mockResolvedValueOnce({
        rows: [
          {
            id: 481,
            delivery_ceiling_id: 301,
            max_quantity: "10.000",
            delivered_qty: "2.000",
          },
        ],
      }) // ceiling lines
      .mockResolvedValueOnce({ rows: [] }) // open reservations
      .mockResolvedValueOnce({ rows: [] }) // approved plan lookup (draft ignored)
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      service.createDeliveryRequest({
        ceilingId: 301,
        asOfDate: "2026-04-12",
        lines: [{ ceilingLineId: 481, requestedQty: 2 }],
        actorUser: { id: 8 },
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "PUBLIC_PLAN_NOT_APPROVED",
    });
  });

  it("compra publica valida contra tramo vigente y permite crear request", async () => {
    const client = buildClient();
    db.getClient.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 31, status: "active", purchase_type: "public" }] }) // ceiling
      .mockResolvedValueOnce({
        rows: [
          {
            id: 411,
            delivery_ceiling_id: 31,
            max_quantity: "10.000",
            delivered_qty: "2.000",
          },
        ],
      }) // ceiling lines
      .mockResolvedValueOnce({
        rows: [{ delivery_ceiling_line_id: 411, reserved_qty: "1.000" }],
      }) // open reservations
      .mockResolvedValueOnce({
        rows: [{ id: 900, status: "approved" }],
      }) // approved plan
      .mockResolvedValueOnce({
        rows: [{ delivery_ceiling_line_id: 411, tranche_qty: "4.000" }],
      }) // tranche by date
      .mockResolvedValueOnce({
        rows: [
          {
            id: 88,
            delivery_ceiling_id: 31,
            status: "pending",
            requested_by: 6,
            confirmed_by: null,
            notes: null,
            requested_at: "2026-04-11T00:00:00.000Z",
            confirmed_at: null,
            created_at: "2026-04-11T00:00:00.000Z",
            updated_at: "2026-04-11T00:00:00.000Z",
          },
        ],
      }) // insert request
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1001,
            delivery_request_id: 88,
            delivery_ceiling_line_id: 411,
            requested_qty: "3.000",
            created_at: "2026-04-11T00:00:00.000Z",
            updated_at: "2026-04-11T00:00:00.000Z",
          },
        ],
      }) // insert line
      .mockResolvedValueOnce({
        rows: [{ id: 7001, created_at: "2026-04-11T00:00:00.000Z" }],
      }) // enqueue outbox created
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await service.createDeliveryRequest({
      ceilingId: 31,
      asOfDate: "2026-04-12",
      lines: [{ ceilingLineId: 411, requestedQty: 3 }],
      actorUser: { id: 6 },
    });

    expect(result.request).toMatchObject({
      id: 88,
      delivery_ceiling_id: 31,
      status: "pending",
    });
    expect(result.public_plan_context).toEqual({ public_delivery_plan_id: 900 });
    expect(result.balance_snapshot[0]).toMatchObject({
      ceiling_line_id: 411,
      requested_qty: 3,
      tranche_max_qty: 4,
      effective_limit: 4,
    });
  });

  it("compra publica con cantidad mayor al tramo falla con TRANCHE_MAX_EXCEEDED", async () => {
    const client = buildClient();
    db.getClient.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 32, status: "active", purchase_type: "public" }] }) // ceiling
      .mockResolvedValueOnce({
        rows: [
          {
            id: 412,
            delivery_ceiling_id: 32,
            max_quantity: "20.000",
            delivered_qty: "2.000",
          },
        ],
      }) // ceiling lines
      .mockResolvedValueOnce({ rows: [] }) // open reservations
      .mockResolvedValueOnce({
        rows: [{ id: 901, status: "approved" }],
      }) // approved plan
      .mockResolvedValueOnce({
        rows: [{ delivery_ceiling_line_id: 412, tranche_qty: "3.000" }],
      }) // tranche by date
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      service.createDeliveryRequest({
        ceilingId: 32,
        asOfDate: "2026-04-12",
        lines: [{ ceilingLineId: 412, requestedQty: 4 }],
        actorUser: { id: 3 },
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "TRANCHE_MAX_EXCEEDED",
    });
  });

  it("compra publica sin tramo vigente devuelve OUTSIDE_DELIVERY_WINDOW", async () => {
    const client = buildClient();
    db.getClient.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 33, status: "active", purchase_type: "public" }] }) // ceiling
      .mockResolvedValueOnce({
        rows: [
          {
            id: 413,
            delivery_ceiling_id: 33,
            max_quantity: "10.000",
            delivered_qty: "1.000",
          },
        ],
      }) // ceiling lines
      .mockResolvedValueOnce({ rows: [] }) // open reservations
      .mockResolvedValueOnce({
        rows: [{ id: 902, status: "approved" }],
      }) // approved plan
      .mockResolvedValueOnce({ rows: [] }) // tranche by date
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      service.createDeliveryRequest({
        ceilingId: 33,
        asOfDate: "2026-04-12",
        lines: [{ ceilingLineId: 413, requestedQty: 2 }],
        actorUser: { id: 4 },
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "OUTSIDE_DELIVERY_WINDOW",
    });
  });

  it("confirma entrega y aumenta delivered_qty en delivery_ceiling_line", async () => {
    const client = buildClient();
    db.getClient.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          {
            id: 77,
            delivery_ceiling_id: 31,
            status: "pending",
            requested_by: 5,
            confirmed_by: null,
            notes: "pedido parcial",
            requested_at: "2026-04-11T00:00:00.000Z",
            confirmed_at: null,
            created_at: "2026-04-11T00:00:00.000Z",
            updated_at: "2026-04-11T00:00:00.000Z",
          },
        ],
      }) // request FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 31, status: "active", purchase_type: "private" }] }) // ceiling FOR UPDATE
      .mockResolvedValueOnce({
        rows: [
          {
            id: 701,
            delivery_request_id: 77,
            delivery_ceiling_line_id: 501,
            requested_qty: "4.000",
            created_at: "2026-04-11T00:00:00.000Z",
            updated_at: "2026-04-11T00:00:00.000Z",
            max_quantity: "10.000",
            delivered_qty: "3.000",
          },
        ],
      }) // request lines + ceiling lines FOR UPDATE
      .mockResolvedValueOnce({ rows: [] }) // open reservations excluding current request
      .mockResolvedValueOnce({
        rows: [{ id: 501, delivered_qty: "7.000", max_quantity: "10.000" }],
      }) // UPDATE delivery_ceiling_line
      .mockResolvedValueOnce({
        rows: [
          {
            id: 77,
            delivery_ceiling_id: 31,
            status: "confirmed",
            requested_by: 5,
            confirmed_by: 12,
            notes: "pedido parcial",
            requested_at: "2026-04-11T00:00:00.000Z",
            confirmed_at: "2026-04-11T02:00:00.000Z",
            created_at: "2026-04-11T00:00:00.000Z",
            updated_at: "2026-04-11T02:00:00.000Z",
          },
        ],
      }) // UPDATE request
      .mockResolvedValueOnce({
        rows: [{ id: 7002, created_at: "2026-04-11T02:00:00.000Z" }],
      }) // enqueue outbox confirmed
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await service.confirmDeliveryRequest({
      requestId: 77,
      actorUser: { id: 12 },
    });

    expect(result.request.status).toBe("confirmed");
    expect(result.applied_lines).toEqual([
      expect.objectContaining({
        delivery_ceiling_line_id: 501,
        requested_qty: 4,
        delivered_qty_after: 7,
        remaining_after: 3,
      }),
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
