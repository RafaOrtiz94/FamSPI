/**
 * src/modules/attendance/attendanceShortcut.service.js
 * -----------------------------------------------------
 * 🗣️ Siri Smart Attendance (iPhone Shortcuts)
 *
 * Resuelve la marcación correcta por voz apoyándose en el estado real del día
 * (canonical_flow de getToday) y reutilizando los handlers existentes del
 * controller vía dispatch interno: cero duplicación de reglas de negocio.
 *
 * Modos de respuesta (contrato estable para Shortcuts):
 * - completed:    acción ejecutada, Siri lee spoken_message
 * - conversation: falta un dato simple, Siri pregunta y reenvía continuation_token
 * - handoff:      requiere UI/foto, se abre open_url en el paso exacto
 * - blocked:      no se puede continuar por voz, mensaje hablable controlado
 */

const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const db = require("../../config/db");
const controller = require("./attendance.controller");
const { FRONTEND_URL } = require("../../config/security");
const logger = require("../../config/logger");
const shortcutTokensRepo = require("./attendanceShortcutTokens.repository");

const CONVERSATION_TOKEN_KIND = "attendance_shortcut_conversation";
const CONVERSATION_TOKEN_TTL = "10m";
const SHORTCUT_TOKEN_EXPIRES_IN = String(process.env.SHORTCUT_TOKEN_EXPIRES_IN || "180d").trim();

/* ============================================================
   Catálogo de mensajes hablables (plan §11)
============================================================ */
const SPOKEN = Object.freeze({
  entrada: "has marcado tu entrada correctamente.",
  "almuerzo-salida": "has marcado tu salida al almuerzo correctamente.",
  "almuerzo-entrada": "has marcado tu retorno del almuerzo correctamente.",
  salida: "has marcado tu salida final correctamente. Buen trabajo.",
  "permission-entry-start": "has marcado tu entrada y salida a permiso correctamente.",
  "permission-exit-finish": "has marcado tu salida del permiso correctamente.",
  "llegada-destino": "has marcado tu llegada al destino correctamente.",
  "cierre-viaje": "has cerrado tu salida operacional correctamente. Buen trabajo.",
  "salida-oficina": "has iniciado tu salida operacional correctamente.",
  "almuerzo-salida-operacional": "has marcado tu salida a almuerzo operacional correctamente.",
  "almuerzo-entrada-operacional": "has marcado tu retorno de almuerzo operacional correctamente.",
  "visita-salida": "has marcado la salida del cliente correctamente.",
});

const SPOKEN_GENERIC_ERROR = "No se pudo completar la marcación. Intenta nuevamente.";
const SPOKEN_DAY_CLOSED = "Ya completaste tu jornada de hoy.";
const SPOKEN_UI_REQUIRED = "Necesito que completes este paso en FamSPI.";
const SPOKEN_ASK_CATEGORY = "¿Tu salida es a cliente, reunión, banco, proveedor u otra gestión?";
const SPOKEN_ASK_VISIT_TYPE = "¿Es cliente de cronograma, prospecto o emergencia?";
const SPOKEN_ASK_PROSPECT = "¿Cuál es el nombre del prospecto?";
const SPOKEN_ASK_VEHICLE = "¿Vas a usar vehículo personal?";
const SPOKEN_ASK_POST_VISIT = "¿Vas a otro cliente o regresas a la oficina?";
const SPOKEN_ASK_DESTINATION_ACTION = "¿Vas a otro cliente, vamos a almuerzo, o cierras la salida operacional?";
const SPOKEN_ASK_POST_LUNCH_ACTION = "¿Vas a otro cliente o cierras la salida operacional?";

