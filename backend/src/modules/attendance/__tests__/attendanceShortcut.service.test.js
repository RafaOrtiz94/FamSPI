process.env.SECRET_KEY = process.env.SECRET_KEY || "test-secret";

jest.mock("../../../config/logger", () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

jest.mock("../../../config/security", () => ({
  FRONTEND_URL: "https://fam-spi-front.web.app",
}));

jest.mock("../../../config/db", () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
}));

jest.mock("../attendanceShortcutTokens.repository", () => ({
  recordIssuedToken: jest.fn().mockResolvedValue(undefined),
  isTokenRevoked: jest.fn().mockResolvedValue(false),
  listTokensForUser: jest.fn().mockResolvedValue([]),
  revokeTokenById: jest.fn().mockResolvedValue(null),
}));

// Handlers reales reemplazados por mocks: el servicio solo hace dispatch.
jest.mock("../attendance.controller", () => ({
  getToday: jest.fn(),
  clockIn: jest.fn(),
  clockOutLunch: jest.fn(),
  clockInLunch: jest.fn(),
  clockOut: jest.fn(),
  startPermissionEntry: jest.fn(),
  finishPermissionExit: jest.fn(),
  clockInDestino: jest.fn(),
  clockCloseTrip: jest.fn(),
  clockOutOperational: jest.fn(),
}));

const controller = require("../attendance.controller");
const service = require("../attendanceShortcut.service");

const respondWith = (status, body) => (req, res) => res.status(status).json(body);

const mockToday = (flow) => {
  controller.getToday.mockImplementation(
    respondWith(200, { ok: true, data: {}, context_flags: {}, ...flow })
  );
};

const buildReq = (body = {}, user = { id: 7, email: "ana.perez@fam.com" }) => ({
  user,
  body: { location: "-0.18,-78.48", ...body },
  headers: {},
});

beforeEach(() => jest.clearAllMocks());

describe("resolveSmartMark — flujo normal", () => {
  test("sin entrada registrada ejecuta clockIn y responde mensaje hablable", async () => {
    mockToday({ flow_kind: "regular", current_step: "awaiting_entry", next_step: "entrada" });
    controller.clockIn.mockImplementation(respondWith(200, { ok: true, message: "Entrada registrada" }));

    const out = await service.resolveSmartMark(buildReq({ intent: "smart_attendance" }));

    expect(controller.clockIn).toHaveBeenCalled();
    expect(out.mode).toBe("completed");
    expect(out.spoken_message).toMatch(/^Hola Ana, has marcado tu entrada correctamente\. /);
    const motivation = out.spoken_message.replace(/^Hola Ana, has marcado tu entrada correctamente\. /, "");
    expect(service.MOTIVATIONAL_PHRASES).toContain(motivation);
  });

  test("jornada completa responde día cerrado sin marcar", async () => {
    mockToday({ flow_kind: "completed", current_step: "day_closed", next_step: null });

    const out = await service.resolveSmartMark(buildReq());

    expect(out.spoken_message).toBe("Ya completaste tu jornada de hoy.");
    expect(controller.clockIn).not.toHaveBeenCalled();
  });

  test("falta de GPS se traduce a mensaje hablable controlado", async () => {
    mockToday({ flow_kind: "regular", current_step: "awaiting_entry", next_step: "entrada" });
    controller.clockIn.mockImplementation(respondWith(409, { ok: false, code: "LOCATION_REQUIRED_RETRY" }));

    const out = await service.resolveSmartMark(buildReq());

    expect(out.mode).toBe("blocked");
    expect(out.spoken_message).toMatch(/ubicación/i);
  });

  test("sin nombre reconocible, el mensaje queda capitalizado sin saludo", async () => {
    mockToday({ flow_kind: "regular", current_step: "awaiting_entry", next_step: "entrada" });
    controller.clockIn.mockImplementation(respondWith(200, { ok: true, message: "Entrada registrada" }));

    const out = await service.resolveSmartMark(buildReq({}, { id: 42 }));

    expect(out.spoken_message).toMatch(/^Has marcado tu entrada correctamente\. /);
  });
});

