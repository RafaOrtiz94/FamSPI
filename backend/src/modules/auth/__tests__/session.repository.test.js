// Verificacion del repositorio de sesiones (control de acceso/trazabilidad):
// alta de sesion, rotacion de refresh token y cierre de sesiones.

jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const db = require("../../../config/db");
const {
  createSession,
  updateSessionRefreshToken,
  closeSessionsByEmail,
  closeSessionByRefreshToken,
} = require("../session.repository");

beforeEach(() => jest.clearAllMocks());

describe("createSession", () => {
  it("inserta la sesion con los parametros correctos y devuelve el registro", async () => {
    db.query.mockResolvedValue({ rows: [{ id: 7, user_email: "a@fam.com", login_time: "2026-07-08T10:00:00Z" }] });
    const session = await createSession({ email: "a@fam.com", ip: "1.2.3.4", userAgent: "UA", refreshToken: "tok-123" });
    expect(session.id).toBe(7);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO user_sessions/);
    expect(params).toEqual(["a@fam.com", "1.2.3.4", "UA", "tok-123"]);
  });
});

describe("updateSessionRefreshToken", () => {
  it("rota el refresh token de la sesion activa y devuelve filas afectadas", async () => {
    db.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 7 }] });
    const affected = await updateSessionRefreshToken({ email: "a@fam.com", previousToken: "old", newToken: "new" });
    expect(affected).toBe(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE user_sessions/);
    expect(params).toEqual(["new", "a@fam.com", "old"]);
  });
});

describe("closeSessionsByEmail", () => {
  it("cierra todas las sesiones activas del usuario", async () => {
    db.query.mockResolvedValue({ rowCount: 3 });
    const affected = await closeSessionsByEmail("a@fam.com");
    expect(affected).toBe(3);
    expect(db.query.mock.calls[0][1]).toEqual(["a@fam.com"]);
  });
});

describe("closeSessionByRefreshToken", () => {
  it("no consulta la base si no hay token", async () => {
    const affected = await closeSessionByRefreshToken(null);
    expect(affected).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("cierra la sesion asociada al refresh token", async () => {
    db.query.mockResolvedValue({ rowCount: 1 });
    const affected = await closeSessionByRefreshToken("tok-123");
    expect(affected).toBe(1);
    expect(db.query.mock.calls[0][1]).toEqual(["tok-123"]);
  });
});