// Frases motivadoras cortas para entrada / salida operacional. Banco grande
// a propósito (100+) para que no se sienta repetitivo entre usuarios/días —
// una al azar por marcación, sin repetir mensaje base.
const MOTIVATIONAL_PHRASES = Object.freeze([
  "Que tengas un excelente día.",
  "A darlo todo hoy.",
  "Hoy es un gran día para avanzar.",
  "Vamos con toda la energía.",
  "Que el día te rinda al máximo.",
  "A por un gran día de trabajo.",
  "Éxitos en tu jornada.",
  "Hoy vas a lograr grandes cosas.",
  "Con actitud, todo se puede.",
  "Que fluya el buen trabajo hoy.",
  "A construir un gran día.",
  "Buena energía para hoy.",
  "Hoy es un buen día para crecer.",
  "Vamos con todo.",
  "Que tengas una jornada productiva.",
  "A sumar un gran día más.",
  "Con foco y buena actitud, todo sale bien.",
  "Hoy toca brillar.",
  "Un paso más hacia tus metas.",
  "Que el esfuerzo de hoy valga la pena.",
  "A darle con ganas.",
  "Hoy es buen momento para destacar.",
  "Con disciplina se llega lejos.",
  "Buen ritmo para hoy.",
  "A trabajar con pasión.",
  "Que hoy sea un día de logros.",
  "Vamos por más.",
  "Con constancia todo mejora.",
  "Hoy suma, no restes.",
  "A por un día lleno de buenas decisiones.",
  "Que tu esfuerzo de hoy inspire a otros.",
  "Con calma y enfoque, todo avanza.",
  "Hoy es una nueva oportunidad.",
  "A sacar lo mejor de ti.",
  "Buen trabajo desde ya.",
  "Que la jornada fluya bien.",
  "Con actitud positiva se avanza más rápido.",
  "Hoy toca dar el extra.",
  "A construir algo bueno hoy.",
  "Que cada tarea de hoy te acerque a tus metas.",
  "Vamos, hoy se puede.",
  "Con ganas se nota la diferencia.",
  "Hoy es un buen día para aprender algo nuevo.",
  "A mantener el buen ánimo.",
  "Que hoy sea mejor que ayer.",
  "Con paciencia y esfuerzo, todo llega.",
  "Hoy cuenta, aprovéchalo.",
  "A por un día ordenado y productivo.",
  "Buena vibra para arrancar.",
  "Que el compromiso de hoy rinda frutos.",
  "Con cada día se construye el éxito.",
  "Hoy es momento de avanzar con confianza.",
  "A mantener el enfoque.",
  "Que la jornada de hoy sea liviana y productiva.",
  "Con buena actitud, el día rinde más.",
  "Hoy toca sumar experiencia.",
  "A no bajar el ritmo.",
  "Buen inicio para un gran día.",
  "Que hoy encuentres motivos para sonreír.",
  "Con esfuerzo diario se logran grandes metas.",
  "Hoy es un buen momento para mejorar.",
  "A disfrutar el trabajo bien hecho.",
  "Que la disciplina de hoy sea la ventaja de mañana.",
  "Con cada tarea, un paso adelante.",
  "Hoy toca dar lo mejor de ti mismo.",
  "A mantenerse firme en el objetivo.",
  "Buena jornada te espera.",
  "Que hoy sea un día de buenas noticias.",
  "Con constancia se nota el progreso.",
  "Hoy es momento de sumar valor.",
  "A trabajar con orden y calma.",
  "Que el día de hoy te deje satisfecho.",
  "Con cada esfuerzo se construye confianza.",
  "Hoy toca avanzar un poco más.",
  "A mantener la buena actitud todo el día.",
  "Buen día de trabajo por delante.",
  "Que hoy sea un día productivo y tranquilo.",
  "Con cada logro se suma motivación.",
  "Hoy es un buen día para organizarte bien.",
  "A no perder el enfoque.",
  "Que la jornada te traiga buenos resultados.",
  "Con dedicación todo se logra.",
  "Hoy toca poner el hombro.",
  "A caminar firme hacia tus metas.",
  "Buen ánimo para todo el día.",
  "Que hoy sumes un logro más a tu lista.",
  "Con cada día se afina el oficio.",
  "Hoy es momento de mostrar lo mejor de ti.",
  "A mantenerse motivado.",
  "Que el trabajo de hoy abra puertas mañana.",
  "Con paso firme se llega lejos.",
  "Hoy toca avanzar con confianza.",
  "A no dejar nada para después.",
  "Buena energía para toda la jornada.",
  "Que hoy sea un día de aprendizaje.",
  "Con cada reto se crece un poco más.",
  "Hoy es un buen día para superarte.",
  "A mantener el compromiso de siempre.",
  "Que la jornada de hoy sea justa contigo.",
  "Con constancia se construyen grandes cosas.",
  "Hoy toca dar el siguiente paso.",
  "A trabajar tranquilo y con orden.",
  "Buen día, buena actitud, buenos resultados.",
]);

const pickMotivation = () => MOTIVATIONAL_PHRASES[Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)];

