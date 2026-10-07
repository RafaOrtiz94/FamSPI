jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const db = require("../../../config/db");
const service = require("../attendanceLocationPings.service");

const TYPES = ["operacion_campo"];
const NOW = 1_800_000_000_000;
const activeRows = (rows) => db.query.mockImplementation(async (sql) => (
  String(sql).includes("FROM attendance_exceptions") ? { rows } : { rows: [] }
));
const inserts = () => db.query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO attendance_location_pings"));
const lookups = () => db.query.mock.calls.filter(([sql]) => String(sql).includes("FROM attendance_exceptions"));

describe("attendanceLocationPings.recordPing", () => {
  beforeEach(() => { jest.clearAllMocks(); service.__resetForTests(); });

  test("sin salida operacional activa no guarda nada, y los pings siguientes no tocan la base", async () => {
    activeRows([]);
    const first = await service.recordPing({ userId: 7, location: "-1.2,-78.6", operationalTypes: TYPES, now: NOW });
    expect(first).toEqual({ tracking: false, stored: false, reason: "no_active_exit" });
    expect(lookups()).toHaveLength(1);

    for (let i = 1; i <= 20; i += 1) {
      await service.recordPing({ userId: i, location: "-1.2,-78.6", operationalTypes: TYPES, now: NOW + i * 1000 });
    }
    expect(db.query).toHaveBeenCalledTimes(1); // solo la carga inicial de la lista
    expect(inserts()).toHaveLength(0);
  });

  test("con salida activa guarda el punto ligado a esa salida", async () => {
    activeRows([{ user_id: 7, id: 588 }]);
    const result = await service.recordPing({
      userId: 7, location: { lat: "-1.2325", lng: "-78.6396" }, accuracy: "12.5", operationalTypes: TYPES, now: NOW,
    });
    expect(result).toEqual({ tracking: true, stored: true });
    expect(inserts()[0][1]).toEqual([7, 588, -1.2325, -78.6396, 12.5]);
  });

  test("no guarda dos puntos de la misma persona dentro del intervalo minimo", async () => {
    activeRows([{ user_id: 7, id: 588 }]);
    await service.recordPing({ userId: 7, location: "-1.2,-78.6", operationalTypes: TYPES, now: NOW });
    const soon = await service.recordPing({ userId: 7, location: "-1.3,-78.7", operationalTypes: TYPES, now: NOW + 60_000 });
    expect(soon).toEqual({ tracking: true, stored: false, reason: "too_soon" });
    const later = await service.recordPing({
      userId: 7, location: "-1.3,-78.7", operationalTypes: TYPES, now: NOW + service.MIN_STORE_INTERVAL_MS + 1,
    });
    expect(later.stored).toBe(true);
    expect(inserts()).toHaveLength(2);
  });

  test("la lista de salidas activas se renueva al vencer: una salida nueva empieza a registrarse", async () => {
    activeRows([]);
    await service.recordPing({ userId: 7, location: "-1.2,-78.6", operationalTypes: TYPES, now: Date.now() });
    activeRows([{ user_id: 7, id: 600 }]);
    const stillCached = await service.recordPing({ userId: 7, location: "-1.2,-78.6", operationalTypes: TYPES, now: Date.now() + 30_000 });
    expect(stillCached.tracking).toBe(false);
    const refreshed = await service.recordPing({
      userId: 7, location: "-1.2,-78.6", operationalTypes: TYPES, now: Date.now() + service.ACTIVE_CACHE_TTL_MS + 1000,
    });
    expect(refreshed).toEqual({ tracking: true, stored: true });
  });

  test("ubicacion invalida se rechaza sin consultar nada", async () => {
    for (const location of ["", "abc", "95,-78", { lat: null, lng: null }, undefined]) {
      expect(await service.recordPing({ userId: 7, location, operationalTypes: TYPES, now: NOW }))
        .toEqual({ tracking: false, stored: false, reason: "invalid_location" });
    }
    expect(db.query).not.toHaveBeenCalled();
  });

  test("nunca lanza: tabla sin migrar o base caida devuelven un resultado", async () => {
    db.query.mockImplementation(async (sql) => {
      if (String(sql).includes("FROM attendance_exceptions")) return { rows: [{ user_id: 7, id: 588 }] };
      throw Object.assign(new Error("relation does not exist"), { code: "42P01" });
    });
    expect(await service.recordPing({ userId: 7, location: "-1.2,-78.6", operationalTypes: TYPES, now: NOW }))
      .toEqual({ tracking: true, stored: false, reason: "not_ready" });

    service.__resetForTests();
    db.query.mockRejectedValue(new Error("db caida"));
    expect(await service.recordPing({ userId: 7, location: "-1.2,-78.6", operationalTypes: TYPES, now: NOW }))
      .toEqual({ tracking: false, stored: false, reason: "unavailable" });
  });
});

describe("attendanceLocationPings.getLatestPings", () => {
  beforeEach(() => { jest.clearAllMocks(); service.__resetForTests(); });

  test("sin la tabla (migracion pendiente) devuelve vacio para no romper el mapa", async () => {
    db.query.mockRejectedValue(Object.assign(new Error("missing"), { code: "42P01" }));
    expect((await service.getLatestPings([588])).size).toBe(0);
    expect((await service.getLatestPings([])).size).toBe(0);
  });
});
