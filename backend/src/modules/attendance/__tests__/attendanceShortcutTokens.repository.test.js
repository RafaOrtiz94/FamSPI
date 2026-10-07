jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const db = require("../../../config/db");
const repository = require("../attendanceShortcutTokens.repository");

describe("isTokenRevoked: memoria de revocacion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.__resetRevocationCacheForTests();
    jest.useRealTimers();
  });

  test("un token vigente se consulta una sola vez dentro de la ventana, no en cada llamada", async () => {
    db.query.mockResolvedValue({ rows: [{ revoked_at: null }] });
    for (let i = 0; i < 25; i += 1) expect(await repository.isTokenRevoked("jti-1")).toBe(false);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test("al vencer la ventana vuelve a consultar y detecta una revocacion hecha en otra instancia", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-07T12:00:00Z"));
    db.query.mockResolvedValueOnce({ rows: [{ revoked_at: null }] });
    expect(await repository.isTokenRevoked("jti-1")).toBe(false);

    db.query.mockResolvedValueOnce({ rows: [{ revoked_at: "2026-10-07T12:01:00Z" }] });
    jest.setSystemTime(Date.now() + repository.REVOCATION_CACHE_TTL_MS + 1);
    expect(await repository.isTokenRevoked("jti-1")).toBe(true);
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  test("revocar un token lo bloquea de inmediato en esta instancia, sin esperar la ventana", async () => {
    db.query.mockResolvedValueOnce({ rows: [{ revoked_at: null }] });
    expect(await repository.isTokenRevoked("jti-1")).toBe(false);

    db.query.mockResolvedValueOnce({ rows: [{ id: 9, user_id: 3, jti: "jti-1" }] });
    await repository.revokeTokenById({ id: 9, revokedBy: 1 });
    expect(await repository.isTokenRevoked("jti-1")).toBe(true);
    expect(db.query).toHaveBeenCalledTimes(2); // la consulta inicial y el UPDATE; ninguna mas
  });

  test("un token revocado se recuerda como revocado y uno sin jti nunca consulta", async () => {
    db.query.mockResolvedValue({ rows: [{ revoked_at: "2026-10-01T00:00:00Z" }] });
    expect(await repository.isTokenRevoked("jti-2")).toBe(true);
    expect(await repository.isTokenRevoked("jti-2")).toBe(true);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(await repository.isTokenRevoked(null)).toBe(false);
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
