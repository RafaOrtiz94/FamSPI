jest.mock("../../config/google", () => ({
  createDelegatedJwtClient: jest.fn(() => ({ authorize: jest.fn().mockResolvedValue(true) })),
}));

const mockSend = jest.fn().mockResolvedValue({ data: { id: "msg1", threadId: "thr1" } });

jest.mock("googleapis", () => ({
  google: {
    gmail: jest.fn(() => ({
      users: { messages: { send: (...args) => mockSend(...args) } },
    })),
  },
}));

jest.mock("../../services/gmail.service", () => ({}));
jest.mock("../googleChat", () => ({ htmlToText: (html) => html, sendChatMessage: jest.fn() }));

const { createDelegatedJwtClient } = require("../../config/google");
const { sendMail } = require("../mailer");

describe("sendMail delegated sender", () => {
  it("delega como el usuario solicitante (from), no como GOOGLE_SUBJECT por defecto", async () => {
    process.env.GOOGLE_SUBJECT = "administrador@fam-project.com";

    await sendMail({
      to: "proveedor@ejemplo.com",
      subject: "Solicitud de disponibilidad",
      html: "<p>hola</p>",
      from: "vendedor.real@fam-project.com",
      replyTo: "vendedor.real@fam-project.com",
    });

    expect(createDelegatedJwtClient).toHaveBeenCalledWith("vendedor.real@fam-project.com");
  });

  it("encadena el siguiente correo como respuesta (threadId + In-Reply-To) cuando se pasa contexto de hilo", async () => {
    mockSend.mockClear();

    const result = await sendMail({
      to: "proveedor@ejemplo.com",
      subject: "Re: Solicitud privada #123",
      html: "<p>seguimiento</p>",
      from: "vendedor.real@fam-project.com",
      threadId: "thr1",
      inReplyTo: "<prev@fam-project.com>",
      references: "<prev@fam-project.com>",
    });

    const rawSent = mockSend.mock.calls[0][0].requestBody;
    expect(rawSent.threadId).toBe("thr1");
    const decoded = Buffer.from(
      rawSent.raw.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf-8");
    expect(decoded).toContain("In-Reply-To: <prev@fam-project.com>");
    expect(decoded).toContain("References: <prev@fam-project.com>");
    expect(decoded).toMatch(/Message-ID: <.+@fam-project\.com>/);
    expect(result.rfc822MessageId).toMatch(/^<.+@fam-project\.com>$/);
  });
});