// Acciones que cierran con una frase motivadora aleatoria (evita que suene
// siempre igual). Solo entrada y salida operacional, por pedido explícito —
// no todas las marcaciones (almuerzo/salida final no llevan esto).
const MOTIVATIONAL_ACTIONS = new Set(["entrada", "salida-oficina"]);

const SAFE_ERROR_SPOKEN = Object.freeze({
  LOCATION_REQUIRED_RETRY: "No pude obtener tu ubicación. Activa el GPS e intenta nuevamente.",
  LOCATION_ACCURACY_LOW: "La señal GPS es débil. Intenta nuevamente en unos segundos.",
});

/* ============================================================
   Acciones voice-safe directas (plan §4.1)
============================================================ */
const VOICE_SAFE_DIRECT = Object.freeze({
  entrada: () => controller.clockIn,
  "almuerzo-salida": () => controller.clockOutLunch,
  "almuerzo-entrada": () => controller.clockInLunch,
  salida: () => controller.clockOut,
  "permission-entry-start": () => controller.startPermissionEntry,
  "permission-exit-finish": () => controller.finishPermissionExit,
  "llegada-destino": () => controller.clockInDestino,
  "cierre-viaje": () => controller.clockCloseTrip,
  "almuerzo-salida-operacional": () => controller.clockOutOperationalLunch,
  "almuerzo-entrada-operacional": () => controller.clockInOperationalLunch,
  "visita-salida": () => controller.clockOutField,
});

/* ============================================================
   Helpers de texto hablado
============================================================ */
const stripAccents = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const normalizeSpoken = (value) => stripAccents(value).trim().toLowerCase();

const parseCategory = (spoken) => {
  const text = normalizeSpoken(spoken);
  if (!text) return null;
  if (text.includes("cliente")) return "cliente";
  if (text.includes("reunion")) return "reunion";
  if (text.includes("banco")) return "banco";
  if (text.includes("ministerio")) return "ministerio";
  if (text.includes("proveedor")) return "proveedor";
  if (text.includes("gestion")) return "gestion_oficina";
  if (text.includes("otro") || text.includes("otra")) return "otro";
  return null;
};

const parseVisitType = (spoken) => {
  const text = normalizeSpoken(spoken);
  if (!text) return null;
  if (text.includes("cronograma") || text.includes("agenda")) return "cronograma";
  if (text.includes("prospecto")) return "prospecto";
  if (text.includes("emergencia")) return "emergencia";
  return null;
};

const parsePostVisitDecision = (spoken) => {
  const text = normalizeSpoken(spoken);
  if (!text) return null;
  if (text.includes("otro") || text.includes("otra") || text.includes("siguiente") || text.includes("continuar")) return "continue_operation";
  if (text.includes("oficina") || text.includes("regres")) return "return_to_office";
  return null;
};

const parseDestinationAction = (spoken) => {
  const text = normalizeSpoken(spoken);
  if (!text) return null;
  if (text.includes("otro") || text.includes("otra") || text.includes("cliente")) return "client";
  if (text.includes("almuerzo")) return "lunch";
  if (text.includes("cerr") || text.includes("cierr") || text.includes("termin") || text.includes("finaliz")) return "close";
  return null;
};

const parseYesNo = (spoken) => {
  // Quita puntuación antes de aplicar los límites de palabra -- "Sí, uso mi
  // carro" no matcheaba porque la coma rompía el "(\s|$)" después de "sí".
  const text = normalizeSpoken(spoken).replace(/[.,;:!?¡¿]/g, "");
  if (!text) return null;
  if (/(^|\s)(si|sí|claro|afirmativo|yes|correcto)(\s|$)/.test(` ${text} `)) return true;
  if (/(^|\s)(no|negativo)(\s|$)/.test(` ${text} `)) return false;
  return null;
};

// Nombre de pila para el saludo hablado. El email (ej. "rafael.ortiz@...")
// es la fuente confiable de "cómo lo llaman" — fullname suele venir en
// orden legal apellidos+nombres y no coincide con el primer token
// (ej. "ORTIZ EUGENIO RAFAEL ALEJANDRO" se llama "Rafael", no "Ortiz").
const getFirstName = (user = {}) => {
  const capitalize = (word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : "");
  const localPart = String(user.email || "").split("@")[0] || "";
  const emailFirst = localPart.split(/[._]/)[0] || "";
  if (emailFirst) return capitalize(emailFirst);

  const fullnameFirst = String(user.fullname || "").trim().split(/\s+/)[0] || "";
  return capitalize(fullnameFirst);
};

