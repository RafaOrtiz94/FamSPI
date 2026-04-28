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
      body: { location: "-2.170998,-79.922359", location_accuracy: 25, description: "visita no planificada" },
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
    const req = {
      user: { id: 12, email: "ops@fam.com" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20, description: "salida oficina" },
    };
    const res = createRes();
    const inserted = { id: 501, type: "operacion_campo", status: "ACTIVE" };

    db.query
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [] }) // no active operational
      .mockResolvedValueOnce({ rows: [] }) // no active unexpected
      .mockResolvedValueOnce({ rows: [inserted] }); // insert exception

    await controller.clockOutOperational(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: expect.stringContaining("Salida operacional registrada"),
        data: expect.objectContaining({ id: 501 }),
      }),
    );
  });

  test("returns operational cycle as active when user starts it again on another day", async () => {
    const req = {
      user: { id: 120, email: "ops-repeat@fam.com" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20, description: "seguimiento multi-dia" },
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
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [activeOperational] }) // active operational
      .mockResolvedValueOnce({ rows: [completed] }); // update exception

    await controller.clockInOperational(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: expect.stringContaining("Regreso operacional"),
        data: expect.objectContaining({ id: 502, status: "COMPLETED" }),
      }),
    );
    const updateCallArgs = db.query.mock.calls[2][1];
    expect(updateCallArgs[2]).toContain("[RESUMEN_OPERACIONAL]");
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
    const req = {
      user: { id: 16, email: "field.entry@fam.com", role: "comercial" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 14, prospect_name: "Prospecto A" },
    };
    const res = createRes();
    const visit = { id: 601, status: "in_visit", prospect_name: "Prospecto A" };

    db.query
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [{ id: 1601, entry_time: new Date().toISOString() }] }) // ensure daily clock-in
      .mockResolvedValueOnce({ rows: [visit] }) // insert prospect visit
      .mockResolvedValueOnce({ rows: [] }); // no active operational flow

    await controller.clockInField(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: expect.stringContaining("Entrada a visita registrada"),
        data: expect.objectContaining({ id: 601 }),
      }),
    );
  });

  test("registers field visit exit successfully for prospect", async () => {
    const req = {
      user: { id: 17, email: "field.exit@fam.com" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 14, prospect_name: "Prospecto B" },
    };
    const res = createRes();
    const visit = { id: 602, status: "visited", prospect_name: "Prospecto B" };

    db.query
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [visit] }) // update prospect visit
      .mockResolvedValueOnce({ rows: [] }); // no active operational flow

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
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
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
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [] }) // strict close no rows
      .mockResolvedValueOnce({ rows: [] }) // fallback open visit no rows
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

  test("falls back when client_assignments table is missing and still registers client visit entry", async () => {
    const req = {
      user: { id: 27, email: "fallback-assignments@fam.com", role: "comercial" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20, client_id: 150 },
    };
    const res = createRes();

    db.query
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [{ id: 2701, entry_time: new Date().toISOString() }] }) // ensure daily clock-in
      .mockRejectedValueOnce({ code: "42P01" }) // client_access query with client_assignments fails
      .mockResolvedValueOnce({ rows: [{ id: 150 }] }) // fallback client_access query
      .mockResolvedValueOnce({ rows: [] }) // no schedule match
      .mockResolvedValueOnce({ rows: [{ id: 700, status: "in_visit" }] }) // insert/update visit
      .mockResolvedValueOnce({ rows: [] }); // no active operational flow

    await controller.clockInField(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: expect.stringContaining("Entrada a visita registrada"),
        data: expect.objectContaining({ id: 700 }),
      }),
    );
  });

  test("falls back to legacy insert when optional client visit columns are missing", async () => {
    const req = {
      user: { id: 28, email: "fallback-columns@fam.com", role: "comercial" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20, client_id: 151, observations: "emergencia" },
    };
    const res = createRes();

    db.query
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [{ id: 2801, entry_time: new Date().toISOString() }] }) // ensure daily clock-in
      .mockResolvedValueOnce({ rows: [{ id: 151 }] }) // client access
      .mockResolvedValueOnce({ rows: [] }) // no schedule match
      .mockRejectedValueOnce({ code: "42703" }) // upsert with optional columns fails
      .mockResolvedValueOnce({ rows: [] }) // legacy select existing visit
      .mockResolvedValueOnce({ rows: [{ id: 701, status: "in_visit" }] }) // legacy insert
      .mockResolvedValueOnce({ rows: [] }); // no active operational flow

    await controller.clockInField(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: expect.stringContaining("Entrada a visita registrada"),
        data: expect.objectContaining({ id: 701, status: "in_visit" }),
      }),
    );
  });

  test("continues field visit entry when schedules table is missing", async () => {
    const req = {
      user: { id: 30, email: "no-schedules@fam.com", role: "comercial" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20, client_id: 152 },
    };
    const res = createRes();

    db.query
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [{ id: 3001, entry_time: new Date().toISOString() }] }) // ensure daily clock-in
      .mockResolvedValueOnce({ rows: [{ id: 152 }] }) // client access
      .mockRejectedValueOnce({ code: "42P01" }) // schedules table missing
      .mockResolvedValueOnce({ rows: [{ id: 702, status: "in_visit" }] }) // insert/update visit
      .mockResolvedValueOnce({ rows: [] }); // no active operational flow

    await controller.clockInField(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: expect.stringContaining("Entrada a visita registrada"),
        data: expect.objectContaining({ id: 702, status: "in_visit" }),
      }),
    );
  });

  test("returns 400 when client_id is invalid in field visit entry", async () => {
    const req = {
      user: { id: 31, email: "invalid-client@fam.com", role: "comercial" },
      body: { location: "-2.170998,-79.922359", location_accuracy: 20, client_id: "abc" },
    };
    const res = createRes();

    db.query
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [{ id: 3101, entry_time: new Date().toISOString() }] }); // ensure daily clock-in

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

    db.query.mockResolvedValueOnce({ rows: [] }); // no active timeoff

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
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [] }) // strict close by today -> no rows
      .mockResolvedValueOnce({ rows: [{ id: 999 }] }) // fallback finds latest in_visit
      .mockResolvedValueOnce({ rows: [{ id: 999, status: "visited" }] }) // fallback close by id
      .mockResolvedValueOnce({ rows: [] }) // schedules update
      .mockResolvedValueOnce({ rows: [] }); // no active operational flow

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
      .mockResolvedValueOnce({ rows: [] }) // no active timeoff
      .mockResolvedValueOnce({ rows: [{ id: 1000, status: "visited" }] }) // strict close success
      .mockRejectedValueOnce({ code: "42P01" }) // schedules table missing
      .mockResolvedValueOnce({ rows: [] }); // no active operational flow

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
});
