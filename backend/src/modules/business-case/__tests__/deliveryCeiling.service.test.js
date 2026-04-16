jest.mock("../../../config/db", () => ({
  getClient: jest.fn(),
}));

jest.mock("../../../config/logger", () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const db = require("../../../config/db");
const service = require("../deliveryCeiling.service");

const buildClient = () => ({
  query: jest.fn(),
  release: jest.fn(),
});

describe("deliveryCeiling.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("crea draft y agrega linea en estado draft", async () => {
    const client = buildClient();
    db.getClient.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN createDraft
      .mockResolvedValueOnce({ rows: [{ id: "bc-1" }] }) // ensure BC exists
      .mockResolvedValueOnce({
        rows: [
          {
            id: 101,
            business_case_id: "bc-1",
            purchase_type: "private",
            status: "draft",
            valid_from: "2026-04-11",
            valid_to: null,
            notes: "draft inicial",
            created_by: 9,
            updated_by: 9,
            created_at: "2026-04-11T00:00:00.000Z",
            updated_at: "2026-04-11T00:00:00.000Z",
          },
        ],
      }) // insert draft
      .mockResolvedValueOnce({ rows: [] }) // audit create_draft
      .mockResolvedValueOnce({ rows: [] }) // COMMIT createDraft
      .mockResolvedValueOnce({ rows: [] }) // BEGIN addLine
      .mockResolvedValueOnce({
        rows: [
          {
            id: 101,
            business_case_id: "bc-1",
            status: "draft",
          },
        ],
      }) // ceiling FOR UPDATE
      .mockResolvedValueOnce({
        rows: [
          {
            id: 501,
            delivery_ceiling_id: 101,
            max_quantity: "12.500",
            unit: "kit",
            item_type: "equipment",
            equipment_model_id: 11,
            integration_product_map_id: null,
            odoo_product_id: 9001,
            notes: "linea principal",
            created_at: "2026-04-11T00:00:00.000Z",
            updated_at: "2026-04-11T00:00:00.000Z",
          },
        ],
      }) // insert line
      .mockResolvedValueOnce({ rows: [] }) // audit add_line
      .mockResolvedValueOnce({ rows: [] }); // COMMIT addLine

    const createdDraft = await service.createDraft({
      businessCaseId: "bc-1",
      purchaseType: "private",
      validFrom: "2026-04-11",
      actorUser: { id: 9 },
      notes: "draft inicial",
    });

    expect(createdDraft).toMatchObject({
      id: 101,
      business_case_id: "bc-1",
      status: "draft",
      purchase_type: "private",
    });

    const createdLine = await service.addLine({
      deliveryCeilingId: 101,
      maxQuantity: 12.5,
      unit: "kit",
      itemType: "equipment",
      equipmentModelId: 11,
      odooProductId: 9001,
      actorUser: { id: 9 },
      notes: "linea principal",
    });

    expect(createdLine).toMatchObject({
      id: 501,
      delivery_ceiling_id: 101,
      item_type: "equipment",
      max_quantity: 12.5,
      equipment_model_id: 11,
      odoo_product_id: 9001,
    });
    const executedStatements = client.query.mock.calls.map(([sql]) => String(sql));
    expect(
      executedStatements.some((statement) => statement.includes("INSERT INTO public.delivery_ceiling_audit")),
    ).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(2);
  });

  it("permite transiciones draft -> approved y approved -> active", async () => {
    const client = buildClient();
    db.getClient.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN #1
      .mockResolvedValueOnce({
        rows: [{ id: 33, business_case_id: "bc-33", status: "draft" }],
      }) // SELECT FOR UPDATE #1
      .mockResolvedValueOnce({
        rows: [
          {
            id: 33,
            business_case_id: "bc-33",
            purchase_type: "public",
            status: "approved",
            valid_from: "2026-04-11",
            valid_to: null,
            notes: null,
            created_by: null,
            updated_by: 7,
            created_at: "2026-04-11T00:00:00.000Z",
            updated_at: "2026-04-11T01:00:00.000Z",
          },
        ],
      }) // UPDATE #1
      .mockResolvedValueOnce({ rows: [] }) // INSERT audit #1
      .mockResolvedValueOnce({ rows: [] }) // COMMIT #1
      .mockResolvedValueOnce({ rows: [] }) // BEGIN #2
      .mockResolvedValueOnce({
        rows: [{ id: 33, business_case_id: "bc-33", status: "approved" }],
      }) // SELECT FOR UPDATE #2
      .mockResolvedValueOnce({
        rows: [
          {
            id: 33,
            business_case_id: "bc-33",
            purchase_type: "public",
            status: "active",
            valid_from: "2026-04-11",
            valid_to: null,
            notes: null,
            created_by: null,
            updated_by: 7,
            created_at: "2026-04-11T00:00:00.000Z",
            updated_at: "2026-04-11T02:00:00.000Z",
          },
        ],
      }) // UPDATE #2
      .mockResolvedValueOnce({ rows: [] }) // INSERT audit #2
      .mockResolvedValueOnce({ rows: [] }); // COMMIT #2

    const approved = await service.transitionStatus({
      deliveryCeilingId: 33,
      toStatus: "approved",
      actorUser: { id: 7 },
      reason: "aprobacion de backoffice",
    });
    expect(approved.status).toBe("approved");

    const active = await service.transitionStatus({
      deliveryCeilingId: 33,
      toStatus: "active",
      actorUser: { id: 7 },
      reason: "activacion operativa",
    });
    expect(active.status).toBe("active");

    const executedStatements = client.query.mock.calls.map(([sql]) => String(sql));
    const transitionAuditInserts = executedStatements.filter((statement) =>
      statement.includes("INSERT INTO public.delivery_ceiling_audit"),
    );
    expect(transitionAuditInserts.length).toBe(2);
  });

  it("rechaza transicion invalida active -> draft", async () => {
    const client = buildClient();
    db.getClient.mockResolvedValue(client);

    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 44, business_case_id: "bc-44", status: "active" }],
      }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      service.transitionStatus({
        deliveryCeilingId: 44,
        toStatus: "draft",
        actorUser: { id: 12 },
        reason: "rollback manual no permitido",
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "DELIVERY_CEILING_INVALID_TRANSITION",
    });

    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