const normalizeIntent = (value) => {
  const text = normalizeSpoken(value);
  return text.includes("operacional") || text === "operational_exit"
    ? "operational_exit"
    : "smart_attendance";
};

/* ============================================================
   Tokens
============================================================ */
const signConversationToken = ({ userId, state, slots }) =>
  jwt.sign(
    { kind: CONVERSATION_TOKEN_KIND, sub: String(userId), s: state, d: slots || {} },
    process.env.SECRET_KEY,
    { expiresIn: CONVERSATION_TOKEN_TTL }
  );

// ponytail: token stateless (sin tabla de sesiones); TTL 10m + guards existentes
// contra doble marcación cubren la invalidación. Tabla si algún flujo lo exige.
const verifyConversationToken = (token, user) => {
  if (!token) return null;
  try {
    const decoded = jwt.verify(String(token), process.env.SECRET_KEY);
    if (decoded?.kind !== CONVERSATION_TOKEN_KIND) return null;
    if (String(decoded.sub) !== String(user?.id)) return null;
    return decoded;
  } catch {
    return null;
  }
};

// Token dedicado para Shortcuts: mismos claims que el access token (verifyToken
// lo acepta sin cambios), expiración larga configurable. Revocación individual
// vía tabla attendance_shortcut_tokens (jti) — ver attendanceShortcutTokens.repository.js
// y el chequeo en middlewares/auth.js.
const issueShortcutToken = async (user = {}, { issuedBy = null } = {}) => {
  const { iat, exp, nbf, iss, aud, ip, userAgent, ...claims } = user;
  const jti = randomUUID();
  const token = jwt.sign(
    {
      ...claims,
      sub: String(claims.id ?? claims.sub),
      iss: "spi-fam-backend",
      aud: "spi-fam-frontend",
      token_kind: "shortcut",
      jti,
    },
    process.env.SECRET_KEY,
    { expiresIn: SHORTCUT_TOKEN_EXPIRES_IN }
  );

  const { exp: expSeconds } = jwt.decode(token);
  await shortcutTokensRepo.recordIssuedToken({
    jti,
    userId: claims.id ?? claims.sub,
    issuedBy,
    expiresAt: new Date(expSeconds * 1000),
  });

  return { token, expires_in: SHORTCUT_TOKEN_EXPIRES_IN };
};

/* ============================================================
   Dispatch interno a handlers existentes
============================================================ */
const invokeController = (handler, req, { body = {}, path } = {}) =>
  new Promise((resolve) => {
    const innerReq = Object.create(req);
    innerReq.body = { ...(req.body || {}), ...body };
    innerReq.files = req.files || {};
    if (path) Object.defineProperty(innerReq, "path", { value: path });

    const captured = { status: 200, body: null };
    const res = {
      status(code) {
        captured.status = code;
        return this;
      },
      json(payload) {
        captured.body = payload;
        resolve(captured);
        return this;
      },
    };

    Promise.resolve(handler(innerReq, res)).catch((err) => {
      captured.status = err?.status || 500;
      captured.body = { ok: false, message: err?.message || "Error interno" };
      resolve(captured);
    });
  });

/* ============================================================
   Constructores de respuesta para Siri
============================================================ */
// FRONTEND_URL malformado en el runtime (comilla/espacio/salto de linea en la
// env var) hacia explotar new URL() aqui — y como TODO handoff pasa por esta
// funcion, Siri respondia "No se pudo completar la marcación" en cada caso que
// requeria abrir FamSPI. Se sanea una vez al cargar, con fallback al dominio
// conocido, y el query se arma con URLSearchParams (nunca lanza).
const SAFE_FRONTEND_URL = (() => {
  try {
    return new URL(String(FRONTEND_URL).trim()).origin;
  } catch {
    logger.warn({ FRONTEND_URL }, "[ATTENDANCE][SHORTCUT] FRONTEND_URL invalido; usando dominio por defecto");
    return "https://fam-spi-front.web.app";
  }
})();

const buildMarkUrl = (action, slots = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(slots)) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return `${SAFE_FRONTEND_URL}/asistencia/marcar/${action}${query ? `?${query}` : ""}`;
};

