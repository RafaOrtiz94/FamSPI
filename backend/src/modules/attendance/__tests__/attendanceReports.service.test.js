jest.mock("../../../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../../../config/logger", () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

const { buildAttendanceRegularization, enrichAttendanceRowGeo } = require("../attendanceReports.service");

describe("attendanceReports.service permission enrichment", () => {
  test("adds permission exit and return marks for hourly approved permissions", () => {
    const row = enrichAttendanceRowGeo({
      date: "2026-07-02",
      fullname: "Colaborador Prueba",
      email: "colaborador@fam-project.com",
      department_name: "TI",
      entry_time: "2026-07-02T14:00:00.000Z",
      exit_time: "2026-07-02T23:00:00.000Z",
      time_off_id: 157,
      time_off_type: "permiso",
      time_off_subtype: "personal",
      time_off_is_emergency: false,
      time_off_status: "approved",
      time_off_start_at: "2026-07-02T16:00:00.000Z",
      time_off_end_at: "2026-07-02T18:00:00.000Z",
    });

    expect(row.permission_request_id).toBe(157);
    expect(row.permission_label).toBe("Permiso personal");
    expect(row.permission_exit_time).toBe("2026-07-02T16:00:00.000Z");
    expect(row.permission_return_time).toBe("2026-07-02T18:00:00.000Z");
    expect(row.permission_events).toEqual([
      expect.objectContaining({ key: "permission_exit", label: "Salida a permiso" }),
      expect.objectContaining({ key: "permission_return", label: "Entrada de permiso" }),
    ]);
  });

  test("uses emergency label for emergency permissions", () => {
    const row = enrichAttendanceRowGeo({
      date: "2026-07-02",
      fullname: "Colaborador Prueba",
      email: "colaborador@fam-project.com",
      department_name: "TI",
      time_off_id: 158,
      time_off_type: "permiso",
      time_off_subtype: "salud",
      time_off_is_emergency: true,
      time_off_status: "approved",
      time_off_start_at: "2026-07-02T17:00:00.000Z",
      time_off_end_at: "2026-07-02T19:00:00.000Z",
    });

    expect(row.permission_label).toBe("Permiso de emergencia");
    expect(row.permission_exit_time).toBe("2026-07-02T17:00:00.000Z");
    expect(row.permission_return_time).toBe("2026-07-02T19:00:00.000Z");
  });

  test("does not create permission marks for vacations or permissions without hourly range", () => {
    const vacationRow = enrichAttendanceRowGeo({
      date: "2026-07-02",
      fullname: "Colaborador Prueba",
      email: "colaborador@fam-project.com",
      department_name: "TI",
      time_off_id: 159,
      time_off_type: "vacaciones",
    });

    const allDayPermissionRow = enrichAttendanceRowGeo({
      date: "2026-07-02",
      fullname: "Colaborador Prueba",
      email: "colaborador@fam-project.com",
      department_name: "TI",
      time_off_id: 160,
      time_off_type: "permiso",
      time_off_subtype: "salud",
      time_off_status: "approved",
      time_off_start_date: "2026-07-02",
      time_off_end_date: "2026-07-02",
    });

    expect(vacationRow.permission_events).toEqual([]);
    expect(vacationRow.permission_exit_time).toBeNull();
    expect(allDayPermissionRow.permission_label).toBe("Permiso de salud");
    expect(allDayPermissionRow.permission_events).toEqual([]);
    expect(allDayPermissionRow.permission_exit_time).toBeNull();
    expect(allDayPermissionRow.permission_return_time).toBeNull();
  });
});

describe("attendanceReports.service real overtime", () => {
  test("calculates real overtime only from real attendance marks", () => {
    const regularization = buildAttendanceRegularization({
      date: "2026-07-23",
      entry_time: "2026-07-23T14:00:00.000Z",
      lunch_start_time: "2026-07-23T19:00:00.000Z",
      lunch_end_time: "2026-07-23T20:00:00.000Z",
      exit_time: "2026-07-23T23:30:15.000Z",
      exception_type: "operacion_campo",
      field_events: [
        { type: "office_exit", time: "2026-07-23T12:00:00.000Z" },
        { type: "office_entry", time: "2026-07-24T01:00:00.000Z" },
      ],
    });

    expect(regularization.real_overtime_seconds).toBe(1815);
    expect(regularization.real_overtime_hours).toBeCloseTo(0.504167, 6);
  });

  test("does not create real overtime from operational events when real marks are within standard day", () => {
    const regularization = buildAttendanceRegularization({
      date: "2026-07-23",
      entry_time: "2026-07-23T14:00:00.000Z",
      lunch_start_time: "2026-07-23T19:00:00.000Z",
      lunch_end_time: "2026-07-23T20:00:00.000Z",
      exit_time: "2026-07-23T23:00:00.000Z",
      exception_type: "operacion_campo",
      field_events: [
        { type: "office_exit", time: "2026-07-23T12:00:00.000Z" },
        { type: "office_entry", time: "2026-07-24T01:00:00.000Z" },
      ],
    });

    expect(regularization.real_overtime_seconds).toBe(0);
    expect(regularization.real_overtime_hours).toBe(0);
  });

  test("discounts at least one lunch hour from real overtime when lunch mark is shorter", () => {
    const regularization = buildAttendanceRegularization({
      date: "2026-07-23",
      entry_time: "2026-07-23T14:00:00.000Z",
      lunch_start_time: "2026-07-23T19:00:00.000Z",
      lunch_end_time: "2026-07-23T19:30:00.000Z",
      exit_time: "2026-07-23T23:30:00.000Z",
    });

    expect(regularization.real_overtime_seconds).toBe(1800);
    expect(regularization.real_overtime_hours).toBeCloseTo(0.5, 6);
  });

  test("discounts the full real lunch time when lunch mark is longer than one hour", () => {
    const regularization = buildAttendanceRegularization({
      date: "2026-07-23",
      entry_time: "2026-07-23T14:00:00.000Z",
      lunch_start_time: "2026-07-23T19:00:00.000Z",
      lunch_end_time: "2026-07-23T20:30:00.000Z",
      exit_time: "2026-07-24T00:30:00.000Z",
    });

    expect(regularization.real_overtime_seconds).toBe(3600);
    expect(regularization.real_overtime_hours).toBeCloseTo(1, 6);
  });
});
