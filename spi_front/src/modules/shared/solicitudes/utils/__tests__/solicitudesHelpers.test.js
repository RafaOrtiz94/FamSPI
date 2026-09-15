import { formatCalendarDate, formatDateShort, calculateInclusiveCalendarDays } from "../solicitudesHelpers";

// Regresion: fecha_inicio/fecha_fin llegan de la API como timestamp completo
// ("2026-08-24T05:00:00.000Z" == medianoche Ecuador en UTC), no como
// "YYYY-MM-DD" puro. El regex de DATE_ONLY_REGEX tenia un "$" que exigia
// coincidencia exacta, asi que nunca matcheaba estos valores y caia a un
// fallback que formateaba con la zona horaria del dispositivo -- corriendo
// la fecha un dia hacia atras en cualquier maquina no configurada en UTC-5.
describe("solicitudesHelpers date formatting (timezone regression)", () => {
  const fullTimestamp = "2026-08-24T05:00:00.000Z"; // medianoche Ecuador del 24-ago

  it("formatCalendarDate no corre la fecha un dia con timestamps completos", () => {
    expect(formatCalendarDate(fullTimestamp, { day: "2-digit", month: "short" })).not.toMatch(/23/);
    expect(new Date(2026, 7, 24).toLocaleDateString("es-EC", { day: "2-digit", month: "short" }))
      .toBe(formatCalendarDate(fullTimestamp, { day: "2-digit", month: "short" }));
  });

  it("formatDateShort sigue siendo correcto (ya no dependia del bug)", () => {
    expect(formatDateShort(fullTimestamp)).toBe(
      new Date(2026, 7, 24).toLocaleDateString("es-EC", { day: "2-digit", month: "short" })
    );
  });

  it("calculateInclusiveCalendarDays cuenta 19 dias para 24-ago..11-sep", () => {
    expect(calculateInclusiveCalendarDays("2026-08-24T05:00:00.000Z", "2026-09-11T05:00:00.000Z")).toBe(19);
  });
});