const completedResponse = ({ user, action, resultBody, spokenOverride }) => {
  const core =
    spokenOverride ||
    (resultBody?.code === "OPERATIONAL_ALREADY_ACTIVE" ? resultBody.message : SPOKEN[action] || "se completó la acción.");
  const coreWithMotivation = MOTIVATIONAL_ACTIONS.has(action) ? `${core} ${pickMotivation()}` : core;
  const name = getFirstName(user);
  const spoken = name
    ? `Hola ${name}, ${coreWithMotivation}`
    : coreWithMotivation.charAt(0).toUpperCase() + coreWithMotivation.slice(1);

  return {
    ok: true,
    mode: "completed",
    action,
    spoken_message: spoken,
    display_message: resultBody?.message || SPOKEN[action] || "Realizado.",
    requires_ui: false,
    requires_follow_up: false,
  };
};

const conversationResponse = ({ userId, state, spoken, slots }) => ({
  ok: true,
  mode: "conversation",
  conversation_state: state,
  spoken_message: spoken,
  display_message: spoken,
  requires_ui: false,
  requires_follow_up: true,
  continuation_token: signConversationToken({ userId, state, slots }),
});

// Todo handoff abre una URL y termina el turno de voz (requires_follow_up:
// false) -- el usuario necesita saber explícitamente que va a salir de Siri
// hacia FamSPI, siempre con la misma frase, sin depender de que cada punto
// de la conversación se acuerde de decirlo.
const REDIRECT_NOTICE = "Vas a ser redirigido a FamSPI para continuar.";

const handoffResponse = ({ action, spoken = SPOKEN_UI_REQUIRED, slots = {}, url }) => {
  const spokenWithNotice = /redirig/i.test(spoken) ? spoken : `${spoken} ${REDIRECT_NOTICE}`;
  return {
    ok: true,
    mode: "handoff",
    spoken_message: spokenWithNotice,
    display_message: spokenWithNotice,
    requires_ui: true,
    requires_follow_up: false,
    open_url: url || buildMarkUrl(action, slots),
  };
};

const blockedResponse = (spoken) => ({
  ok: false,
  mode: "blocked",
  spoken_message: spoken,
  display_message: spoken,
  requires_ui: false,
  requires_follow_up: false,
});

const spokenOnlyResponse = (spoken) => ({
  ok: true,
  mode: "completed",
  action: null,
  spoken_message: spoken,
  display_message: spoken,
  requires_ui: false,
  requires_follow_up: false,
});

/* ============================================================
   Ejecución de acciones voice-safe
============================================================ */
const failureToResponse = ({ action, result }) => {
  const code = result.body?.code;
  if (SAFE_ERROR_SPOKEN[code]) return blockedResponse(SAFE_ERROR_SPOKEN[code]);

  const message = String(result.body?.message || "");

  // Falta km/foto de vehículo personal → handoff al paso exacto, no error seco
  if (/kilometraje|foto/i.test(message)) {
    const handoffAction = action || "salida-oficina";
    const spoken = /final/i.test(message)
      ? "Necesitas registrar el kilometraje final y tomar la foto correspondiente."
      : "Necesitas registrar el kilometraje y tomar la foto correspondiente.";
    return handoffResponse({ action: handoffAction, spoken });
  }

  if (code === "CLIENT_VISIT_MUST_CLOSE_FIRST") {
    return handoffResponse({
      action: "cliente-salida",
      spoken: "Tienes una visita a cliente en curso; primero debes marcar su salida.",
    });
  }

  // Mensajes de negocio ya vienen en español hablable; errores 5xx → genérico
  return blockedResponse(message && result.status < 500 ? message : SPOKEN_GENERIC_ERROR);
};

const executeDirect = async ({ req, action, handler, body = {}, spokenOverride }) => {
  const resolvedHandler = handler || VOICE_SAFE_DIRECT[action]?.();
  if (!resolvedHandler) {
    return handoffResponse({ action, spoken: SPOKEN_UI_REQUIRED });
  }

  const result = await invokeController(resolvedHandler, req, { body });
  if (result.body?.ok) {
    logger.info(
      { userId: req.user?.id, action, origin: "ios_shortcut_siri" },
      "[ATTENDANCE][SHORTCUT] Marcación por voz ejecutada"
    );
    return completedResponse({ user: req.user, action, resultBody: result.body, spokenOverride });
  }
  return failureToResponse({ action, result });
};

