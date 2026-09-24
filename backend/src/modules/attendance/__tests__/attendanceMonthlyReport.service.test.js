jest.mock("../../../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../../../utils/documentHash", () => ({
  HASH_ALGORITHM: "SHA-256",
  computeSha256HexFromBuffer: jest.fn(() => "hash"),
}));

const { __private } = require("../attendanceMonthlyReport.service");
const XLSX = require("xlsx");

describe("attendanceMonthlyReport.service telework columns", () => {
  test("builds explicit telework marks without treating the day as operational", () => {
    const row = {
      date: "2026-07-23",
      exception_type: "operacion_campo",
      operational_category: "teletrabajo",
      operational_destination_city: "Quito",
      start_time: "2026-07-23T14:00:00.000Z",
      lunch_start_time: "2026-07-23T19:00:00.000Z",
      lunch_end_time: "2026-07-23T20:00:00.000Z",
      return_time: "2026-07-23T23:00:00.000Z",
      entry_time: "2026-07-23T14:00:00.000Z",
      exit_time: "2026-07-23T23:00:00.000Z",
      acta_entry_time: "2026-07-23T14:00:00.000Z",
      acta_lunch_start_time: "2026-07-23T19:00:00.000Z",
      acta_lunch_end_time: "2026-07-23T20:00:00.000Z",
      acta_exit_time: "2026-07-23T23:00:00.000Z",
      real_overtime_seconds: 75,
    };

    const day = __private.buildDayRecord(row);

    expect(__private.isTelework(row)).toBe(true);
    expect(__private.isOperational(row)).toBe(false);
    expect(day.tipo).toBe("Teletrabajo");
    expect(day.inicioTeletrabajo).not.toBe("-");
    expect(day.almuerzoTeletrabajoSalida).not.toBe("-");
    expect(day.almuerzoTeletrabajoRegreso).not.toBe("-");
    expect(day.cierreTeletrabajo).not.toBe("-");
    expect(day.ciudadTeletrabajo).toBe("Quito");
    expect(day.dobleMarcacion).toBe(false);
    expect(day.totalTrabajado).toBe("8h 00m 00s");
    expect(day.totalTrabajadoSegundos).toBe(28800);
    expect(day.extraDuracion).toBe("0h 01m 15s");
  });

  test("calculates total worked hours discounting at least one lunch hour", () => {
    const totalSeconds = __private.calculateWorkedSecondsFromRealMarks({
      entry_time: "2026-07-23T13:45:10.000Z",
      lunch_start_time: "2026-07-23T18:15:00.000Z",
      lunch_end_time: "2026-07-23T19:05:30.000Z",
      exit_time: "2026-07-23T23:10:40.000Z",
    });

    expect(totalSeconds).toBe(30330);
    expect(__private.toDurationLabel(totalSeconds)).toBe("8h 25m 30s");
  });

  test("calculates total worked hours discounting the full lunch when it is longer than one hour", () => {
    const totalSeconds = __private.calculateWorkedSecondsFromRealMarks({
      entry_time: "2026-07-23T14:00:00.000Z",
      lunch_start_time: "2026-07-23T19:00:00.000Z",
      lunch_end_time: "2026-07-23T20:30:00.000Z",
      exit_time: "2026-07-24T00:30:00.000Z",
    });

    expect(totalSeconds).toBe(32400);
    expect(__private.toDurationLabel(totalSeconds)).toBe("9h 00m 00s");
  });

  test("adds a monthly total row with the sum of all real overtime in Excel", async () => {
    const buffer = await __private.buildExcelBuffer({
      periodLabel: "Julio 2026",
      collaborators: [
        {
          fullname: "A",
          department_name: "TI",
          days: [],
          totalTrabajadoSegundos: 0,
          totalExtraSegundos: 3600,
          doubleMarkDays: 0,
          timeOffDays: 0,
        },
        {
          fullname: "B",
          department_name: "TH",
          days: [],
          totalTrabajadoSegundos: 0,
          totalExtraSegundos: 1815,
          doubleMarkDays: 0,
          timeOffDays: 0,
        },
      ],
    });

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Resumen);

    expect(rows[0].Colaborador).toBe("TOTAL MENSUAL");
    expect(rows[0]["Extra real"]).toBe("1h 30m 15s");
    expect(rows[0]["Extra real (segundos)"]).toBe(5415);
  });
});
