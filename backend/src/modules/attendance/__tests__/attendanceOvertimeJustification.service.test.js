jest.mock("../../../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../../../utils/documentHash", () => ({
  HASH_ALGORITHM: "SHA-256",
  computeSha256HexFromBuffer: jest.fn(() => "hash"),
}));

const { __private } = require("../attendanceOvertimeJustification.service");

const { buildReportModel, offHoursSeconds, resolvePeriod } = __private;

const att = (key, entry, exit, overtime) => ({
  day: key, entry_time: `${key}T${entry}:00-05:00`, lunch_start_time: null, lunch_end_time: null, exit_time: `${key}T${exit}:00-05:00`, overtime_hours: overtime,
});

describe("attendanceOvertimeJustification.service", () => {
  test("offHoursSeconds cuenta solo lo que cae fuera de la jornada L-V", () => {
    // Miercoles 07:07-21:11 => 1h53 antes de las 09:00 + 3h11 despues de las 18:00
    expect(offHoursSeconds("2026-09-30T07:07:00-05:00", "2026-09-30T21:11:00-05:00")).toBe(5 * 3600 + 4 * 60);
    // Dentro de jornada
    expect(offHoursSeconds("2026-09-30T10:00:00-05:00", "2026-09-30T17:00:00-05:00")).toBe(0);
    // Domingo completo, cruza medianoche al lunes
    expect(offHoursSeconds("2026-09-27T12:42:00-05:00", "2026-09-28T00:29:00-05:00")).toBe(11 * 3600 + 47 * 60);
  });

  test("resolvePeriod cubre el mes calendario completo", () => {
    expect(resolvePeriod({ year: 2026, month: 12 })).toMatchObject({ from: "2026-12-01", to: "2027-01-01", key: "2026-12" });
    expect(() => resolvePeriod({ year: 2026, month: 13 })).toThrow();
  });

  test("buildReportModel separa horas por sistema y declaradas sin sumar dos veces", () => {
    const model = buildReportModel({
      attendance: [
        att("2026-09-07", "08:59", "19:15", "1.00"), // jornada normal => "sistema"
        // Dia con salida operacional: usa la hora extra ya calculada por asistencia, como "declarada"
        att("2026-09-30", "07:07", "21:11", "6.06"),
        att("2026-09-24", "09:06", "18:11", "0.00"),
      ],
      exceptions: [
        { day: "2026-09-30", start_time: "2026-09-30T07:30:00-05:00", return_time: "2026-09-30T21:11:00-05:00" },
        { day: "2026-09-24", start_time: "2026-09-24T20:24:00-05:00", return_time: "2026-09-24T23:23:00-05:00", operational_destination_label: "TELETRABAJO" },
        // Olvidada abierta casi 24 h: no se suma
        { day: "2026-09-16", start_time: "2026-09-16T09:12:00-05:00", return_time: "2026-09-17T09:02:00-05:00" },
        // Prueba del flujo: abierta y cerrada en segundos
        { day: "2026-09-16", start_time: "2026-09-16T06:31:31-05:00", return_time: "2026-09-16T06:31:49-05:00" },
      ],
      closures: [
        { created_at: "2026-09-24T20:30:00-05:00", code: "TK-000051", title: "Filtro CRM" },
        { created_at: "2026-09-23T17:44:00-05:00", code: "TK-000049", title: "FamSign" },
      ],
      actions: [
        { ts: "2026-09-24T21:05:00-05:00", modulo: "business-case" },
        { ts: "2026-09-24T21:38:00-05:00", modulo: "business-case" },
        { ts: "2026-09-24T11:00:00-05:00", modulo: "crm-fam" }, // en jornada: no cuenta
      ],
    });

    expect(model.totals).toMatchObject({
      systemSeconds: 3600,
      systemDays: 1,
      declaredSeconds: Math.round(6.06 * 3600) + 2 * 3600 + 59 * 60,
      declaredDays: 2,
    });
    expect(model.rows.map((row) => row.key)).toEqual(["2026-09-07", "2026-09-24", "2026-09-30"]);
    expect(model.rows[1]).toMatchObject({ type: "Declarada", entry: "20:24", exit: "23:23", basis: "TELETRABAJO",
      technical: "Tickets cerrados fuera de jornada: TK-000051 Filtro CRM. Trabajo fuera de jornada en: Business Case (21:05-21:38).",
    });
    expect(model.rows[0].technical).toBe("Sin detalle tecnico registrado en el sistema.");
    expect(model.notes).toHaveLength(1);
  });

  test("buildReportModel descuenta atrasos no justificados del total neto", () => {
    const model = buildReportModel({
      attendance: [
        att("2026-09-07", "08:59", "19:15", "1.00"),
        att("2026-09-08", "09:09", "18:00", "0.00"), // atraso de 9 min sin justificar
        att("2026-09-09", "09:20", "18:00", "0.00"), // atraso justificado
        att("2026-09-10", "09:06", "18:00", "0.00"), // dentro de tolerancia
        att("2026-09-22", "09:30", "18:00", "0.00"), // dia con salida operacional: no es atraso
      ],
      exceptions: [{ day: "2026-09-22", start_time: "2026-09-22T08:14:00-05:00", return_time: "2026-09-22T17:00:00-05:00" }],
      lateJustifiedDays: ["2026-09-09"],
    });

    expect(model.totals).toMatchObject({ systemSeconds: 3600, lateSeconds: 9 * 60, lateDays: 1, netSeconds: 3600 + 46 * 60 - 9 * 60 });
  });
});