/* ============================================================
   Flujo operacional activo
============================================================ */
// Intenta almuerzo operacional: si ya empezó, el "salida" falla con
// OPERATIONAL_LUNCH_ALREADY_STARTED y ahí mismo se intenta el regreso.
// Un solo comando de voz ("almuerzo operacional") sirve para las dos puntas.
const resolveOperationalLunch = async ({ req }) => {
  const startResult = await invokeController(controller.clockOutOperationalLunch, req);
  if (startResult.body?.ok) {
    logger.info({ userId: req.user?.id, action: "almuerzo-salida-operacional", origin: "ios_shortcut_siri" }, "[ATTENDANCE][SHORTCUT] Marcación por voz ejecutada");
    return completedResponse({ user: req.user, action: "almuerzo-salida-operacional", resultBody: startResult.body });
  }
  if (startResult.body?.code === "OPERATIONAL_LUNCH_ALREADY_STARTED") {
    return executeDirect({ req, action: "almuerzo-entrada-operacional" });
  }
  return failureToResponse({ action: "almuerzo-salida-operacional", result: startResult });
};

// Prospecto nuevo = voz completa (clockInField acepta prospect_name sin
// client_id). Cronograma/emergencia siguen siendo selección compleja -> UI
// (plan §4.3) -- eso no cambia, solo dejamos de forzar UI para el caso simple.
const askNewClientVisitType = (req, spokenPrefix = "") =>
  conversationResponse({
    userId: req.user.id,
    state: "awaiting_new_client_visit_type",
    spoken: `${spokenPrefix}${SPOKEN_ASK_VISIT_TYPE}`,
    slots: {},
  });

const finishDestinationAction = async ({ req, action }) => {
  if (action === "client") {
    return askNewClientVisitType(req);
  }
  if (action === "lunch") {
    return resolveOperationalLunch({ req });
  }
  return executeDirect({ req, action: "cierre-viaje" });
};

const finishPostVisitDecision = async ({ req, decision }) => {
  if (decision === "continue_operation") {
    const result = await invokeController(controller.clockOutField, req, {
      body: { post_visit_action: "continue_operation" },
    });
    if (!result.body?.ok) return failureToResponse({ action: "visita-salida", result });
    return askNewClientVisitType(req, "Salida del cliente registrada. ");
  }

  // return_to_office: cierra la visita y de una vez intenta cerrar el viaje
  // (siguiente paso natural una vez que ya no hay visita activa).
  const result = await invokeController(controller.clockOutField, req, {
    body: { post_visit_action: "return_to_office" },
  });
  if (!result.body?.ok) return failureToResponse({ action: "visita-salida", result });
  return executeDirect({ req, action: "cierre-viaje" });
};

const resolveOperationalNext = async ({ req, flow }) => {
  const step = flow.current_step;

  if (step === "field_visit_in_progress") {
    return conversationResponse({
      userId: req.user.id,
      state: "awaiting_post_visit_decision",
      spoken: SPOKEN_ASK_POST_VISIT,
      slots: {},
    });
  }

  if (step === "operational_departure_marked") {
    return executeDirect({ req, action: "llegada-destino" });
  }

  if (step === "operational_destination_reached") {
    // run-smart-mark decide, no un `intent` especial de un shortcut aparte —
    // cualquier atajo que llegue aquí recibe la misma conversación.
    const flags = flow.context_flags || {};
    const lunchStarted = Boolean(flags.has_active_operational_lunch_start);
    const lunchEnded = Boolean(flags.has_active_operational_lunch_end);

    if (lunchStarted && !lunchEnded) {
      // Volver a invocar el atajo estando a almuerzo = "ya regresé". Se marca
      // el retorno solo y se sigue directo a la pregunta de cliente/cierre.
      const result = await invokeController(controller.clockInOperationalLunch, req);
      if (!result.body?.ok) return failureToResponse({ action: "almuerzo-entrada-operacional", result });
      return conversationResponse({
        userId: req.user.id,
        state: "awaiting_operational_post_lunch_action",
        spoken: `Retorno de almuerzo operacional registrado. ${SPOKEN_ASK_POST_LUNCH_ACTION}`,
        slots: {},
      });
    }

    // Si ya almorzó hoy no se vuelve a ofrecer esa opción.
    const alreadyLunched = lunchStarted && lunchEnded;
    return conversationResponse({
      userId: req.user.id,
      state: alreadyLunched ? "awaiting_operational_post_lunch_action" : "awaiting_operational_destination_action",
      spoken: alreadyLunched ? SPOKEN_ASK_POST_LUNCH_ACTION : SPOKEN_ASK_DESTINATION_ACTION,
      slots: {},
    });
  }

  return spokenOnlyResponse("Tu salida operacional ya está cerrada.");
};

