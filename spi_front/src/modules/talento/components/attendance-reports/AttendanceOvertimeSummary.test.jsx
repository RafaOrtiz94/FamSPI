import { computeOutsideMinutes, formatHours } from "./AttendanceOvertimeSummary";

describe("AttendanceOvertimeSummary overtime rules", () => {
  const policy = {
    timezone: "America/Guayaquil",
    workDays: [1, 2, 3, 4, 5],
    start: "09:00",
    end: "18:00",
  };

  test("counts only one hour outside labor window for 08:00 -> 12:00", () => {
    const minutes = computeOutsideMinutes(
      {
        start: new Date("2026-04-21T08:00:00-05:00"),
        end: new Date("2026-04-21T12:00:00-05:00"),
      },
      policy,
    );
    expect(minutes).toBe(60);
    expect(formatHours(minutes / 60)).toBe("01:00:00");
  });

  test("counts one hour outside labor window for 17:30 -> 19:00", () => {
    const minutes = computeOutsideMinutes(
      {
        start: new Date("2026-04-21T17:30:00-05:00"),
        end: new Date("2026-04-21T19:00:00-05:00"),
      },
      policy,
    );
    expect(minutes).toBe(60);
    expect(formatHours(minutes / 60)).toBe("01:00:00");
  });

  test("counts zero outside labor window for 09:00 -> 18:00", () => {
    const minutes = computeOutsideMinutes(
      {
        start: new Date("2026-04-21T09:00:00-05:00"),
        end: new Date("2026-04-21T18:00:00-05:00"),
      },
      policy,
    );
    expect(minutes).toBe(0);
    expect(formatHours(minutes / 60)).toBe("00:00:00");
  });
});
