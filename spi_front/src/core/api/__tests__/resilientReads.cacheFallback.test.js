import api, { isTransientApiError } from "../index";
import { listNotifications } from "../notificationsApi";
import { listMySupportTickets, listSupportTicketComments } from "../supportTicketsApi";
import { fetchMyProfile } from "../userProfileApi";

jest.mock("../index", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  isTransientApiError: jest.fn(),
}));

describe("resilient reads - cache fallback", () => {
  beforeEach(() => {
    localStorage.clear();
    api.get.mockReset();
    isTransientApiError.mockReset();
  });

  test("fetchMyProfile usa snapshot local en error transitorio", async () => {
    localStorage.setItem(
      "spi_pwa_cache:my_profile_api_snapshot",
      JSON.stringify({
        data: { identity: { id: 7, fullname: "Ada Lovelace" } },
        savedAt: "2026-08-12T12:00:00.000Z",
        meta: {},
      }),
    );
    const error = new Error("Network Error");
    api.get.mockRejectedValueOnce(error);
    isTransientApiError.mockReturnValueOnce(true);

    const result = await fetchMyProfile();

    expect(result).toEqual({ identity: { id: 7, fullname: "Ada Lovelace" } });
  });

  test("listNotifications guarda y reutiliza cache por status", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        data: [{ id: 1, title: "Nueva aprobacion" }],
        unread: 1,
      },
    });

    const first = await listNotifications("unread");
    expect(first).toEqual({ list: [{ id: 1, title: "Nueva aprobacion" }], unread: 1 });

    const networkError = new Error("Timeout");
    api.get.mockRejectedValueOnce(networkError);
    isTransientApiError.mockReturnValueOnce(true);

    const second = await listNotifications("unread");
    expect(second).toEqual({ list: [{ id: 1, title: "Nueva aprobacion" }], unread: 1 });
  });

  test("listMySupportTickets usa cache local en fallo transitorio", async () => {
    localStorage.setItem(
      "spi_pwa_cache:support_tickets_my_snapshot",
      JSON.stringify({
        data: [{ id: 11, title: "VPN intermitente" }],
        savedAt: "2026-08-12T12:00:00.000Z",
        meta: {},
      }),
    );
    const error = new Error("Failed to fetch");
    api.get.mockRejectedValueOnce(error);
    isTransientApiError.mockReturnValueOnce(true);

    const result = await listMySupportTickets();

    expect(result).toEqual([{ id: 11, title: "VPN intermitente" }]);
  });

  test("listSupportTicketComments mantiene fallo real si no hay cache", async () => {
    const error = new Error("Forbidden");
    error.response = { status: 403 };
    api.get.mockRejectedValueOnce(error);
    isTransientApiError.mockReturnValueOnce(false);

    await expect(listSupportTicketComments(99)).rejects.toBe(error);
  });
});
