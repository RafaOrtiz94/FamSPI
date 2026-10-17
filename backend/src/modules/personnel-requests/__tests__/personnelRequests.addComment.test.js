// Verificacion de la regla de comentarios internos/publicos en solicitudes
// de personal (control de acceso a comentarios sensibles de RRHH).

jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("../../../utils/audit", () => ({ logAction: jest.fn() }));
jest.mock("../../../services/gmail.service", () => ({ sendEmail: jest.fn() }));

const db = require("../../../config/db");
const { addComment } = require("../personnel-requests.service");

beforeEach(() => {
  jest.clearAllMocks();
  // ensurePersonnelProfileTables + INSERT resuelven con exito por defecto.
  db.query.mockResolvedValue({ rows: [{ id: 1, comment: "ok", is_internal: false }] });
});

describe("personnel-requests – addComment", () => {
  it("rechaza un comentario vacio", async () => {
    await expect(addComment(1, 9, "   ", false, "gerencia")).rejects.toThrow(/no puede estar vacio/);
  });

  it("marca is_internal=false para un rol sin permiso, aunque se solicite interno", async () => {
    await addComment(1, 9, "comentario", true, "tecnico");
    const insertCall = db.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO personnel_request_comments"));
    expect(insertCall[1][3]).toBe(false);
  });

  it("permite is_internal=true para un rol autorizado (talento_humano)", async () => {
    await addComment(1, 9, "comentario interno", true, "talento_humano");
    const insertCall = db.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO personnel_request_comments"));
    expect(insertCall[1][3]).toBe(true);
  });
});
