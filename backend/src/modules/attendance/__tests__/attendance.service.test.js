jest.mock("../../../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../../../config/logger", () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

jest.mock("../../../config/google", () => ({
  drive: {
    files: {
      get: jest.fn(),
    },
  },
}));

jest.mock("../../../utils/pdfFormSecurity", () => ({
  securePdfForm: jest.fn(),
}));

const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const { __private } = require("../attendance.service");

describe("attendance.service RH-09 helpers", () => {
  test("maps RH-09 day fields by template row position when field names are crossed", async () => {
    const templatePath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "data",
      "plantillas",
      "F.RH-09_V01_PLANTILLA_RA.pdf"
    );
    const pdfDoc = await PDFDocument.load(fs.readFileSync(templatePath));
    const lookup = __private.buildDayTextFieldLookup(pdfDoc.getForm());

    expect(lookup.get("ra_observaciones_3")).toBe("ra_observaciones_4");
    expect(lookup.get("ra_observaciones_4")).toBe("ra_observaciones_3");
    expect(lookup.get("ra_observaciones_27")).toBe("ra_observaciones_28");
    expect(lookup.get("ra_observaciones_28")).toBe("ra_observaciones_27");
    expect(lookup.get("hora_salida_a_10")).toBe("hora_salida_a_11");
    expect(lookup.get("hora_salida_a_11")).toBe("hora_salida_a_10");
    expect(lookup.get("hora_entrada_a_10")).toBe("hora_entrada_a_11");
    expect(lookup.get("hora_entrada_a_11")).toBe("hora_entrada_a_10");
  });

  test("uses official non-working day labels for weekend and vacations", () => {
    expect(
      __private.resolveDayOverrideLabel({
        currentDate: new Date(2026, 4, 2, 12, 0, 0, 0),
        dayTimeOff: null,
      })
    ).toBe(__private.WEEKEND_LABEL);

    expect(
      __private.resolveDayOverrideLabel({
        currentDate: new Date(2026, 4, 4, 12, 0, 0, 0),
        dayTimeOff: { vacations: new Set([100]), permissions: [] },
      })
    ).toBe("VAC-100");
  });

  test("prints VAC-{ID} in hour cells for approved vacation days", () => {
    const value = __private.resolveHourlySlotValue({
      rawValue: "2026-05-04T14:04:00.000Z",
      slotName: "entry",
      dayTimeOff: { vacations: new Set([100]), permissions: [] },
    });

    expect(value).toBe("VAC-100");
  });

  test("normalizes database DATE objects before building RH acta times", () => {
    const formatEcTime = (value) =>
      new Date(value).toLocaleTimeString("es-EC", {
        timeZone: "America/Guayaquil",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        hourCycle: "h23",
      });

    const record = __private.enrichAttendanceRecordForActa({
      id: 1,
      user_id: 10,
      date: new Date(Date.UTC(2026, 6, 23)),
      entry_time: "2026-07-23T14:45:00.000Z",
      lunch_start_time: "2026-07-23T19:20:00.000Z",
      lunch_end_time: "2026-07-23T20:05:00.000Z",
      exit_time: "2026-07-23T23:40:00.000Z",
      field_events: [],
    });

    expect(record.date).toBe("2026-07-23");
    expect(formatEcTime(record.acta_entry_time)).toBe("09:00");
    expect(formatEcTime(record.acta_lunch_start_time)).toBe("14:00");
    expect(formatEcTime(record.acta_lunch_end_time)).toBe("15:00");
    expect(formatEcTime(record.acta_exit_time)).toBe("18:00");
  });
});
