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
    ).toBe(__private.VACATION_LABEL);
  });

  test("prints VACACIONES in hour cells for approved vacation days", () => {
    const value = __private.resolveHourlySlotValue({
      rawValue: "2026-05-04T14:04:00.000Z",
      slotName: "entry",
      dayTimeOff: { vacations: new Set([100]), permissions: [] },
    });

    expect(value).toBe(__private.VACATION_LABEL);
  });
});
