// Verificacion del envio de correo (control de integracion Gmail):
// validacion de campos obligatorios y manejo de error de autorizacion.

jest.mock("../../../services/gmail.service", () => ({ sendEmail: jest.fn() }));
jest.mock("../../../utils/audit", () => ({ logAction: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const gmailService = require("../../../services/gmail.service");
const { logAction } = require("../../../utils/audit");
const controller = require("../gmail.controller");

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// asyncHandler no propaga la promesa interna al caller (no la retorna), asi
// que hay que ceder el hilo de eventos para permitir que la cadena async del
// handler (sendEmail -> logAction -> res.json) termine antes de aserir.
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => jest.clearAllMocks());

describe("gmail.controller.sendEmail", () => {
  it("rechaza cuando faltan campos obligatorios", async () => {
    const req = { user: { id: 1 }, body: { subject: "Asunto" } };
    const res = makeRes();
    await controller.sendEmail(req, res, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(gmailService.sendEmail).not.toHaveBeenCalled();
  });

  it("envia el correo y registra la accion cuando el payload es valido", async () => {
    gmailService.sendEmail.mockResolvedValue({ messageId: "msg-1" });
    const req = { user: { id: 1 }, body: { to: "a@b.com", subject: "Asunto", html: "<p>hola</p>" } };
    const res = makeRes();
    await controller.sendEmail(req, res, () => {});
    await flush();
    expect(gmailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, to: "a@b.com" }));
    expect(logAction).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it("devuelve 403 con needsAuth cuando el error es de autorizacion", async () => {
    gmailService.sendEmail.mockRejectedValue(new Error("Debes autorizar el acceso a Gmail"));
    const req = { user: { id: 1 }, body: { to: "a@b.com", subject: "Asunto", text: "hola" } };
    const res = makeRes();
    await controller.sendEmail(req, res, () => {});
    await flush();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ needsAuth: true }));
  });
});
