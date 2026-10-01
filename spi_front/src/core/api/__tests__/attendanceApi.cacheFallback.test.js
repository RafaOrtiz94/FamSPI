import api, { isTransientApiError } from "../index";
import {
  getAttendanceLivePresence,
  getAttendancePunctualitySummary,
  getTodayAttendance,
} from "../attendanceApi";

jest.mock("../index", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  isTransientApiError: jest.fn(),
}));

describe("attendanceApi - cache fallback de lecturas", () => {
  beforeEach(() => {
    localStorage.clear();
    api.get.mockReset();
    isTransientApiError.mockReset();
  });

  test("getTodayAttendance guarda snapshot local cuando responde el backend", async () => {
    api.get.mockResolvedValueOnce({ data: { entry_time: "2026-08-12T09:00:00.000Z" } });

    const result = await getTodayAttendance();

    expect(result).toEqual({ entry_time: "2026-08-12T09:00:00.000Z" });
    expect(localStorage.getItem("spi_pwa_cache:attendance_today_snapshot")).toContain("entry_time");
  });

  test("getTodayAttendance usa snapshot local en error transitorio", async () => {
    localStorage.setItem(
      "spi_pwa_cache:attendance_today_snapshot",
      JSON.stringify({
        data: { entry_time: "2026-08-12T08:59:00.000Z", cached: true },
        savedAt: "2026-08-12T12:00:00.000Z",
        meta: {},
      }),
    );
    const error = new Error("Network Error");
    api.get.mockRejectedValueOnce(error);
    isTransientApiError.mockReturnValueOnce(true);

    const result = await getTodayAttendance();

    expect(result).toEqual({ entry_time: "2026-08-12T08:59:00.000Z", cached: true });
  });

  test("getAttendanceLivePresence no oculta errores no transitorios", async () => {
    const error = new Error("Forbidden");
    error.response = { status: 403 };
    api.get.mockRejectedValueOnce(error);
    isTransientApiError.mockReturnValueOnce(false);

    await expect(getAttendanceLivePresence()).rejects.toBe(error);
  });

  test("getAttendancePunctualitySummary falla si no hay cache aunque el error sea transitorio", async () => {
    const error = new Error("Timeout");
    api.get.mockRejectedValueOnce(error);
    isTransientApiError.mockReturnValueOnce(true);

    await expect(getAttendancePunctualitySummary()).rejects.toBe(error);
  });
});