describe("resolveSmartMark — conversación operacional", () => {
  test("intent operacional sin flujo activo inicia conversación de categoría", async () => {
    mockToday({ flow_kind: "regular", current_step: "working_morning", next_step: "almuerzo-salida" });

    const out = await service.resolveSmartMark(buildReq({ intent: "salida operacional" }));

    expect(out.mode).toBe("conversation");
    expect(out.conversation_state).toBe("awaiting_operational_category");
    expect(out.continuation_token).toBeTruthy();
  });

  test("categoría cliente pregunta tipo de visita", async () => {
    const token = service.signConversationToken({ userId: 7, state: "awaiting_operational_category", slots: {} });

    const out = await service.resolveSmartMark(buildReq({ continuation_token: token, spoken_input: "Cliente" }));

    expect(out.conversation_state).toBe("awaiting_client_visit_type");
  });

  test("prospecto pide nombre y luego vehículo; sin vehículo ejecuta salida operacional", async () => {
    controller.clockOutOperational.mockImplementation(respondWith(200, { ok: true, message: "Salida operacional registrada" }));

    const t1 = service.signConversationToken({ userId: 7, state: "awaiting_client_visit_type", slots: { categoria: "cliente" } });
    const ask = await service.resolveSmartMark(buildReq({ continuation_token: t1, spoken_input: "prospecto" }));
    expect(ask.conversation_state).toBe("awaiting_prospect_name");

    const t2 = ask.continuation_token;
    const askVehicle = await service.resolveSmartMark(buildReq({ continuation_token: t2, spoken_input: "Laboratorio San Pedro" }));
    expect(askVehicle.conversation_state).toBe("awaiting_vehicle_usage");

    const out = await service.resolveSmartMark(
      buildReq({ continuation_token: askVehicle.continuation_token, spoken_input: "no" })
    );

    expect(out.mode).toBe("completed");
    expect(out.spoken_message).toMatch(/^Hola Ana, has iniciado la salida operacional para el prospecto Laboratorio San Pedro\. /);
    const sentBody = controller.clockOutOperational.mock.calls[0][0].body;
    expect(sentBody.operational_category).toBe("cliente");
    expect(sentBody.description).toContain("Laboratorio San Pedro");
  });

  test("vehículo personal deriva a handoff con URL de captura", async () => {
    const token = service.signConversationToken({
      userId: 7,
      state: "awaiting_vehicle_usage",
      slots: { categoria: "banco" },
    });

    const out = await service.resolveSmartMark(buildReq({ continuation_token: token, spoken_input: "sí" }));

    expect(out.mode).toBe("handoff");
    expect(out.open_url).toContain("/asistencia/marcar/salida-oficina");
    expect(out.spoken_message).toMatch(/kilometraje/i);
  });

  test("cronograma deriva a handoff", async () => {
    const token = service.signConversationToken({
      userId: 7,
      state: "awaiting_client_visit_type",
      slots: { categoria: "cliente" },
    });

    const out = await service.resolveSmartMark(buildReq({ continuation_token: token, spoken_input: "cronograma" }));

    expect(out.mode).toBe("handoff");
    expect(out.open_url).toContain("visita=cronograma");
  });
});

