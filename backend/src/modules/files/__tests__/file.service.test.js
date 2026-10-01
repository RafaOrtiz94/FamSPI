// Verificacion del listado y eliminacion de adjuntos (control de acceso a
// documentos del expediente y trazabilidad de eliminacion).

jest.mock("../../../config/google", () => ({
  drive: { files: { get: jest.fn(), delete: jest.fn() } },
}));
jest.mock("../../../config/db", () => ({ query: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("../../../utils/audit", () => ({ logAction: jest.fn() }));

const db = require("../../../config/db");
const { drive } = require("../../../config/google");
const { logAction } = require("../../../utils/audit");
const { listByRequest, deleteFile } = require("../file.service");

beforeEach(() => jest.clearAllMocks());

describe("files – listByRequest", () => {
  it("mapea created_at a uploaded_at para cada adjunto", async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1, created_at: "2026-01-01" }] });
    const out = await listByRequest(55);
    expect(out).toEqual([{ id: 1, created_at: "2026-01-01", uploaded_at: "2026-01-01" }]);
    expect(db.query.mock.calls[0][1]).toEqual([55]);
  });
});

describe("files – deleteFile", () => {
  it("elimina en Drive y BD, y registra la auditoria con el request_id afectado", async () => {
    drive.files.delete.mockResolvedValue({});
    db.query.mockResolvedValue({ rows: [{ request_id: 77 }] });

    await deleteFile("FILE1", 9);

    expect(drive.files.delete).toHaveBeenCalledWith({ fileId: "FILE1", supportsAllDrives: true });
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: "files", accion: "eliminar", contexto: { request_id: 77 } }),
    );
  });

  it("propaga el error si Drive falla y registra el error", async () => {
    drive.files.delete.mockRejectedValue(new Error("drive down"));
    await expect(deleteFile("FILE1", 9)).rejects.toThrow("drive down");
    expect(logAction).not.toHaveBeenCalled();
  });
});
