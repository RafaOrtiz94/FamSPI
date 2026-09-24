jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));
jest.mock("../../ti-assets/tiAssets.service", () => ({ moveAssetCustody: jest.fn() }));

const db = require("../../../config/db");
const { moveAssetCustody } = require("../../ti-assets/tiAssets.service");
const service = require("../bcInvestmentTiAssetReservations.service");

const BC_ID = "bc-1";
const CATALOG_ID = 42;
const user = { id: 9 };

// Cliente de transaccion configurable: cada test define las respuestas por
// SQL (matcheando por un fragmento del texto) en el orden en que las espera.
function fakeClient(responses) {
  const calls = [];
  return {
    calls,
    query: jest.fn((sql, params) => {
      calls.push({ sql, params });
      const match = responses.find((r) => sql.includes(r.match));
      if (!match) throw new Error(`Query no mockeada: ${sql.slice(0, 60)}`);
      return Promise.resolve(match.result);
    }),
    release: jest.fn(),
  };
}

beforeEach(() => jest.clearAllMocks());

describe("reserveAsset", () => {
  test("reserva el activo cuando esta libre", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ quantity: 2 }] }); // selection
    const client = fakeClient([
      { match: "SELECT * FROM public.ti_assets", result: { rows: [{ id: 7, status: "available", asset_code: "TI-007" }] } },
      { match: "INSERT INTO public.bc_investment_ti_asset_reservations", result: { rows: [{ id: 100 }] } },
      { match: "UPDATE public.ti_assets", result: { rows: [] } },
      { match: "INSERT INTO public.ti_asset_events", result: { rows: [] } },
      { match: "BEGIN", result: {} },
      { match: "COMMIT", result: {} },
    ]);
    db.getClient.mockResolvedValue(client);
    db.query.mockResolvedValueOnce({ rows: [{ id: 100, status: "reserved", ti_asset_id: 7 }] }); // listReservationsForSelection

    const result = await service.reserveAsset({ businessCaseId: BC_ID, catalogId: CATALOG_ID, tiAssetId: 7, user });

    expect(result[0].ti_asset_id).toBe(7);
    const updateCall = client.calls.find((c) => c.sql.includes("UPDATE public.ti_assets"));
    expect(updateCall.params[0]).toBe(7);
  });

  // Una sola unidad de la inversion puede requerir varios activos TI (ej.
  // "Computadores x2" -> CPU + monitor + teclado + mouse por cada uno): ya no
  // hay tope de cantidad, se puede reservar mas activos que la cantidad del item.
  test("permite reservar mas activos que la cantidad del item (sin tope)", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ quantity: 1 }] });
    const client = fakeClient([
      { match: "SELECT * FROM public.ti_assets", result: { rows: [{ id: 9, status: "unassigned", asset_code: "TI-009" }] } },
      { match: "INSERT INTO public.bc_investment_ti_asset_reservations", result: { rows: [{ id: 101 }] } },
      { match: "UPDATE public.ti_assets", result: { rows: [] } },
      { match: "INSERT INTO public.ti_asset_events", result: { rows: [] } },
      { match: "BEGIN", result: {} },
      { match: "COMMIT", result: {} },
    ]);
    db.getClient.mockResolvedValue(client);
    db.query.mockResolvedValueOnce({
      rows: [{ id: 100, ti_asset_id: 7 }, { id: 101, ti_asset_id: 9 }], // ya habia 1, se agrega un segundo
    });

    const result = await service.reserveAsset({ businessCaseId: BC_ID, catalogId: CATALOG_ID, tiAssetId: 9, user });
    expect(result).toHaveLength(2);
  });

  test("rechaza si el activo no esta disponible (ya reservado/asignado/danado)", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ quantity: 5 }] });
    const client = fakeClient([
      { match: "SELECT * FROM public.ti_assets", result: { rows: [{ id: 7, status: "reserved", asset_code: "TI-007" }] } },
      { match: "BEGIN", result: {} },
      { match: "ROLLBACK", result: {} },
    ]);
    db.getClient.mockResolvedValue(client);

    await expect(
      service.reserveAsset({ businessCaseId: BC_ID, catalogId: CATALOG_ID, tiAssetId: 7, user }),
    ).rejects.toMatchObject({ code: "ASSET_NOT_AVAILABLE" });
  });

  test("rechaza si el item ni siquiera esta en la lista de inversiones seleccionadas", async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // sin seleccion
    await expect(
      service.reserveAsset({ businessCaseId: BC_ID, catalogId: CATALOG_ID, tiAssetId: 7, user }),
    ).rejects.toMatchObject({ code: "SELECTION_NOT_FOUND" });
    expect(db.getClient).not.toHaveBeenCalled();
  });
});