describe("resolveSmartMark — flujo operacional activo", () => {
  test("salida marcada sin llegada ejecuta llegada-destino", async () => {
    mockToday({
      flow_kind: "operational",
      current_step: "operational_departure_marked",
      next_step: "llegada-destino",
      context_flags: { has_active_operational: true },
    });
    controller.clockInDestino.mockImplementation(respondWith(200, { ok: true }));

    const out = await service.resolveSmartMark(buildReq());

    expect(controller.clockInDestino).toHaveBeenCalled();
    expect(out.spoken_message).toBe("Hola Ana, has marcado tu llegada al destino correctamente.");
  });

  test("cierre con vehículo personal (falta foto km final) deriva a handoff exacto", async () => {
    controller.clockCloseTrip.mockImplementation(
      respondWith(400, { ok: false, message: "Debes registrar el kilometraje final del vehiculo personal" })
    );
    const token = service.signConversationToken({ userId: 7, state: "awaiting_operational_destination_action", slots: {} });

    const out = await service.resolveSmartMark(buildReq({ continuation_token: token, spoken_input: "cerrar" }));

    expect(out.mode).toBe("handoff");
    expect(out.open_url).toContain("/asistencia/marcar/cierre-viaje");
    expect(out.spoken_message).toMatch(/kilometraje final/i);
  });

  test("visita a cliente activa pregunta si continua a otro cliente o regresa a oficina", async () => {
    mockToday({
      flow_kind: "operational",
      current_step: "field_visit_in_progress",
      next_step: "visita-salida",
      context_flags: { has_active_operational: true, has_active_field_visit: true },
    });

    const out = await service.resolveSmartMark(buildReq());

    expect(out.mode).toBe("conversation");
    expect(out.conversation_state).toBe("awaiting_post_visit_decision");
    expect(out.continuation_token).toBeTruthy();
  });

  test("responde 'otro cliente': cierra visita y pregunta tipo del siguiente (no handoff directo)", async () => {
    controller.clockOutField = jest.fn().mockImplementation(respondWith(200, { ok: true }));
    const token = service.signConversationToken({ userId: 7, state: "awaiting_post_visit_decision", slots: {} });

    const out = await service.resolveSmartMark(buildReq({ continuation_token: token, spoken_input: "voy a otro cliente" }));

    expect(controller.clockOutField).toHaveBeenCalled();
    expect(controller.clockOutField.mock.calls[0][0].body.post_visit_action).toBe("continue_operation");
    expect(out.mode).toBe("conversation");
    expect(out.conversation_state).toBe("awaiting_new_client_visit_type");
    expect(out.spoken_message).toMatch(/salida del cliente registrada/i);
  });

  test("prospecto nuevo tras cerrar visita: se marca por voz, sin UI", async () => {
    controller.clockOutField = jest.fn().mockImplementation(respondWith(200, { ok: true }));
    const t1 = service.signConversationToken({ userId: 7, state: "awaiting_post_visit_decision", slots: {} });
    const ask = await service.resolveSmartMark(buildReq({ continuation_token: t1, spoken_input: "otro cliente" }));

    const t2 = service.signConversationToken({ userId: 7, state: ask.conversation_state, slots: {} });
    const askName = await service.resolveSmartMark(buildReq({ continuation_token: t2, spoken_input: "prospecto" }));
    expect(askName.conversation_state).toBe("awaiting_new_prospect_name");

    controller.clockInField = jest.fn().mockImplementation(respondWith(200, { ok: true, message: "Entrada a visita registrada" }));
    const t3 = service.signConversationToken({ userId: 7, state: "awaiting_new_prospect_name", slots: {} });
    const out = await service.resolveSmartMark(buildReq({ continuation_token: t3, spoken_input: "Laboratorio San Pedro" }));

    expect(controller.clockInField.mock.calls[0][0].body.prospect_name).toBe("Laboratorio San Pedro");
    expect(out.mode).toBe("completed");
    expect(out.spoken_message).toMatch(/entrada al cliente laboratorio san pedro/i);
  });

  test("cronograma/emergencia para el siguiente cliente sigue siendo handoff (selección compleja)", async () => {
    const token = service.signConversationToken({ userId: 7, state: "awaiting_new_client_visit_type", slots: {} });

    const out = await service.resolveSmartMark(buildReq({ continuation_token: token, spoken_input: "cronograma" }));

    expect(out.mode).toBe("handoff");
    expect(out.open_url).toContain("/asistencia/marcar/cliente-entrada");
  });

  test("responde 'regreso a oficina': cierra visita y encadena cierre de viaje", async () => {
    controller.clockOutField = jest.fn().mockImplementation(respondWith(200, { ok: true }));
    controller.clockCloseTrip = jest.fn().mockImplementation(respondWith(200, { ok: true }));
    const token = service.signConversationToken({ userId: 7, state: "awaiting_post_visit_decision", slots: {} });

    const out = await service.resolveSmartMark(buildReq({ continuation_token: token, spoken_input: "regreso a la oficina" }));

    expect(controller.clockOutField.mock.calls[0][0].body.post_visit_action).toBe("return_to_office");
    expect(controller.clockCloseTrip).toHaveBeenCalled();
    expect(out.mode).toBe("completed");
  });

  test("al llegar al destino (sin almuerzo aun) pregunta cliente/almuerzo/cierre", async () => {
    mockToday({
      flow_kind: "operational",
      current_step: "operational_destination_reached",
      next_step: "cierre-viaje",
      context_flags: { has_active_operational: true },
    });

    const out = await service.resolveSmartMark(buildReq());

    expect(out.mode).toBe("conversation");
    expect(out.conversation_state).toBe("awaiting_operational_destination_action");
    expect(out.continuation_token).toBeTruthy();
  });

  test("responde 'otro cliente' en el destino: pregunta tipo de visita, sin cerrar nada ni ir a UI todavia", async () => {
    const token = service.signConversationToken({ userId: 7, state: "awaiting_operational_destination_action", slots: {} });

    const out = await service.resolveSmartMark(buildReq({ continuation_token: token, spoken_input: "voy a otro cliente" }));

    expect(out.mode).toBe("conversation");
    expect(out.conversation_state).toBe("awaiting_new_client_visit_type");
  });

  test("estando a almuerzo (salida marcada, sin regreso): re-invocar el atajo marca el regreso solo y pregunta cliente/cierre", async () => {
    mockToday({
      flow_kind: "operational",
      current_step: "operational_destination_reached",
      next_step: "cierre-viaje",
      context_flags: {
        has_active_operational: true,
        has_active_operational_lunch_start: true,
        has_active_operational_lunch_end: false,
      },
    });
    controller.clockInOperationalLunch = jest.fn().mockImplementation(respondWith(200, { ok: true }));

    const out = await service.resolveSmartMark(buildReq());

    expect(controller.clockInOperationalLunch).toHaveBeenCalled();
    expect(out.mode).toBe("conversation");
    expect(out.conversation_state).toBe("awaiting_operational_post_lunch_action");
    expect(out.spoken_message).toMatch(/retorno de almuerzo operacional registrado/i);
    expect(out.spoken_message).toMatch(/otro cliente o cierras/i);
  });

  test("almuerzo ya completo (salida y regreso marcados): pregunta solo cliente/cierre, sin ofrecer almuerzo de nuevo", async () => {
    mockToday({
      flow_kind: "operational",
      current_step: "operational_destination_reached",
      next_step: "cierre-viaje",
      context_flags: {
        has_active_operational: true,
        has_active_operational_lunch_start: true,
        has_active_operational_lunch_end: true,
      },
    });

    const out = await service.resolveSmartMark(buildReq());

    expect(out.mode).toBe("conversation");
    expect(out.conversation_state).toBe("awaiting_operational_post_lunch_action");
    expect(out.spoken_message).not.toMatch(/registrado/i);
  });

  test("responde 'almuerzo': primera vez marca salida, segunda vez marca regreso", async () => {
    controller.clockOutOperationalLunch = jest.fn().mockImplementation(respondWith(200, { ok: true }));
    const token = service.signConversationToken({ userId: 7, state: "awaiting_operational_destination_action", slots: {} });

    const out1 = await service.resolveSmartMark(buildReq({ continuation_token: token, spoken_input: "almuerzo operacional" }));
    expect(controller.clockOutOperationalLunch).toHaveBeenCalled();
    expect(out1.mode).toBe("completed");
    expect(out1.spoken_message).toMatch(/salida a almuerzo operacional/i);

    controller.clockOutOperationalLunch = jest
      .fn()
      .mockImplementation(respondWith(400, { ok: false, code: "OPERATIONAL_LUNCH_ALREADY_STARTED" }));
    controller.clockInOperationalLunch = jest.fn().mockImplementation(respondWith(200, { ok: true }));

    const out2 = await service.resolveSmartMark(buildReq({ continuation_token: token, spoken_input: "almuerzo" }));
    expect(controller.clockInOperationalLunch).toHaveBeenCalled();
    expect(out2.mode).toBe("completed");
    expect(out2.spoken_message).toMatch(/retorno de almuerzo operacional/i);
  });

  test("responde 'cerrar': ejecuta cierre-viaje", async () => {
    controller.clockCloseTrip = jest.fn().mockImplementation(respondWith(200, { ok: true }));
    const token = service.signConversationToken({ userId: 7, state: "awaiting_operational_destination_action", slots: {} });

    const out = await service.resolveSmartMark(buildReq({ continuation_token: token, spoken_input: "cierro la operacion" }));

    expect(controller.clockCloseTrip).toHaveBeenCalled();
    expect(out.mode).toBe("completed");
  });
});

