jest.mock("../../../config/db", () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock("../../../config/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const db = require("../../../config/db");
const { mapNotificationRow } = require("../notifications.service");
const notificationManager = require("../notificationManager");

describe("notifications – mapNotificationRow", () => {
  it("mapea los campos de la fila y usa {} cuando meta es null", () => {
    const row = {
      id: 1, user_id: 5, title: "T", message: "M", type: "info", source: "system",
      status: "unread", priority: "media", meta: null, created_at: "2026-01-01", read_at: null, cleared_at: null,
    };
    const out = mapNotificationRow(row);
    expect(out.id).toBe(1);
    expect(out.meta).toEqual({});
    expect(out.cleared_at).toBeNull();
  });

  it("preserva meta cuando viene definido", () => {
    const out = mapNotificationRow({ id: 2, meta: { foo: "bar" } });
    expect(out.meta).toEqual({ foo: "bar" });
  });

  it("genera una clave de hilo independiente para cada destinatario", () => {
    const processKey = "business_case:bc-test";
    const first = notificationManager.resolveRecipientThreadProcessKey(processKey, "first@example.com");
    const second = notificationManager.resolveRecipientThreadProcessKey(processKey, "second@example.com");

    expect(first).not.toBe(processKey);
    expect(first).not.toBe(second);
    expect(notificationManager.resolveRecipientThreadProcessKey(processKey, "FIRST@example.com")).toBe(first);
  });

  it("solo permite despacho de correo entre las 08:00 y antes de las 19:00 de Ecuador", () => {
    const opening = notificationManager.getEmailScheduleState(new Date("2026-07-23T13:00:00.000Z"));
    const closed = notificationManager.getEmailScheduleState(new Date("2026-07-24T00:00:00.000Z"));

    expect(opening.allowed).toBe(true);
    expect(opening.nextAllowedAt).toBeNull();
    expect(closed.allowed).toBe(false);
    expect(closed.nextAllowedAt.toISOString()).toBe("2026-07-24T13:00:00.000Z");
  });
});