/* ============================================================
   Conversación operacional guiada (plan §9)
============================================================ */
const startOperationalConversation = ({ req }) =>
  conversationResponse({
    userId: req.user.id,
    state: "awaiting_operational_category",
    spoken: SPOKEN_ASK_CATEGORY,
    slots: {},
  });

const finishOperationalStart = async ({ req, slots }) => {
  const prospectName = String(slots.prospecto || "").trim();
  const body = {
    operational_category: slots.categoria,
    uses_personal_vehicle: false,
  };
  if (prospectName) body.description = `Salida operacional: Cliente — prospecto ${prospectName}`;

  return executeDirect({
    req,
    action: "salida-oficina",
    handler: controller.clockOutOperational,
    body,
    spokenOverride: prospectName
      ? `has iniciado la salida operacional para el prospecto ${prospectName}.`
      : SPOKEN["salida-oficina"],
  });
};

const continueConversation = async ({ req, continuation }) => {
  const userId = req.user.id;
  const rawSpoken = String(req.body?.spoken_input || "").trim();
  const slots = continuation.d || {};
  const reAsk = (state, spoken) =>
    conversationResponse({ userId, state, spoken: `No entendí. ${spoken}`, slots });

  switch (continuation.s) {
    case "awaiting_operational_category": {
      const categoria = parseCategory(rawSpoken);
      if (!categoria) return reAsk("awaiting_operational_category", SPOKEN_ASK_CATEGORY);
      if (categoria === "cliente") {
        return conversationResponse({
          userId,
          state: "awaiting_client_visit_type",
          spoken: SPOKEN_ASK_VISIT_TYPE,
          slots: { ...slots, categoria },
        });
      }
      return conversationResponse({
        userId,
        state: "awaiting_vehicle_usage",
        spoken: SPOKEN_ASK_VEHICLE,
        slots: { ...slots, categoria },
      });
    }

    case "awaiting_client_visit_type": {
      const visita = parseVisitType(rawSpoken);
      if (!visita) return reAsk("awaiting_client_visit_type", SPOKEN_ASK_VISIT_TYPE);
      if (visita === "prospecto") {
        return conversationResponse({
          userId,
          state: "awaiting_prospect_name",
          spoken: SPOKEN_ASK_PROSPECT,
          slots: { ...slots, visita },
        });
      }
      // cronograma / emergencia: selección compleja → handoff al paso exacto
      return handoffResponse({
        action: "salida-oficina",
        slots: { ...slots, visita },
      });
    }

    case "awaiting_prospect_name": {
      if (!rawSpoken) return reAsk("awaiting_prospect_name", SPOKEN_ASK_PROSPECT);
      return conversationResponse({
        userId,
        state: "awaiting_vehicle_usage",
        spoken: SPOKEN_ASK_VEHICLE,
        slots: { ...slots, prospecto: rawSpoken },
      });
    }

    case "awaiting_vehicle_usage": {
      const usesVehicle = parseYesNo(rawSpoken);
      if (usesVehicle === null) return reAsk("awaiting_vehicle_usage", SPOKEN_ASK_VEHICLE);
      if (usesVehicle) {
        return handoffResponse({
          action: "salida-oficina",
          spoken: "Necesitas registrar el kilometraje inicial y tomar la foto correspondiente.",
          slots: { ...slots, vehiculo: "1" },
        });
      }
      return finishOperationalStart({ req, slots });
    }

    case "awaiting_post_visit_decision": {
      const decision = parsePostVisitDecision(rawSpoken);
      if (!decision) return reAsk("awaiting_post_visit_decision", SPOKEN_ASK_POST_VISIT);
      return finishPostVisitDecision({ req, decision });
    }

    case "awaiting_operational_destination_action": {
      const action = parseDestinationAction(rawSpoken);
      if (!action) return reAsk("awaiting_operational_destination_action", SPOKEN_ASK_DESTINATION_ACTION);
      return finishDestinationAction({ req, action });
    }

    case "awaiting_operational_post_lunch_action": {
      const action = parseDestinationAction(rawSpoken);
      if (!action || action === "lunch") return reAsk("awaiting_operational_post_lunch_action", SPOKEN_ASK_POST_LUNCH_ACTION);
      return finishDestinationAction({ req, action });
    }

    case "awaiting_new_client_visit_type": {
      const visita = parseVisitType(rawSpoken);
      if (!visita) return reAsk("awaiting_new_client_visit_type", SPOKEN_ASK_VISIT_TYPE);
      if (visita === "prospecto") {
        return conversationResponse({
          userId,
          state: "awaiting_new_prospect_name",
          spoken: SPOKEN_ASK_PROSPECT,
          slots: {},
        });
      }
      // cronograma / emergencia: selección compleja de cliente existente → UI
      return handoffResponse({
        action: "cliente-entrada",
        spoken: "Selecciona el cliente para continuar.",
      });
    }

    case "awaiting_new_prospect_name": {
      if (!rawSpoken) return reAsk("awaiting_new_prospect_name", SPOKEN_ASK_PROSPECT);
      const result = await invokeController(controller.clockInField, req, {
        body: { prospect_name: rawSpoken },
      });
      if (!result.body?.ok) return failureToResponse({ action: "visita-entrada", result });
      return completedResponse({
        user: req.user,
        action: "visita-entrada",
        resultBody: result.body,
        spokenOverride: `has marcado la entrada al cliente ${rawSpoken} correctamente.`,
      });
    }

    default:
      return blockedResponse("La conversación expiró. Empieza de nuevo.");
  }
};