describe("aviso de redirección en handoff", () => {
  test("todo handoff avisa explícitamente 'vas a ser redirigido'", async () => {
    const token = service.signConversationToken({ userId: 7, state: "awaiting_new_client_visit_type", slots: {} });

    const out = await service.resolveSmartMark(buildReq({ continuation_token: token, spoken_input: "cronograma" }));

    expect(out.mode).toBe("handoff");
    expect(out.spoken_message).toMatch(/vas a ser redirigido a famspi/i);
  });
});

describe("seguridad de continuation_token", () => {
  test("token de otro usuario se rechaza", async () => {
    const token = service.signConversationToken({ userId: 99, state: "awaiting_operational_category", slots: {} });

    const out = await service.resolveSmartMark(buildReq({ continuation_token: token, spoken_input: "banco" }));

    expect(out.mode).toBe("blocked");
    expect(out.spoken_message).toMatch(/expiró/i);
  });

  test("token corrupto se rechaza", async () => {
    const out = await service.resolveSmartMark(buildReq({ continuation_token: "garbage", spoken_input: "banco" }));

    expect(out.mode).toBe("blocked");
  });
});

describe("issueShortcutToken", () => {
  test("emite JWT con mismos claims iss/aud aceptados por verifyToken, dura 6 meses y queda registrado para revocación", async () => {
    const jwt = require("jsonwebtoken");
    const tokensRepo = require("../attendanceShortcutTokens.repository");

    const { token, expires_in } = await service.issueShortcutToken(
      {
        id: 7,
        email: "u@fam.com",
        role: "tecnico",
        iss: "spi-fam-backend",
        aud: "spi-fam-frontend",
        sub: "7",
        iat: 1,
        exp: 2,
        ip: "1.2.3.4",
        userAgent: "x",
      },
      { issuedBy: 1 }
    );

    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    expect(decoded.iss).toBe("spi-fam-backend");
    expect(decoded.aud).toBe("spi-fam-frontend");
    expect(decoded.sub).toBe("7");
    expect(decoded.token_kind).toBe("shortcut");
    expect(decoded.jti).toBeTruthy();
    expect(decoded.ip).toBeUndefined();
    expect(decoded.exp - decoded.iat).toBeGreaterThanOrEqual(86400 * 179);
    expect(expires_in).toBe("180d");

    expect(tokensRepo.recordIssuedToken).toHaveBeenCalledWith(
      expect.objectContaining({ jti: decoded.jti, userId: 7, issuedBy: 1 })
    );
  });

  test("perfil sin iss/aud (token emitido por TI para otro usuario) igual pasa verifyToken", async () => {
    // Regresión: adminIssueTokenForUser construye el perfil desde una fila cruda
    // de `users` (id, email, fullname, role), sin iss/aud — el token debe traerlos
    // igual o verifyToken lo rechaza con INVALID_CLAIMS.
    const jwt = require("jsonwebtoken");
    const { token } = await service.issueShortcutToken(
      { id: 9, email: "otro@fam.com", fullname: "Otro", role: "tecnico" },
      { issuedBy: 1 }
    );

    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    expect(decoded.iss).toBe("spi-fam-backend");
    expect(decoded.aud).toBe("spi-fam-frontend");
    expect(decoded.sub).toBe("9");
  });
});