describe("listReservationsForBusinessCase", () => {
  test("devuelve las reservas activas de todo el BC, agrupables por catalog_id", async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 100, catalog_id: 15, ti_asset_id: 7, name: "Laptop Dell" },
        { id: 101, catalog_id: 15, ti_asset_id: 9, name: "Monitor LG" },
        { id: 102, catalog_id: 21, ti_asset_id: 12, name: "Impresora Zebra" },
      ],
    });

    const rows = await service.listReservationsForBusinessCase(BC_ID);

    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.catalog_id === 15)).toHaveLength(2);
    expect(db.query.mock.calls[0][0]).toContain("status = 'reserved'");
  });
});

describe("releaseReservation", () => {
  test("libera la reserva y deja el activo disponible de nuevo", async () => {
    const client = fakeClient([
      { match: "SELECT * FROM public.bc_investment_ti_asset_reservations", result: { rows: [{ id: 100, status: "reserved", ti_asset_id: 7, catalog_id: CATALOG_ID }] } },
      { match: "UPDATE public.bc_investment_ti_asset_reservations", result: {} },
      { match: "UPDATE public.ti_assets", result: {} },
      { match: "INSERT INTO public.ti_asset_events", result: {} },
      { match: "BEGIN", result: {} },
      { match: "COMMIT", result: {} },
    ]);
    db.getClient.mockResolvedValue(client);
    db.query.mockResolvedValueOnce({ rows: [] }); // listReservationsForSelection tras liberar

    await service.releaseReservation({ reservationId: 100, businessCaseId: BC_ID, user, reason: "manual" });

    const assetUpdate = client.calls.find((c) => c.sql.includes("UPDATE public.ti_assets"));
    expect(assetUpdate.params[0]).toBe(7);
    expect(assetUpdate.sql).toContain("'available'");
  });

  test("rechaza liberar una reserva que ya no esta activa", async () => {
    const client = fakeClient([
      { match: "SELECT * FROM public.bc_investment_ti_asset_reservations", result: { rows: [{ id: 100, status: "released" }] } },
      { match: "BEGIN", result: {} },
      { match: "ROLLBACK", result: {} },
    ]);
    db.getClient.mockResolvedValue(client);

    await expect(
      service.releaseReservation({ reservationId: 100, businessCaseId: BC_ID, user }),
    ).rejects.toMatchObject({ code: "RESERVATION_NOT_ACTIVE" });
  });
});

describe("releaseAllForBusinessCase (BC no factible)", () => {
  test("libera todas las reservas activas del BC", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 100, ti_asset_id: 7, catalog_id: CATALOG_ID }, { id: 101, ti_asset_id: 8, catalog_id: CATALOG_ID }] });
    const client = fakeClient([
      { match: "SELECT * FROM public.bc_investment_ti_asset_reservations", result: { rows: [{ id: 100, status: "reserved", ti_asset_id: 7, catalog_id: CATALOG_ID }] } },
      { match: "UPDATE public.bc_investment_ti_asset_reservations", result: {} },
      { match: "UPDATE public.ti_assets", result: {} },
      { match: "INSERT INTO public.ti_asset_events", result: {} },
      { match: "BEGIN", result: {} },
      { match: "COMMIT", result: {} },
    ]);
    db.getClient.mockResolvedValue(client);
    db.query.mockResolvedValue({ rows: [] }); // resto de queries (listReservationsForSelection x2 y selects internos)

    const count = await service.releaseAllForBusinessCase(BC_ID, { reason: "bc_not_feasible" });
    expect(count).toBe(2);
  });
});

describe("markDeliveredForBusinessCase", () => {
  test("mueve el activo a custodia de cliente y marca la reserva como entregada, cuando el BC tiene client_id", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ client_id: 55 }] }) // BC
      .mockResolvedValueOnce({ rows: [{ id: 100, ti_asset_id: 7, catalog_id: CATALOG_ID }] }) // reservas activas
      .mockResolvedValueOnce({ rows: [] }); // UPDATE final

    const count = await service.markDeliveredForBusinessCase(BC_ID, { user, reason: "private_purchase_delivered" });

    expect(moveAssetCustody).toHaveBeenCalledWith(expect.objectContaining({ assetId: 7, custody_type: "client", client_id: 55 }));
    expect(count).toBe(1);
  });

  test("si el BC no tiene client_id, no mueve custodia pero no rompe (se deja para revision manual)", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ client_id: null }] })
      .mockResolvedValueOnce({ rows: [{ id: 100, ti_asset_id: 7, catalog_id: CATALOG_ID }] })
      .mockResolvedValueOnce({ rows: [] });

    const count = await service.markDeliveredForBusinessCase(BC_ID, { user });

    expect(moveAssetCustody).not.toHaveBeenCalled();
    expect(count).toBe(1);
  });
});