/* ============================================================
   Resolución principal (plan §7)
============================================================ */
const resolveSmartMark = async (req) => {
  const rawContinuation = req.body?.continuation_token;
  if (rawContinuation) {
    const continuation = verifyConversationToken(rawContinuation, req.user);
    if (!continuation) return blockedResponse("La conversación expiró. Empieza de nuevo.");
    return continueConversation({ req, continuation });
  }

  const todayResult = await invokeController(controller.getToday, req);
  if (!todayResult.body?.ok) return blockedResponse(SPOKEN_GENERIC_ERROR);
  const flow = todayResult.body;
  const flags = flow.context_flags || {};

  // Flujo operacional activo manda, sin importar el intent
  if (flags.has_active_operational || flags.has_active_field_visit) {
    return resolveOperationalNext({ req, flow });
  }

  if (normalizeIntent(req.body?.intent) === "operational_exit") {
    return startOperationalConversation({ req });
  }

  if (flow.flow_kind === "completed" || flow.current_step === "day_closed") {
    return spokenOnlyResponse(SPOKEN_DAY_CLOSED);
  }

  if (flow.current_step === "entry_pending_regularization") {
    return handoffResponse({
      url: `${SAFE_FRONTEND_URL}/asistencia/mobile-shortcuts`,
      spoken: "Tu entrada está pendiente de regularización.",
    });
  }

  const next = flow.next_step;
  if (next && VOICE_SAFE_DIRECT[next]) {
    return executeDirect({ req, action: next });
  }

  // Cualquier otro estado (flujo imprevisto, etc.) → paso exacto en UI
  return next
    ? handoffResponse({ action: next })
    : handoffResponse({ url: `${SAFE_FRONTEND_URL}/asistencia/mobile-shortcuts` });
};

// Emitido por TI/jefe_ti para otro usuario (no requiere que el usuario tenga
// sesión activa). Perfil mínimo: attendance solo usa req.user.id/email/fullname,
// no requiere scope/dashboard de resolveRoleMeta.
const issueShortcutTokenForUser = async (targetUserId, { issuedBy = null } = {}) => {
  const { rows } = await db.query(
    `SELECT id, email, fullname, role FROM users WHERE id = $1 LIMIT 1`,
    [targetUserId]
  );
  const user = rows[0];
  if (!user) return null;
  return issueShortcutToken(user, { issuedBy });
};

module.exports = {
  resolveSmartMark,
  issueShortcutToken,
  issueShortcutTokenForUser,
  listShortcutTokensForUser: shortcutTokensRepo.listTokensForUser,
  revokeShortcutToken: shortcutTokensRepo.revokeTokenById,
  getFirstName,
  // exportados para tests
  verifyConversationToken,
  signConversationToken,
  parseCategory,
  parseVisitType,
  parseYesNo,
  parsePostVisitDecision,
  parseDestinationAction,
  MOTIVATIONAL_PHRASES,
};
