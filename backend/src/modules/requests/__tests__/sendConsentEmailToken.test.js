jest.mock("uuid", () => ({ v4: () => "test-uuid" }));

jest.mock("../../../config/db", () => ({
  query: jest.fn().mockResolvedValue({ rows: [{ id: "token-1", expires_at: new Date() }] }),
  getClient: jest.fn(),
}));

const mockSendMail = jest.fn().mockResolvedValue({ delivered: true, via: "service_account" });
jest.mock("../../../utils/mailer", () => ({ sendMail: mockSendMail }));

jest.mock("../../../config/google", () => ({ drive: {}, docs: {} }));
jest.mock("../../notifications/notificationManager", () => ({}));
jest.mock("../../integrations/integrationOutbox.service", () => ({ enqueueIntegrationEvent: jest.fn() }));
jest.mock("../../../config/crmDb", () => ({ isCrmSyncEnabled: () => false }));
jest.mock("../../inventario/inventario.service", () => ({
  captureSerial: jest.fn(),
  cambiarEstadoUnidad: jest.fn(),
  assignUnidad: jest.fn(),
  normalizeDetalleValue: jest.fn(),
}));

const { sendConsentEmailToken } = require("../requests.service");

describe("sendConsentEmailToken", () => {
  it("envia el codigo por un unico camino (sendMail), sin doble intento por gmailService", async () => {
    mockSendMail.mockClear();

    await sendConsentEmailToken({
      user: { id: 1, email: "vendedor@fam-project.com", fullname: "Vendedor" },
      client_email: "cliente@empresa.com",
      recipient_email: "cliente@empresa.com",
      client_name: "Cliente SA",
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0].from).toBe("vendedor@fam-project.com");
  });
});
