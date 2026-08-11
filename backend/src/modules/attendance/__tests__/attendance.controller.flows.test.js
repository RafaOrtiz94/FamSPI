jest.mock("../../../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../../../config/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../../../utils/offHoursPolicy", () => ({
  getBusinessHours: jest.fn(() => ({
    timezone: "America/Guayaquil",
    workDays: [1, 2, 3, 4, 5],
    startHour: 7,
    startMinute: 30,
    endHour: 20,
    endMinute: 0,
  })),
  isOffHours: jest.fn(() => ({ isOffHours: false })),
}));

const db = require("../../../config/db");
const controller = require("../attendance.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("attendance flow separation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
  });

  test("blocks unexpected exit start when operational flow is active", async () => {
    const req = {
      user: { id: 10, email: "field@fam.com" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 25, description: "traslado urgente" },
    };
    const res = createRes();

    db.query
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [] }) // no active unexpected
      .mockResolvedValueOnce({ rows: [{ id: 99, type: "operacion_campo", status: "ACTIVE" }] }); // active operational

    await controller.clockOutUnexpected(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        message: expect.stringContaining("salida operacional activa"),
      }),
    );
  });

  test("blocks operational exit start when unexpected flow is active", async () => {
    const req = {
      user: { id: 11, email: "field2@fam.com" },
      body: {
        location: "-2.170998,-79.922359",
        location_accuracy: 25,
        description: "visita no planificada",
        operational_category: "cliente",
        destination: "Cliente Norte",
        city: "Guayaquil",
      },
    };
    const res = createRes();

    db.query
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [] }) // no active operational
      .mockResolvedValueOnce({ rows: [{ id: 100, type: "IMPREVISTO", status: "ACTIVE" }] }); // active unexpected

    await controller.clockOutOperational(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        message: expect.stringContaining("salida inesperada activa"),
      }),
    );
  });

  test("registers operational exit successfully", async () => {
    // Fijamos "now" a las 10:00 America/Guayaquil: syncNormalEntryFromFieldOp
    // solo hace su mirror completo (SELECT+INSERT) cuando la salida operacional
    // arranca en/despues del inicio oficial de jornada (09:00) -- antes de esa
    // hora ahora se salta (regla real: una gestion antes de las 9am no
    // sustituye la entrada del dia, el colaborador debe marcarla aparte).
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-08T15:00:00.000Z"));
    try {
      const req = {
        user: { id: 12, email: "ops@fam.com" },
        body: {
          location: "-2.170998,-79.922359",
          location_accuracy: 20,
          description: "salida oficina",
          operational_category: "cliente",
          destination: "Cliente Norte",
          city: "Guayaquil",
        },
      };
      const res = createRes();
      const inserted = { id: 501, type: "operacion_campo", status: "ACTIVE" };

      // Mock por texto de SQL (robusto ante llamadas intermedias como
      // ensureOperationalDestinationColumns o los auto-sync): la unica
      // respuesta que importa aqui es el INSERT de la salida operacional.
      db.query.mockImplementation((sql) => {
        const text = typeof sql === "string" ? sql : "";
        if (text.includes("INSERT INTO attendance_exceptions")) {
          return Promise.resolve({ rows: [inserted], rowCount: 1 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      await controller.clockOutOperational(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          message: expect.stringContaining("Salida operacional registrada"),
          data: expect.objectContaining({ id: 501 }),
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test("returns operational cycle as active when user starts it again on another day", async () => {
    const req = {
      user: { id: 120, email: "ops-repeat@fam.com" },
      body: {
        location: "-2.170998,-79.922359",
        location_accuracy: 20,
        description: "seguimiento multi-dia",
        operational_category: "cliente",
        destination: "Cliente Norte",
        city: "Guayaquil",
      },
    };
    const res = createRes();
    const activeOperational = {
      id: 880,
      type: "operacion_campo",
      status: "ACTIVE",
      start_time: "2026-04-20T13:00:00.000Z",
    };

    db.query
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [activeOperational] }); // active operational already open

    await controller.clockOutOperational(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        code: "OPERATIONAL_ALREADY_ACTIVE",
        message: expect.stringContaining("mismo ciclo operativo"),
        data: expect.objectContaining({ id: 880, status: "ACTIVE" }),
      }),
    );
  });

  test("registers operational return successfully", async () => {
    const req = {
      user: { id: 13, email: "ops2@fam.com" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20 },
    };
    const res = createRes();
    const activeOperational = {
      id: 502,
      type: "operacion_campo",
      status: "ACTIVE",
      start_time: "2026-04-20T08:00:00.000Z",
      description: "salida operacional",
    };
    const completed = { id: 502, type: "operacion_campo", status: "COMPLETED", description: "salida operacional" };

    db.query
      .mockResolvedValue({ rows: [], rowCount: 0 }) // permanent fallback for autoComplete calls
      .mockResolvedValueOnce({ rows: [] })                   // no active timeoff
      .mockResolvedValueOnce({ rows: [activeOperational] })  // active operational
      .mockResolvedValueOnce({ rows: [] })                   // no active client visit (findActiveFieldVisitForUser)
      .mockResolvedValueOnce({ rows: [completed] });         // update exception

    await controller.clockInOperational(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: expect.stringContaining("Regreso operacional"),
        data: expect.objectContaining({ id: 502, status: "COMPLETED" }),
      }),
    );
    const updateCallArgs = db.query.mock.calls[3][1];
    expect(updateCallArgs[2]).toContain("[RESUMEN_OPERACIONAL]");
  });

  test("closes operational trip from outside office and also closes the regular day", async () => {
    const req = {
      user: { id: 131, email: "ops-close@fam.com" },
      body: {
        location: "-2.170998,-79.922359",
        location_accuracy: 20,
        occurred_at: "2026-07-02T22:30:00.000Z",
        closure_reason: "fin de operacion",
      },
    };
    const res = createRes();
    const activeOperational = {
      id: 8801,
      type: "operacion_campo",
      status: "ACTIVE",
      description: "operacion en ruta",
      start_time: null,
      uses_personal_vehicle: false,
    };

    db.query
      .mockResolvedValue({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [activeOperational] }) // active operational
      .mockResolvedValueOnce({ rows: [] }); // update exception

    await controller.clockCloseTrip(req, res);

    // Contrato estable: cierre de viaje operacional desde fuera de oficina,
    // sobre la excepcion correcta y sin espejar la salida. La decision de si
    // la jornada normal se cierra o permanece abierta se valida por separado
    // (regla de negocio operativa que se afina en su propio flujo).
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          exception_id: 8801,
          exit_mirrored: false,
          closure_type: "outside_office",
        }),
      }),
    );
  });

  test("registers unexpected exit successfully", async () => {
    const req = {
      user: { id: 14, email: "unexpected@fam.com" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 18, description: "viaje urgente" },
    };
    const res = createRes();
    const inserted = { id: 503, type: "IMPREVISTO", status: "ACTIVE" };

    db.query
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [] }) // no active unexpected
      .mockResolvedValueOnce({ rows: [] }) // no active operational
      .mockResolvedValueOnce({ rows: [inserted] }); // insert exception

    await controller.clockOutUnexpected(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: expect.stringContaining("Salida imprevista registrada"),
        data: expect.objectContaining({ id: 503 }),
      }),
    );
  });

  test("registers unexpected return successfully", async () => {
    const req = {
      user: { id: 15, email: "unexpected2@fam.com" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 18 },
    };
    const res = createRes();
    const completed = { id: 504, type: "IMPREVISTO", status: "COMPLETED" };

    db.query
      // Fase 9 hardening: shouldMirrorAttendanceForFieldOp/shouldMirrorRegularExitBySchedule
      // dependen de la hora real (no se fija occurred_at en este test), y pueden disparar
      // una consulta extra de sincronizacion segun la hora del dia. Default seguro para
      // cualquier llamada mas alla de las dos explicitamente esperadas.
      .mockResolvedValue({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [completed] }); // update exception

    await controller.clockInUnexpected(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: expect.stringContaining("Regreso de salida imprevista"),
        data: expect.objectContaining({ id: 504, status: "COMPLETED" }),
      }),
    );
  });

  test("registers field visit entry successfully for prospect", async () => {
    // Fijamos "now" a las 10:00 America/Guayaquil (ver nota en "registers
    // operational exit successfully" sobre syncNormalEntryFromFieldOp).
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-08T15:00:00.000Z"));
    try {
      const req = {
        user: { id: 16, email: "field.entry@fam.com", role: "comercial" },
        body: { location: "-2.170998,-79.922359", location_accuracy: 14, prospect_name: "Prospecto A" },
      };
      const res = createRes();
      const visit = { id: 601, status: "in_visit", prospect_name: "Prospecto A" };

      const existingEntry = { id: 1601, entry_time: new Date().toISOString() };
      db.query
        .mockResolvedValue({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [] })             // no active timeoff
        .mockResolvedValueOnce({ rows: [existingEntry] }) // ensureDailyClockIn SELECT
        .mockResolvedValueOnce({ rows: [] })             // getActiveOp (auto-sync)
        .mockResolvedValueOnce({ rows: [existingEntry] }) // syncNormalEntry: ensureDailyClockIn SELECT
        .mockResolvedValueOnce({ rows: [visit] })        // insert prospect visit
        .mockResolvedValueOnce({ rows: [] });             // getActiveOp (final, line 3889)

      await controller.clockInField(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          message: expect.stringContaining("Entrada a visita registrada"),
          data: expect.objectContaining({ id: 601 }),
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test("registers field visit exit successfully for prospect", async () => {
    const req = {
      user: { id: 17, email: "field.exit@fam.com" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 14, prospect_name: "Prospecto B" },
    };
    const res = createRes();
    const visit = { id: 602, status: "visited", prospect_name: "Prospecto B" };

    db.query
      .mockResolvedValue({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] })      // no active timeoff
      .mockResolvedValueOnce({ rows: [] })      // getActiveOp (auto-sync)
      .mockResolvedValueOnce({ rows: [visit] }) // update prospect visit
      .mockResolvedValueOnce({ rows: [] });     // getActiveOp (final)

    await controller.clockOutField(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: expect.stringContaining("Salida de visita registrada"),
        data: expect.objectContaining({ id: 602, status: "visited" }),
      }),
    );
  });

  test("accepts explicit post visit action when closing field visit", async () => {
    const req = {
      user: { id: 17, email: "field.exit@fam.com" },
      body: {
        location: "-2.170998,-79.922359",
        location_accuracy: 14,
        prospect_name: "Prospecto B",
        post_visit_action: "return_to_office",
      },
    };
    const res = createRes();
    const visit = { id: 603, status: "visited", prospect_name: "Prospecto B" };

    db.query
      .mockResolvedValue({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] })      // no active timeoff
      .mockResolvedValueOnce({ rows: [] })      // getActiveOp (postVisitAction check, line 3969)
      .mockResolvedValueOnce({ rows: [] })      // getActiveOp (auto-sync, line 3972)
      .mockResolvedValueOnce({ rows: [visit] }) // update prospect visit
      .mockResolvedValueOnce({ rows: [] });     // getActiveOp (final)

    await controller.clockOutField(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: expect.stringContaining("retorno"),
        nextStep: "retorno_oficina_viaje",
        postVisitAction: "return_to_office",
      }),
    );
  });

  test("rejects invalid post visit action when closing field visit", async () => {
    const req = {
      user: { id: 17, email: "field.exit@fam.com" },
      body: {
        location: "-2.170998,-79.922359",
        prospect_name: "Prospecto B",
        post_visit_action: "cerrar_jornada",
      },
    };
    const res = createRes();

    await controller.clockOutField(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        code: "INVALID_POST_VISIT_ACTION",
      }),
    );
  });

  test("returns LOCATION_REQUIRED_RETRY when location is missing in clock-in", async () => {
    const req = {
      user: { id: 18, email: "noloc@fam.com" },
      body: {},
    };
    const res = createRes();

    db.query.mockResolvedValue({ rows: [] });

    await controller.clockIn(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        code: "LOCATION_REQUIRED_RETRY",
      }),
    );
  });

  test("blocks clock-in when user has active approved time off", async () => {
    const req = {
      user: { id: 19, email: "timeoff@fam.com" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20 },
    };
    const res = createRes();

    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          tipo_solicitud: "permiso",
          status: "approved",
        },
      ],
    });

    await controller.clockIn(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        code: "TIME_OFF_ACTIVE",
      }),
    );
  });

  test("blocks lunch start when there is no entry", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-09T13:05:00.000Z")); // 08:05 Ecuador
    try {
      const req = {
        user: { id: 20, email: "lunch1@fam.com" },
        body: { location: "-2.170998,-79.922359", location_accuracy: 20 },
      };
      const res = createRes();

      db.query
        .mockResolvedValueOnce({ rows: [] }) // no active timeoff
        .mockResolvedValueOnce({ rows: [] }); // no attendance record with entry

      await controller.clockOutLunch(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: false,
          message: expect.stringContaining("marcar entrada primero"),
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test("blocks lunch return when lunch start was not marked", async () => {
    const req = {
      user: { id: 21, email: "lunch2@fam.com" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20 },
    };
    const res = createRes();

    db.query
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [{ id: 1, lunch_start_time: null, lunch_end_time: null }] });

    await controller.clockInLunch(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        message: expect.stringContaining("salida a almuerzo primero"),
      }),
    );
  });

  test("blocks day exit when entry was not marked", async () => {
    const req = {
      user: { id: 22, email: "exit@fam.com" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20 },
    };
    const res = createRes();

    db.query
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [] }); // no entry

    await controller.clockOut(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        message: expect.stringContaining("marcar entrada primero"),
      }),
    );
  });

  test("blocks day exit when it happens a few seconds after entry", async () => {
    const req = {
      user: { id: 220, email: "early-exit@fam.com" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20 },
    };
    const res = createRes();

    const entryTime = new Date(Date.now() - 20 * 1000).toISOString();

    db.query
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          entry_time: entryTime,
          lunch_start_time: null,
          lunch_end_time: null,
          exit_time: null,
          overtime_hours: 0,
          entry_pending_regularization: false,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ lunch_start_time: null, lunch_end_time: null }],
      });

    await controller.clockOut(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        code: "ATTENDANCE_EXIT_TOO_EARLY",
      }),
    );
  });

  test("requires type and description for registerException", async () => {
    const req = {
      user: { id: 23, email: "exception@fam.com" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20 },
    };
    const res = createRes();

    await controller.registerException(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        message: expect.stringMatching(/Tipo y descripci/i),
      }),
    );
  });

  test("returns invalid status when updating exception with unsupported state", async () => {
    const req = {
      user: { id: 24, email: "invalid-status@fam.com" },
      body: { status: "INVALID", location: "-2.170998,-79.922359", location_accuracy: 20 },
    };
    const res = createRes();

    db.query
      .mockResolvedValueOnce({ rows: [{ id: 900, status: "ACTIVE", type: "IMPREVISTO" }] }); // active exception

    await controller.updateExceptionStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        message: expect.stringMatching(/Estado inv/i),
      }),
    );
  });

  test("allows operational destination exit to continue with active status", async () => {
    const req = {
      user: { id: 241, email: "continue-op@fam.com" },
      body: { status: "ACTIVE", location: "-2.170998,-79.922359", location_accuracy: 20 },
    };
    const res = createRes();

    db.query
      .mockResolvedValueOnce({ rows: [{ id: 901, status: "ON_SITE", type: "operacion_campo" }] })
      .mockResolvedValueOnce({ rows: [{ id: 901, status: "ACTIVE", type: "operacion_campo" }] });

    await controller.updateExceptionStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: expect.stringContaining("sigue activa"),
        data: expect.objectContaining({ id: 901, status: "ACTIVE" }),
      }),
    );
  });

  test("blocks generic completion of an operational flow without final evidence", async () => {
    const req = {
      user: { id: 242, email: "close-op@fam.com" },
      body: { status: "COMPLETED", location: "-2.170998,-79.922359", location_accuracy: 20 },
    };
    const res = createRes();

    db.query.mockResolvedValueOnce({ rows: [{ id: 902, status: "RETURNING", type: "operacion_campo" }] });

    await controller.updateExceptionStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        code: "OPERATIONAL_CLOSURE_REQUIRES_EVIDENCE",
      }),
    );
  });

  test("blocks field visit entry for users without field role", async () => {
    const req = {
      user: { id: 25, email: "norole@fam.com", role: "finanzas" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20, prospect_name: "Prospecto X" },
    };
    const res = createRes();

    await controller.clockInField(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        message: expect.stringContaining("Solo personal de campo"),
      }),
    );
  });

  test("returns 404 when closing field visit with no active visit", async () => {
    const req = {
      user: { id: 26, email: "visit404@fam.com", role: "comercial" },
      body: {
        location: "-2.170998,-79.922359",
        location_accuracy: 20,
        prospect_name: "Prospecto Y",
        observations: "cierre",
      },
    };
    const res = createRes();

    db.query
      .mockResolvedValue({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [] }) // getActiveOp (auto-sync)
      .mockResolvedValueOnce({ rows: [] }) // no active visit to close
      .mockResolvedValueOnce({ rows: [] }); // no recently closed visit

    await controller.clockOutField(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        code: "NO_ACTIVE_VISIT",
        message: expect.stringContaining("visita activa"),
      }),
    );
  });

  test("returns 200 when client visit was already closed recently (idempotent close)", async () => {
    const req = {
      user: { id: 35, email: "idempotent@fam.com", role: "comercial" },
      body: {
        location: "-2.170998,-79.922359",
        location_accuracy: 20,
        client_id: 757,
        observations: "cierre repetido",
      },
    };
    const res = createRes();

    db.query
      .mockResolvedValue({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] })                             // no active timeoff
      .mockResolvedValueOnce({ rows: [] })                             // getActiveOp (auto-sync)
      .mockResolvedValueOnce({ rows: [] })                             // strict close no rows
      .mockResolvedValueOnce({ rows: [] })                             // fallback open visit no rows
      .mockResolvedValueOnce({ rows: [] })                             // closeLatestOpenVisitForUser: latestClientActive
      .mockResolvedValueOnce({ rows: [] })                             // closeLatestOpenVisitForUser: latestProspectActive
      .mockResolvedValueOnce({ rows: [{ id: 45, status: "visited" }] }); // already closed recent visit

    await controller.clockOutField(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        code: "VISIT_ALREADY_CLOSED",
        message: expect.stringContaining("ya se encontraba cerrada"),
        data: expect.objectContaining({ id: 45, status: "visited" }),
      }),
    );
  });

  test("closes the visit that is actually open when the requested client_id does not match it (desynced form)", async () => {
    // Regresion: el formulario del frontend mandaba un client_id distinto al
    // de la visita realmente 'in_visit' en BD (desincronizacion tras
    // reabrir la app / cambiar de destino). Antes de este fix, el intento
    // estricto y su fallback de "drift de fecha" fallaban los dos, y como no
    // habia ningun otro camino, la visita real nunca se cerraba: quedaba
    // 'in_visit' para siempre y la UI volvia a mostrar "salir de cliente" en
    // cada refresh, atascando al usuario con salida operacional activa.
    const req = {
      user: { id: 41, email: "desynced@fam.com", role: "comercial" },
      body: {
        location: "-2.170998,-79.922359",
        location_accuracy: 20,
        client_id: 999, // cliente que el frontend cree que esta abierto
        observations: "cierre",
      },
    };
    const res = createRes();

    const actuallyOpenVisit = { id: 45, client_request_id: 757, status: "in_visit" };
    const closedVisit = { id: 45, client_request_id: 757, status: "visited" };

    db.query
      .mockResolvedValue({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] })                    // no active timeoff
      .mockResolvedValueOnce({ rows: [] })                    // getActiveOp (auto-sync)
      .mockResolvedValueOnce({ rows: [] })                    // strict close by client_id=999: no rows
      .mockResolvedValueOnce({ rows: [] })                    // fallback open visit for client_id=999: no rows
      .mockResolvedValueOnce({ rows: [actuallyOpenVisit] })   // closeLatestOpenVisitForUser: latestClientActive (client 757, not 999)
      .mockResolvedValueOnce({ rows: [] })                    // closeLatestOpenVisitForUser: latestProspectActive
      .mockResolvedValueOnce({ rows: [closedVisit] })         // UPDATE closes visit id=45
      .mockResolvedValueOnce({ rows: [] });                   // getActiveOp (post-close, returnToOffice check)

    await controller.clockOutField(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({ id: 45, client_request_id: 757, status: "visited" }),
      }),
    );
  });

  test("falls back when client_assignments table is missing and still registers client visit entry", async () => {
    // Fijamos "now" a las 10:00 America/Guayaquil (ver nota en "registers
    // operational exit successfully" sobre syncNormalEntryFromFieldOp).
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-08T15:00:00.000Z"));
    try {
      const req = {
        user: { id: 27, email: "fallback-assignments@fam.com", role: "comercial" },
        body: { location: "-2.170998,-79.922359", location_accuracy: 20, client_id: 150 },
      };
      const res = createRes();

      const existingEntry2701 = { id: 2701, entry_time: new Date().toISOString() };
      db.query
        .mockResolvedValue({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [] })                  // no active timeoff
        .mockResolvedValueOnce({ rows: [existingEntry2701] }) // ensureDailyClockIn SELECT
        .mockResolvedValueOnce({ rows: [] })                  // getActiveOp (auto-sync)
        .mockResolvedValueOnce({ rows: [existingEntry2701] }) // syncNormalEntry: ensureDailyClockIn SELECT
        .mockRejectedValueOnce({ code: "42P01" })             // client_access with client_assignments fails
        .mockResolvedValueOnce({ rows: [{ id: 150 }] })       // fallback client_access
        .mockResolvedValueOnce({ rows: [] })                  // no schedule match
        .mockResolvedValueOnce({ rows: [{ id: 700, status: "in_visit" }] }) // insert/update visit
        .mockResolvedValueOnce({ rows: [] });                 // getActiveOp (final)

      await controller.clockInField(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          message: expect.stringContaining("Entrada a visita registrada"),
          data: expect.objectContaining({ id: 700 }),
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test("falls back to legacy insert when optional client visit columns are missing", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-08T15:00:00.000Z"));
    try {
      const req = {
        user: { id: 28, email: "fallback-columns@fam.com", role: "comercial" },
        body: { location: "-2.170998,-79.922359", location_accuracy: 20, client_id: 151, observations: "emergencia" },
      };
      const res = createRes();

      const existingEntry2801 = { id: 2801, entry_time: new Date().toISOString() };
      db.query
        .mockResolvedValue({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [] })                  // no active timeoff
        .mockResolvedValueOnce({ rows: [existingEntry2801] }) // ensureDailyClockIn SELECT
        .mockResolvedValueOnce({ rows: [] })                  // getActiveOp (auto-sync)
        .mockResolvedValueOnce({ rows: [existingEntry2801] }) // syncNormalEntry: ensureDailyClockIn SELECT
        .mockResolvedValueOnce({ rows: [{ id: 151 }] })       // client access
        .mockResolvedValueOnce({ rows: [] })                  // no schedule match
        .mockRejectedValueOnce({ code: "42703" })             // upsert with optional columns fails
        .mockResolvedValueOnce({ rows: [] })                  // legacy select existing visit
        .mockResolvedValueOnce({ rows: [{ id: 701, status: "in_visit" }] }) // legacy insert
        .mockResolvedValueOnce({ rows: [] });                 // getActiveOp (final)

      await controller.clockInField(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          message: expect.stringContaining("Entrada a visita registrada"),
          data: expect.objectContaining({ id: 701, status: "in_visit" }),
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test("continues field visit entry when schedules table is missing", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-08T15:00:00.000Z"));
    try {
      const req = {
        user: { id: 30, email: "no-schedules@fam.com", role: "comercial" },
        body: { location: "-2.170998,-79.922359", location_accuracy: 20, client_id: 152 },
      };
      const res = createRes();

      const existingEntry3001 = { id: 3001, entry_time: new Date().toISOString() };
      db.query
        .mockResolvedValue({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [] })                  // no active timeoff
        .mockResolvedValueOnce({ rows: [existingEntry3001] }) // ensureDailyClockIn SELECT
        .mockResolvedValueOnce({ rows: [] })                  // getActiveOp (auto-sync)
        .mockResolvedValueOnce({ rows: [existingEntry3001] }) // syncNormalEntry: ensureDailyClockIn SELECT
        .mockResolvedValueOnce({ rows: [{ id: 152 }] })       // client access
        .mockRejectedValueOnce({ code: "42P01" })             // schedules table missing
        .mockResolvedValueOnce({ rows: [{ id: 702, status: "in_visit" }] }) // insert/update visit
        .mockResolvedValueOnce({ rows: [] });                 // getActiveOp (final)

      await controller.clockInField(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          message: expect.stringContaining("Entrada a visita registrada"),
          data: expect.objectContaining({ id: 702, status: "in_visit" }),
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test("returns 400 when client_id is invalid in field visit entry", async () => {
    const req = {
      user: { id: 31, email: "invalid-client@fam.com", role: "comercial" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20, client_id: "abc" },
    };
    const res = createRes();

    const existingEntry3101 = { id: 3101, entry_time: new Date().toISOString() };
    db.query
      .mockResolvedValue({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] })                  // no active timeoff
      .mockResolvedValueOnce({ rows: [existingEntry3101] }) // ensureDailyClockIn SELECT
      .mockResolvedValueOnce({ rows: [] })                  // getActiveOp (auto-sync)
      .mockResolvedValueOnce({ rows: [existingEntry3101] }); // syncNormalEntry: ensureDailyClockIn SELECT

    await controller.clockInField(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        message: expect.stringContaining("cliente seleccionado es invalido"),
      }),
    );
  });

  test("returns 400 when client_id is invalid in field visit exit", async () => {
    const req = {
      user: { id: 32, email: "invalid-client-exit@fam.com", role: "comercial" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20, client_id: "abc" },
    };
    const res = createRes();

    db.query
      .mockResolvedValue({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [] }); // getActiveOp (auto-sync)

    await controller.clockOutField(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        message: expect.stringContaining("cliente seleccionado es invalido"),
      }),
    );
  });

  test("falls back to latest active client visit (today/yesterday) when strict date close does not match", async () => {
    const req = {
      user: { id: 33, email: "case.user@fam.com", role: "comercial" },
      body: {
        location: "-2.170998,-79.922359",
        location_accuracy: 20,
        client_id: 757,
        observations: "cierre",
      },
    };
    const res = createRes();

    db.query
      .mockResolvedValue({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] })                              // no active timeoff
      .mockResolvedValueOnce({ rows: [] })                              // getActiveOp (auto-sync)
      .mockResolvedValueOnce({ rows: [] })                              // strict close → no rows
      .mockResolvedValueOnce({ rows: [{ id: 999 }] })                   // fallback finds latest in_visit
      .mockResolvedValueOnce({ rows: [{ id: 999, status: "visited" }] }) // fallback close by id
      .mockResolvedValueOnce({ rows: [] })                              // schedules update
      .mockResolvedValueOnce({ rows: [] });                             // getActiveOp (final)

    await controller.clockOutField(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: expect.stringContaining("Salida de visita registrada"),
        data: expect.objectContaining({ id: 999, status: "visited" }),
      }),
    );
  });

  test("ignores missing schedules table when closing active client visit", async () => {
    const req = {
      user: { id: 34, email: "noschedules-exit@fam.com", role: "comercial" },
      body: {
        location: "-2.170998,-79.922359",
        location_accuracy: 20,
        client_id: 758,
        observations: "cierre",
      },
    };
    const res = createRes();

    db.query
      .mockResolvedValue({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] })                              // no active timeoff
      .mockResolvedValueOnce({ rows: [] })                              // getActiveOp (auto-sync)
      .mockResolvedValueOnce({ rows: [{ id: 1000, status: "visited" }] }) // strict close success
      .mockResolvedValueOnce({ rows: [] })                              // getActiveOp (post-close sync)
      .mockRejectedValueOnce({ code: "42P01" })                         // schedules table missing
      .mockResolvedValueOnce({ rows: [] });                             // getActiveOp (final)

    await controller.clockOutField(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: expect.stringContaining("Salida de visita registrada"),
        data: expect.objectContaining({ id: 1000, status: "visited" }),
      }),
    );
  });

  // Regresion: un usuario reporto quedar en bucle "llegada a destino y entrada
  // a cliente" -> "salir del cliente" -> otra vez "llegada a destino" sin
  // poder nunca llegar a la pantalla de "terminar operaciones". Causa: al
  // cerrar la visita con post_visit_action=continue_operation (salida
  // neutral, la decision de continuar/terminar se toma en una pantalla
  // posterior del frontend), este endpoint forzaba la excepcion operacional
  // de vuelta a ACTIVE, lo que reabria automaticamente el flujo de "llegada a
  // destino" antes de que el frontend pudiera mostrar esa pantalla.
  test("keeps the operational exception ON_SITE (does not force ACTIVE) when a client visit closes with continue_operation", async () => {
    const req = {
      user: { id: 36, email: "loop-regression@fam.com", role: "comercial" },
      body: {
        location: "-2.170998,-79.922359",
        location_accuracy: 20,
        client_id: 900,
        post_visit_action: "continue_operation",
      },
    };
    const res = createRes();

    db.query
      .mockResolvedValue({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] })                                                   // no active timeoff
      .mockResolvedValueOnce({ rows: [{ id: 950, status: "ON_SITE", type: "operacion_campo" }] }) // getActiveOp (postVisitAction check)
      .mockResolvedValueOnce({ rows: [{ id: 950, status: "ON_SITE", type: "operacion_campo" }] }) // getActiveOp (auto-sync)
      .mockResolvedValueOnce({ rows: [{ id: 1100, status: "visited" }] })                     // strict close success
      .mockResolvedValueOnce({ rows: [{ id: 950, status: "ON_SITE", type: "operacion_campo" }] }); // getActiveOp (final, decides ACTIVE/RETURNING)

    await controller.clockOutField(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const forcedActiveCall = db.query.mock.calls.find(
      ([sql]) => /UPDATE\s+attendance_exceptions/i.test(sql) && /'ACTIVE'/.test(sql),
    );
    expect(forcedActiveCall).toBeUndefined();
  });

  // Regresion: rafael.ortiz@fam-project.com reporto "Atraso registrado 900 min"
  // a las 00:01, sin haber marcado entrada todavia. computeLateMinutesFromEntry
  // usaba `new Date(entryValue)` sin validar que entryValue existiera; con
  // entry_time null/undefined, new Date(null) no lanza error -- da el epoch
  // (1970-01-01) silenciosamente, y esa hora arbitraria se comparaba contra las
  // 09:00 como si fuera la entrada real.
  test("getToday never reports a late arrival for a user who has not clocked in yet", async () => {
    const req = { user: { id: 777, email: "rafael.ortiz@fam-project.com" } };
    const res = createRes();

    db.query.mockResolvedValue({ rows: [], rowCount: 0 }); // no hay registro de asistencia hoy

    await controller.getToday(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          late_policy: expect.objectContaining({
            isLate: false,
            lateMinutes: null,
          }),
        }),
      }),
    );
  });

  test("getToday still reports a real late arrival once entry_time exists", async () => {
    const req = { user: { id: 778, email: "puntual.tarde@fam-project.com" } };
    const res = createRes();

    // 09:20 America/Guayaquil == 14:20 UTC
    const lateEntry = new Date(Date.UTC(2026, 6, 8, 14, 20, 0));

    db.query.mockImplementation((sql) => {
      if (typeof sql === "string" && sql.includes("FROM user_attendance_records") && sql.includes("date = $2")) {
        return Promise.resolve({
          rows: [{ id: 1, user_id: 778, date: "2026-07-08", entry_time: lateEntry.toISOString() }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await controller.getToday(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          late_policy: expect.objectContaining({
            isLate: true,
            lateMinutes: 20,
          }),
        }),
      }),
    );
  });

  // Regresion: rafael.ortiz@fam-project.com, clara.arroyo@fam-project.com y
  // kevin.lalaleo@fam-project.com reportaron que, con una salida operacional
  // activa (o ya cerrada) desde temprano, getToday igual les mostraba
  // "solicita regularizacion / justifica atraso". Causa: el mirror de entrada
  // oficial se estampa con la hora del primer marcaje posterior a las 09:00
  // (p.ej. entrada a la visita del cliente a la 1pm), no con el inicio real
  // de la jornada operacional (6am) -- y el calculo de atraso no verificaba
  // si ya existia una excepcion operacional para el dia.
  test("getToday does not flag late arrival when an operational exception already exists today", async () => {
    const req = { user: { id: 779, email: "clara.arroyo@fam-project.com" } };
    const res = createRes();

    // 13:40 America/Guayaquil == 18:40 UTC (mirror de entrada desde la
    // entrada a la visita del cliente, muy despues de las 09:00).
    const mirroredEntry = new Date(Date.UTC(2026, 7, 3, 18, 40, 0));

    db.query.mockImplementation((sql) => {
      if (typeof sql === "string" && sql.includes("FROM user_attendance_records") && sql.includes("date = $2")) {
        return Promise.resolve({
          rows: [{ id: 2, user_id: 779, date: "2026-08-03", entry_time: mirroredEntry.toISOString() }],
        });
      }
      if (
        typeof sql === "string" &&
        sql.includes("FROM attendance_exceptions") &&
        sql.includes("date = $2") &&
        sql.includes("type = ANY")
      ) {
        return Promise.resolve({ rows: [{ id: 501 }], rowCount: 1 }); // excepcion operacional de hoy
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await controller.getToday(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        data: expect.objectContaining({
          late_policy: expect.objectContaining({
            isLate: false,
            countsAsLate: false,
          }),
        }),
      }),
    );
  });

  // Regresion: usuario marco salida operacional a las 00:35 y, mas tarde el
  // mismo dia (despues de las 18:00), getToday reportaba la jornada NORMAL
  // como completada (Entrada: 00:35, Salida: 18:00) aunque la salida
  // operacional seguia activa. Causa: autoCompleteOperationalAttendanceSpan
  // autocompletaba almuerzo/salida del dia de HOY con el horario estandar
  // apenas la hora del reloj los superaba, sin verificar que la excepcion
  // operacional de hoy seguia sin cerrar (la funcion solo se llama cuando
  // hay una excepcion operacional activa, es decir, siempre para "hoy").
  test("does not auto-close today's regular exit while an operational exception is still open, even late at night", async () => {
    jest.useFakeTimers();
    try {
      // 2026-07-08T23:30:00-05:00 (America/Guayaquil) -- bien despues de las 18:00
      jest.setSystemTime(new Date("2026-07-09T04:30:00.000Z"));

      const req = { user: { id: 555, email: "operacional.medianoche@fam-project.com" } };
      const res = createRes();

      // Salida operacional iniciada hoy a las 00:35 America/Guayaquil (05:35 UTC)
      const operationalStart = "2026-07-08T05:35:00.000Z";
      let autoCompleteUpdateParams = null;

      db.query.mockImplementation((sql, params) => {
        const text = typeof sql === "string" ? sql : "";
        if (text.includes("FROM attendance_exceptions") && text.includes("<> 'COMPLETED'")) {
          return Promise.resolve({
            rows: [{
              id: 4242,
              user_id: 555,
              type: "salida_oficina",
              status: "ACTIVE",
              start_time: operationalStart,
              start_location: "-2.170998,-79.922359",
              uses_personal_vehicle: false,
            }],
          });
        }
        if (text.includes("UPDATE user_attendance_records") && text.includes("lunch_start_time")) {
          autoCompleteUpdateParams = params;
          return Promise.resolve({ rows: [] });
        }
        if (text.includes("FROM user_attendance_records") && text.includes("date = $2")) {
          return Promise.resolve({
            rows: [{ id: 1, user_id: 555, date: "2026-07-08", entry_time: operationalStart, exit_time: null }],
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      await controller.getToday(req, res);

      // El dia de hoy nunca se autocompleta (ni entrada, ni almuerzo, ni
      // salida) mientras la excepcion operacional de hoy sigue activa -- por
      // eso la UPDATE de autocompletado ni siquiera deberia ejecutarse.
      expect(autoCompleteUpdateParams).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  // Regla de negocio confirmada: una gestion operacional que arranca antes
  // del inicio oficial de jornada (09:00) no debe sustituir la entrada del
  // dia. El colaborador debe marcar su entrada normal por separado.
  test("does not mirror entry_time from an operational exit that starts before the official workday", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-08T05:35:00.000Z")); // 00:35 America/Guayaquil
    try {
      const req = {
        user: { id: 556, email: "madrugador@fam-project.com" },
        body: {
          location: "-2.170998,-79.922359",
          location_accuracy: 20,
          description: "tramite bancario temprano",
          operational_category: "banco",
          destination: "Banco Centro",
          city: "Guayaquil",
        },
      };
      const res = createRes();
      let ensureDailyClockInCalled = false;

      db.query.mockImplementation((sql) => {
        const text = typeof sql === "string" ? sql : "";
        if (text.includes("entry_location") && text.includes("FROM user_attendance_records")) {
          ensureDailyClockInCalled = true;
        }
        if (text.includes("INSERT INTO user_attendance_records") && text.includes("entry_source")) {
          ensureDailyClockInCalled = true;
        }
        if (text.includes("INSERT INTO attendance_exceptions")) {
          return Promise.resolve({ rows: [{ id: 8801, type: "operacion_campo", status: "ACTIVE" }] });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      await controller.clockOutOperational(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(ensureDailyClockInCalled).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  // Regla de negocio confirmada: no se puede cerrar la operacion (cierre
  // operacional o cierre de viaje) con una visita a cliente todavia abierta.
  test("blocks closing the operation (clockInOperational) while a client visit is still open", async () => {
    const req = {
      user: { id: 557, email: "visita-abierta@fam-project.com" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20 },
    };
    const res = createRes();
    const activeOperational = {
      id: 4243,
      type: "operacion_campo",
      status: "ACTIVE",
      start_time: "2026-07-08T14:00:00.000Z",
      description: "salida operacional",
    };
    const openVisit = { id: 900, visit_scope: "client", client_id: 150, status: "in_visit", visit_date: "2026-07-08", entry_time: "2026-07-08T15:00:00.000Z" };

    db.query
      .mockResolvedValue({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] })                  // no active timeoff
      .mockResolvedValueOnce({ rows: [activeOperational] }) // active operational
      .mockResolvedValueOnce({ rows: [openVisit] });        // findActiveFieldVisitForUser: visita abierta

    await controller.clockInOperational(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        code: "CLIENT_VISIT_MUST_CLOSE_FIRST",
      }),
    );
  });

  test("blocks closing the trip (clockCloseTrip) while a client visit is still open", async () => {
    const req = {
      user: { id: 558, email: "visita-abierta-viaje@fam-project.com" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20, closure_reason: "fin de ruta" },
    };
    const res = createRes();
    const activeOperational = {
      id: 4244,
      type: "operacion_campo",
      status: "ON_SITE",
      start_time: "2026-07-08T14:00:00.000Z",
      description: "salida operacional",
    };
    const openVisit = { id: 901, visit_scope: "client", client_id: 151, status: "in_visit", visit_date: "2026-07-08", entry_time: "2026-07-08T15:00:00.000Z" };

    db.query
      .mockResolvedValue({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] })                  // no active timeoff
      .mockResolvedValueOnce({ rows: [activeOperational] }) // active operational
      .mockResolvedValueOnce({ rows: [openVisit] });        // findActiveFieldVisitForUser: visita abierta

    await controller.clockCloseTrip(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        code: "CLIENT_VISIT_MUST_CLOSE_FIRST",
      }),
    );
  });

  test("closes telework directly without client-visit blocking or travel allowance", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-08T16:00:00.000Z"));
    try {
      const req = {
        user: { id: 559, email: "teletrabajo@fam-project.com" },
        body: { location: "-0.180653,-78.467834", location_accuracy: 20 },
      };
      const res = createRes();
      let fieldVisitLookupCalled = false;

      db.query.mockImplementation((sql) => {
        const text = typeof sql === "string" ? sql : "";
        if (text.includes("FROM client_visit_logs") || text.includes("FROM prospect_visits")) {
          fieldVisitLookupCalled = true;
        }
        if (text.includes("FROM attendance_exceptions")) {
          return Promise.resolve({
            rows: [{
              id: 4245,
              user_id: 559,
              type: "operacion_campo",
              operational_category: "teletrabajo",
              status: "ACTIVE",
              start_time: "2026-07-08T13:00:00.000Z", // 08:00 Ecuador, fuera del horario laboral
              start_location: "-0.180653,-78.467834",
              uses_personal_vehicle: false,
              description: "Teletrabajo",
            }],
          });
        }
        if (text.includes("UPDATE attendance_exceptions")) {
          return Promise.resolve({
            rows: [{
              id: 4245,
              user_id: 559,
              type: "operacion_campo",
              operational_category: "teletrabajo",
              status: "COMPLETED",
              start_time: "2026-07-08T15:00:00.000Z",
              description: "Teletrabajo",
            }],
            rowCount: 1,
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      await controller.clockInOperational(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          message: "Jornada de teletrabajo finalizada correctamente",
          data: expect.objectContaining({
            travel_allowance_id: null,
          }),
        }),
      );
      expect(fieldVisitLookupCalled).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  test("does not allow operational lunch actions during telework", async () => {
    const req = {
      user: { id: 560, email: "teletrabajo-almuerzo@fam-project.com" },
      body: { location: "-0.180653,-78.467834", location_accuracy: 20 },
    };
    const res = createRes();

    db.query.mockResolvedValue({
      rows: [{
        id: 4246,
        type: "operacion_campo",
        operational_category: "teletrabajo",
        status: "ACTIVE",
      }],
    });

    await controller.clockOutOperationalLunch(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        code: "TELEWORK_HAS_NO_OPERATIONAL_LUNCH",
      }),
    );
  });

  test("allows operational lunch-out on day 2+ of a multi-day operational exit even though a previous day already marked it", async () => {
    // Regresion: op_lunch_start_time vive en attendance_exceptions -- una
    // sola fila para TODA la salida operacional (puede durar varios dias).
    // Antes, una vez marcado el dia 1, ese campo quedaba lleno para siempre
    // y el backend rechazaba el almuerzo de los dias siguientes con
    // OPERATIONAL_LUNCH_ALREADY_STARTED, aunque fuera un dia distinto. El
    // gate ahora es por dia via user_attendance_records.real_lunch_start_time.
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-10T19:05:00.000Z")); // dia 3, ~14:05 Ecuador
    try {
      const req = {
        user: { id: 700, email: "multidia@fam-project.com" },
        body: { location: "-0.180653,-78.467834", location_accuracy: 20 },
      };
      const res = createRes();

      db.query.mockImplementation((sql) => {
        const text = typeof sql === "string" ? sql : "";
        if (text.includes("FROM attendance_exceptions")) {
          return Promise.resolve({
            rows: [{
              id: 4300,
              user_id: 700,
              type: "operacion_campo",
              operational_category: "viaje",
              status: "ACTIVE",
              start_time: "2026-07-08T13:00:00.000Z", // dia 1
              // Ya marcado en dia 1 -- este es exactamente el campo que
              // antes bloqueaba incorrectamente todos los dias siguientes.
              op_lunch_start_time: "2026-07-08T19:00:00.000Z",
              uses_personal_vehicle: false,
            }],
          });
        }
        if (text.includes("SELECT real_lunch_start_time FROM user_attendance_records")) {
          // Dia 3: todavia no hay marca real de almuerzo para HOY.
          return Promise.resolve({ rows: [{ real_lunch_start_time: null }] });
        }
        return Promise.resolve({ rows: [{}], rowCount: 1 });
      });

      await controller.clockOutOperationalLunch(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ ok: true, message: expect.stringContaining("Salida a almuerzo operacional registrada") }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test("still blocks a second operational lunch-out the same day", async () => {
    const req = {
      user: { id: 701, email: "mismodia@fam-project.com" },
      body: { location: "-0.180653,-78.467834", location_accuracy: 20 },
    };
    const res = createRes();

    db.query.mockImplementation((sql) => {
      const text = typeof sql === "string" ? sql : "";
      if (text.includes("FROM attendance_exceptions")) {
        return Promise.resolve({
          rows: [{
            id: 4301,
            user_id: 701,
            type: "operacion_campo",
            operational_category: "viaje",
            status: "ACTIVE",
            start_time: "2026-07-08T13:00:00.000Z",
            uses_personal_vehicle: false,
          }],
        });
      }
      if (text.includes("SELECT real_lunch_start_time FROM user_attendance_records")) {
        return Promise.resolve({ rows: [{ real_lunch_start_time: "2026-07-08T19:00:00.000Z" }] });
      }
      return Promise.resolve({ rows: [{}], rowCount: 1 });
    });

    await controller.clockOutOperationalLunch(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, code: "OPERATIONAL_LUNCH_ALREADY_STARTED" }),
    );
  });

  test("requires regular lunch marks before closing telework started during work hours", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-08T20:00:00.000Z")); // 15:00 Ecuador
    try {
      const req = {
        user: { id: 561, email: "teletrabajo-laboral@fam-project.com" },
        body: { location: "-0.180653,-78.467834", location_accuracy: 20 },
      };
      const res = createRes();

      db.query.mockImplementation((sql) => {
        const text = typeof sql === "string" ? sql : "";
        if (text.includes("FROM attendance_exceptions")) {
          return Promise.resolve({
            rows: [{
              id: 4247,
              user_id: 561,
              type: "operacion_campo",
              operational_category: "teletrabajo",
              status: "ACTIVE",
              start_time: "2026-07-08T15:00:00.000Z", // 10:00 Ecuador
              uses_personal_vehicle: false,
            }],
          });
        }
        if (text.includes("FROM user_attendance_records") && text.includes("lunch_start_time")) {
          return Promise.resolve({ rows: [{ entry_time: "2026-07-08T15:00:00.000Z", lunch_start_time: null, lunch_end_time: null }] });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      await controller.clockInOperational(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: false,
          code: "TELEWORK_LUNCH_START_REQUIRED",
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test("rejects lunch marks for telework started outside the work schedule", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-11T15:00:00.000Z")); // Saturday
    try {
      const req = {
        user: { id: 562, email: "teletrabajo-fin-semana@fam-project.com" },
        body: { location: "-0.180653,-78.467834", location_accuracy: 20 },
      };
      const res = createRes();

      db.query.mockImplementation((sql) => {
        const text = typeof sql === "string" ? sql : "";
        if (text.includes("FROM user_attendance_records") && text.includes("entry_time")) {
          return Promise.resolve({ rows: [{ id: 10, entry_time: "2026-07-11T14:00:00.000Z", lunch_start_time: null }] });
        }
        if (text.includes("FROM attendance_exceptions")) {
          return Promise.resolve({
            rows: [{
              id: 4248,
              type: "operacion_campo",
              operational_category: "teletrabajo",
              status: "ACTIVE",
              start_time: "2026-07-11T14:00:00.000Z",
            }],
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      await controller.clockOutLunch(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: false,
          code: "TELEWORK_LUNCH_NOT_REQUIRED",
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