describe("getFirstName", () => {
  test("usa el email (nombre.apellido) aunque fullname venga en orden legal apellidos+nombres", () => {
    expect(
      service.getFirstName({ email: "rafael.ortiz@fam-project.com", fullname: "ORTIZ EUGENIO RAFAEL ALEJANDRO" })
    ).toBe("Rafael");
    expect(
      service.getFirstName({ email: "soledad.fiallos@fam-project.com", fullname: "FIALLOS MOYA MARIA SOLEDAD" })
    ).toBe("Soledad");
  });

  test("email sin punto usa el local-part completo", () => {
    expect(service.getFirstName({ email: "administrador@fam-project.com" })).toBe("Administrador");
  });

  test("sin email cae a la primera palabra de fullname", () => {
    expect(service.getFirstName({ fullname: "Melanie Torres" })).toBe("Melanie");
  });

  test("sin email ni fullname devuelve cadena vacia (sin saludo)", () => {
    expect(service.getFirstName({})).toBe("");
  });
});

describe("frases motivadoras (entrada / salida operacional)", () => {
  test("hay al menos 100 frases sin duplicados", () => {
    expect(service.MOTIVATIONAL_PHRASES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(service.MOTIVATIONAL_PHRASES).size).toBe(service.MOTIVATIONAL_PHRASES.length);
  });

  test("salida operacional cierra con una frase motivadora del banco", async () => {
    controller.clockOutOperational.mockImplementation(respondWith(200, { ok: true, message: "Salida operacional registrada" }));
    const token = service.signConversationToken({ userId: 7, state: "awaiting_vehicle_usage", slots: { categoria: "banco" } });

    const out = await service.resolveSmartMark(buildReq({ continuation_token: token, spoken_input: "no" }));

    expect(out.spoken_message).toMatch(/^Hola Ana, has iniciado tu salida operacional correctamente\. /);
    const motivation = out.spoken_message.replace(/^Hola Ana, has iniciado tu salida operacional correctamente\. /, "");
    expect(service.MOTIVATIONAL_PHRASES).toContain(motivation);
  });

  test("almuerzo/salida final no llevan frase motivadora (solo entrada y salida operacional)", async () => {
    mockToday({ flow_kind: "regular", current_step: "working_morning", next_step: "almuerzo-salida" });
    controller.clockOutLunch.mockImplementation(respondWith(200, { ok: true }));

    const out = await service.resolveSmartMark(buildReq());

    expect(out.spoken_message).toBe("Hola Ana, has marcado tu salida al almuerzo correctamente.");
  });

  test("en muchas corridas aparece mas de una frase distinta (no siempre la misma)", async () => {
    controller.clockIn.mockImplementation(respondWith(200, { ok: true }));
    mockToday({ flow_kind: "regular", current_step: "awaiting_entry", next_step: "entrada" });

    const seen = new Set();
    for (let i = 0; i < 40; i += 1) {
      const out = await service.resolveSmartMark(buildReq());
      seen.add(out.spoken_message);
    }

    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("parsers de voz", () => {
  test("categorías con acentos y frases completas", () => {
    expect(service.parseCategory("Reunión")).toBe("reunion");
    expect(service.parseCategory("voy a un cliente")).toBe("cliente");
    expect(service.parseCategory("otra gestión")).toBe("gestion_oficina");
    expect(service.parseCategory("mmm")).toBeNull();
  });

  test("sí/no", () => {
    expect(service.parseYesNo("Sí")).toBe(true);
    expect(service.parseYesNo("no voy con carro")).toBe(false);
    expect(service.parseYesNo("tal vez")).toBeNull();
  });

  test("sí/no toleran puntuación pegada (coma, punto)", () => {
    expect(service.parseYesNo("Sí, uso mi carro")).toBe(true);
    expect(service.parseYesNo("No, no llevo vehículo.")).toBe(false);
    expect(service.parseYesNo("Correcto.")).toBe(true);
  });
});
