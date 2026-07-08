const OPERATIONAL_TYPES = new Set([
  "operacion_campo",
  "operacion_de_campo",
  "salida_oficina",
  "viaje",
  "campo",
]);

const normalizeType = (type) => String(type || "").trim().toLowerCase();

export const getAttendanceFlowType = (exception) => {
  if (!exception) return "none";
  return OPERATIONAL_TYPES.has(normalizeType(exception?.type)) ? "operational" : "unexpected";
};

export const isOperationalFlow = (exception) => getAttendanceFlowType(exception) === "operational";

export const isUnexpectedFlow = (exception) => getAttendanceFlowType(exception) === "unexpected";

// Fase 1 (Plan Maestro Asistencia): mapa canonico unico de acciones de marcacion.
// Consumido por AttendanceAction (deep-link/shortcut) y MobileShortcuts para que
// labels y "siguiente paso" no se dupliquen entre pantallas.
export const ATTENDANCE_FLOW_ACTIONS = Object.freeze([
  {
    key: "entrada",
    aliases: ["entrada"],
    actionLabel: "Entrada",
    shortcutLabel: "Marcar entrada",
    shortcutDetail: "Inicio de jornada",
    syncTarget: "entry",
    requiresParams: false,
    nextStepHint: "Continúa con salida a almuerzo cuando corresponda.",
  },
  {
    key: "almuerzo-salida",
    aliases: ["almuerzo-salida", "salida-almuerzo", "almuerzo"],
    actionLabel: "Salida a almuerzo",
    shortcutLabel: "Salida almuerzo",
    shortcutDetail: "Pausa de mediodia",
    syncTarget: "lunch_start",
    requiresParams: false,
    nextStepHint: "Continúa con entrada de almuerzo cuando regreses.",
  },
  {
    key: "almuerzo-entrada",
    aliases: ["almuerzo-entrada", "entrada-almuerzo"],
    actionLabel: "Entrada de almuerzo",
    shortcutLabel: "Entrada almuerzo",
    shortcutDetail: "Regreso de almuerzo",
    syncTarget: "lunch_end",
    requiresParams: false,
    nextStepHint: "Continúa con salida final al cerrar tu jornada.",
  },
  {
    key: "salida",
    aliases: ["salida", "salida-final"],
    actionLabel: "Salida final",
    shortcutLabel: "Salida final",
    shortcutDetail: "Cierre de jornada",
    syncTarget: "exit",
    requiresParams: false,
    nextStepHint: "Tu jornada ya está cerrada.",
  },
  {
    key: "salida-oficina",
    aliases: ["salida-oficina", "salida-campo"],
    actionLabel: "Salida operacional",
    shortcutLabel: "Salida operacional",
    shortcutDetail: "Cliente, reunion, banco u otra gestion",
    syncTarget: "start",
    requiresParams: false,
    nextStepHint: "Continúa con llegada a destino y luego con el cierre operacional.",
  },
  {
    key: "entrada-oficina",
    aliases: ["entrada-oficina", "entrada-campo"],
    actionLabel: "Cerrar operación",
    shortcutLabel: "Cerrar operación",
    shortcutDetail: "Cerrar ciclo operacional",
    syncTarget: "return",
    requiresParams: false,
    nextStepHint: "Ciclo operacional cerrado correctamente.",
  },
  {
    key: "llegada-destino",
    aliases: ["llegada-destino"],
    actionLabel: "Llegada a destino",
    shortcutLabel: "Llegada destino",
    shortcutDetail: "Arribo al sitio",
    syncTarget: "arrival",
    requiresParams: false,
    nextStepHint: "Continúa con salida/entrada de cliente o cierre de viaje.",
  },
  {
    key: "cierre-viaje",
    aliases: ["cierre-viaje"],
    actionLabel: "Cierre de viaje",
    shortcutLabel: "Cierre viaje",
    shortcutDetail: "Cerrar desde fuera de oficina",
    syncTarget: "return",
    requiresParams: false,
    nextStepHint: "Viaje cerrado correctamente.",
  },
  {
    key: "retorno-operacional",
    aliases: ["retorno-operacional", "regreso-operacional"],
    actionLabel: "Retorno operacional",
    shortcutLabel: "Retorno operacional",
    shortcutDetail: "Iniciar regreso a oficina",
    syncTarget: "returning",
    requiresParams: false,
    nextStepHint: "Continúa con entrada oficina para cerrar el ciclo operacional.",
  },
  {
    key: "cliente-entrada",
    // "visita-entrada" es la clave canonica que emite el backend (CANONICAL_ATTENDANCE_ACTIONS.fieldVisitIn)
    aliases: ["cliente-entrada", "entrada-cliente", "visita-entrada"],
    actionLabel: "Entrada cliente",
    shortcutLabel: "Entrada cliente",
    shortcutDetail: "Inicio de visita",
    syncTarget: "arrival",
    requiresParams: true,
    nextStepHint: "Continúa con salida de cliente al terminar la visita.",
  },
  {
    key: "cliente-salida",
    // "visita-salida" es la clave canonica que emite el backend (CANONICAL_ATTENDANCE_ACTIONS.fieldVisitOut)
    aliases: ["cliente-salida", "salida-cliente", "visita-salida"],
    actionLabel: "Salida cliente",
    shortcutLabel: "Salida cliente",
    shortcutDetail: "Cerrar visita y elegir siguiente paso",
    syncTarget: "departure",
    requiresParams: false,
    nextStepHint: "Visita cerrada correctamente.",
  },
  {
    key: "permission-entry-start",
    aliases: ["permission-entry-start"],
    actionLabel: "Entrada + salida a permiso",
    shortcutLabel: "Permiso: iniciar",
    shortcutDetail: "Registra entrada y salida a permiso aprobado",
    syncTarget: null,
    requiresParams: false,
    nextStepHint: "Continúa con el cierre del permiso cuando termine.",
  },
  {
    key: "permission-exit-finish",
    aliases: ["permission-exit-finish"],
    actionLabel: "Salida del permiso",
    shortcutLabel: "Permiso: finalizar",
    shortcutDetail: "Cierra el permiso y la jornada",
    syncTarget: null,
    requiresParams: false,
    nextStepHint: "Permiso y jornada finalizados.",
  },
  {
    key: "llegada-imprevista",
    aliases: ["llegada-imprevista"],
    actionLabel: "Llegada de salida inesperada",
    shortcutLabel: "Salida inesperada: llegada",
    shortcutDetail: "Confirma llegada al destino imprevisto",
    syncTarget: "arrival",
    requiresParams: false,
    nextStepHint: "Continúa con el regreso cuando termines.",
  },
  {
    key: "regreso-imprevisto",
    aliases: ["regreso-imprevisto"],
    actionLabel: "Regreso de salida inesperada",
    shortcutLabel: "Salida inesperada: regreso",
    shortcutDetail: "Inicia el regreso a oficina",
    syncTarget: "return",
    requiresParams: false,
    nextStepHint: "Continúa con la entrada para cerrar el ciclo.",
  },
  {
    key: "entrada-imprevista",
    aliases: ["entrada-imprevista"],
    actionLabel: "Cierre de salida inesperada",
    shortcutLabel: "Salida inesperada: cerrar",
    shortcutDetail: "Cierra el ciclo de salida inesperada",
    syncTarget: "return",
    requiresParams: false,
    nextStepHint: "Salida inesperada cerrada correctamente.",
  },
]);

const ATTENDANCE_ALIAS_TO_KEY = new Map();
const ATTENDANCE_KEY_TO_META = new Map();
ATTENDANCE_FLOW_ACTIONS.forEach((entry) => {
  ATTENDANCE_KEY_TO_META.set(entry.key, entry);
  entry.aliases.forEach((alias) => ATTENDANCE_ALIAS_TO_KEY.set(alias, entry.key));
});

export const resolveAttendanceActionKey = (rawAction) =>
  ATTENDANCE_ALIAS_TO_KEY.get(String(rawAction || "").trim()) || null;

export const getAttendanceActionMeta = (rawAction) => {
  const canonicalKey = resolveAttendanceActionKey(rawAction);
  return canonicalKey ? ATTENDANCE_KEY_TO_META.get(canonicalKey) : null;
};

export const getAttendanceActionLabel = (rawAction, fallback = "Marcación") =>
  getAttendanceActionMeta(rawAction)?.actionLabel || fallback;

export const getAttendanceNextStepHint = (rawAction) =>
  getAttendanceActionMeta(rawAction)?.nextStepHint || "Continúa con la siguiente marcación de tu flujo.";

// Fase 8 (Plan Maestro Asistencia): ayuda contextual breve por accion, mostrada
// antes de pedir GPS/confirmar, para que el usuario sepa que va a pasar.
const ATTENDANCE_HELP_HINTS = Object.freeze({
  entrada: "Se registrara tu hora de entrada con tu ubicacion actual.",
  "almuerzo-salida": "Se registrara tu salida a almuerzo. Recuerda marcar el regreso despues.",
  "almuerzo-entrada": "Se registrara tu regreso de almuerzo.",
  salida: "Se registrara el cierre de tu jornada de hoy.",
  "salida-oficina": "Vas a iniciar una salida operacional (visita, banco, gestion externa, etc).",
  "entrada-oficina": "Vas a cerrar tu salida operacional activa. Recuerda marcar la salida del cliente antes, si hay una visita en curso.",
  "llegada-destino": "Confirma que llegaste al lugar de tu gestion.",
  "cierre-viaje": "Vas a cerrar tu salida operacional desde el lugar donde te encuentres.",
  "retorno-operacional": "Vas a iniciar el regreso de tu salida operacional.",
  "cliente-entrada": "Vas a registrar el inicio de una visita a cliente o prospecto.",
  "cliente-salida": "Vas a cerrar la visita activa y elegir tu siguiente paso.",
  "permission-entry-start": "Se registrara la entrada y salida a tu permiso aprobado en un solo paso.",
  "permission-exit-finish": "Se cerrara tu permiso y tu jornada de hoy.",
});

export const getAttendanceHelpHint = (rawAction) => {
  const canonicalKey = resolveAttendanceActionKey(rawAction);
  return (canonicalKey && ATTENDANCE_HELP_HINTS[canonicalKey]) || null;
};

// Fase 1: resolver unico de flujo. Consume el envelope canonico que el backend
// ya expone en getTodayAttendance()/getActiveException() como `data.canonical_flow`
// (flow_kind, current_step, next_step, allowed_actions, context_flags).
// Widget, deep-link y shortcuts deben leer el "siguiente paso" desde aqui en vez
// de recalcularlo cada uno por su cuenta.
export const resolveAttendanceFlowStep = (canonicalFlow) => {
  if (!canonicalFlow || typeof canonicalFlow !== "object") {
    return {
      flowKind: "none",
      currentStep: "idle",
      nextActionKey: null,
      nextStepLabel: null,
      nextStepHint: null,
      allowedActionKeys: [],
      allowedActions: [],
      contextFlags: {},
    };
  }

  const nextActionKey = canonicalFlow.next_step || null;
  const allowedActionKeys = Array.isArray(canonicalFlow.allowed_actions) ? canonicalFlow.allowed_actions : [];

  return {
    flowKind: canonicalFlow.flow_kind || "none",
    currentStep: canonicalFlow.current_step || "idle",
    nextActionKey,
    nextStepLabel: nextActionKey ? getAttendanceActionLabel(nextActionKey, null) : null,
    nextStepHint: nextActionKey ? getAttendanceNextStepHint(nextActionKey) : null,
    allowedActionKeys,
    allowedActions: allowedActionKeys.map((key) => ({
      key,
      label: getAttendanceActionLabel(key, key),
      meta: getAttendanceActionMeta(key),
    })),
    contextFlags: canonicalFlow.context_flags || {},
  };
};

// Fase 4 (Plan Maestro Asistencia): bandeja de pendientes accionables, derivada
// del mismo payload que ya devuelve getTodayAttendance() (canonical_flow,
// active_time_off, active_field_visit, late_policy). No requiere un endpoint
// nuevo — es una proyeccion de datos ya existentes para timeline/resumen del dia.
const LUNCH_REMINDER_MINUTES = 75;
const LONG_SHIFT_REMINDER_MINUTES = 10.5 * 60;

const minutesSince = (isoValue, now) => {
  if (!isoValue) return null;
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.round((now.getTime() - parsed.getTime()) / 60000);
};

export const resolveAttendancePendingActions = (attendanceData = {}, now = new Date(), activeException = null) => {
  const canonicalFlow = attendanceData?.canonical_flow || null;
  const flowStep = resolveAttendanceFlowStep(canonicalFlow);
  const pending = [];

  if (flowStep.contextFlags?.has_active_operational) {
    pending.push({
      id: "operational_open",
      severity: "warning",
      label: "Salida operacional abierta",
      detail: "Tienes una salida operacional sin cerrar.",
      actionKey: flowStep.nextActionKey,
      linkTo: null,
    });

    // Fase 7 (Plan Maestro Asistencia): si la salida usa vehiculo personal, el
    // cierre generara un registro de viatico por kilometraje — se lo anticipamos
    // al usuario para que no le sorprenda (recomendacion 17).
    if (activeException?.uses_personal_vehicle) {
      pending.push({
        id: "viatico_expected",
        severity: "info",
        label: "Esta salida generara viatico",
        detail: "Usaste vehiculo personal: al cerrar se registrara el kilometraje para viaticos.",
        actionKey: null,
        // linkTo pendiente: no hay ruta de "mis viaticos" confirmada y accesible
        // para todos los roles operativos en AppRoutes.jsx (ver backlog Fase 7).
        linkTo: null,
      });
    }
  }

  if (flowStep.contextFlags?.has_active_unexpected) {
    pending.push({
      id: "unexpected_open",
      severity: "warning",
      label: "Salida inesperada abierta",
      detail: "Registra tu regreso para cerrar esta salida.",
      actionKey: flowStep.nextActionKey,
      linkTo: null,
    });
  }

  if (flowStep.contextFlags?.has_active_field_visit) {
    pending.push({
      id: "field_visit_open",
      severity: "info",
      label: "Visita en curso",
      detail: "Cierra la visita cuando termines la gestion con el cliente.",
      actionKey: flowStep.nextActionKey,
      linkTo: null,
    });
  }

  if (flowStep.contextFlags?.has_active_permission_exception || flowStep.contextFlags?.has_active_time_off) {
    pending.push({
      id: "permission_active",
      severity: "info",
      label: "Permiso en curso",
      detail: "Tu permiso aprobado esta activo hoy.",
      actionKey: flowStep.nextActionKey,
      // linkTo pendiente: PermisosPage solo esta montada bajo
      // /dashboard/talento-humano/permisos en AppRoutes.jsx, no hay ruta
      // confirmada de "mis permisos" para todos los roles (ver backlog Fase 7).
      linkTo: null,
    });
  }

  if (flowStep.contextFlags?.entry_pending_regularization) {
    pending.push({
      id: "entry_regularization",
      severity: "warning",
      label: "Entrada pendiente de regularizacion",
      detail: "Tu entrada de hoy quedo pendiente de aprobacion de Talento Humano.",
      actionKey: null,
      linkTo: null,
    });
  }

  const justification = attendanceData?.late_policy?.justification;
  if (justification?.canJustify) {
    pending.push({
      id: "late_justification",
      severity: "warning",
      label: "Atraso sin justificar",
      detail: "Puedes justificar tu atraso de hoy antes del corte.",
      actionKey: null,
      linkTo: null,
    });
  }

  // Fase 6 (Plan Maestro Asistencia): recordatorios suaves basados en tiempo
  // transcurrido, calculados en el cliente con datos que ya llegan en el payload
  // (sin job de backend ni notificacion push).
  const lunchStart = attendanceData?.lunch_start_time;
  const lunchEnd = attendanceData?.lunch_end_time;
  if (lunchStart && !lunchEnd) {
    const elapsed = minutesSince(lunchStart, now);
    if (Number.isFinite(elapsed) && elapsed > LUNCH_REMINDER_MINUTES) {
      pending.push({
        id: "lunch_overdue",
        severity: "warning",
        label: "Almuerzo mas largo de lo habitual",
        detail: `Llevas ${elapsed} minutos en almuerzo. Registra tu regreso cuando puedas.`,
        actionKey: "almuerzo-entrada",
        linkTo: null,
      });
    }
  }

  const entryTime = attendanceData?.entry_time;
  const exitTime = attendanceData?.exit_time;
  if (entryTime && !exitTime && !flowStep.contextFlags?.has_active_operational && !flowStep.contextFlags?.has_active_unexpected) {
    const elapsed = minutesSince(entryTime, now);
    if (Number.isFinite(elapsed) && elapsed > LONG_SHIFT_REMINDER_MINUTES) {
      pending.push({
        id: "long_open_shift",
        severity: "warning",
        label: "Jornada muy extendida",
        detail: "Verifica si olvidaste marcar tu salida.",
        actionKey: "salida",
        linkTo: null,
      });
    }
  }

  return pending;
};

// Mitigacion D1 (Fase 0 inventario): AttendanceWidget.submitOperationalModal y
// AttendanceAction.handleManualClientSubmit validaban el mismo paso operacional
// (categoria + kilometraje/foto de vehiculo personal) con dos copias de la regla
// que ya habian divergido en nombres de variable. Se extraen aqui como funciones
// puras, sin estado, para que ambos consuman la misma regla. Se mantienen 3
// funciones separadas (no una sola combinada) para preservar el orden exacto de
// validacion que cada pantalla ya tenia (evita cambiar cual mensaje de error
// aparece primero cuando hay mas de un campo invalido a la vez).

export const validateOperationalCategoryStep = (category) => {
  if (!String(category || "").trim()) {
    return { ok: false, error: "Selecciona la categoria de la salida operacional." };
  }
  return { ok: true, error: null };
};

export const validateOperationalVehicleStart = ({ usesPersonalVehicle, startKm, startPhoto }) => {
  if (!usesPersonalVehicle) return { ok: true, error: null };
  if (!String(startKm || "").trim()) {
    return { ok: false, error: "Debes registrar el kilometraje inicial." };
  }
  if (!startPhoto) {
    return { ok: false, error: "Debes tomar la foto del kilometraje inicial." };
  }
  return { ok: true, error: null };
};

export const validateOperationalVehicleClosure = ({ requiresClosure, endKm, endPhoto }) => {
  if (!requiresClosure) return { ok: true, error: null };
  if (!String(endKm || "").trim()) {
    return { ok: false, error: "Debes registrar el kilometraje final." };
  }
  if (!endPhoto) {
    return { ok: false, error: "Debes tomar la foto del kilometraje final." };
  }
  return { ok: true, error: null };
};

// Mitigacion D1 (segundo tramo): los objetos enviados a marcarSalidaOficina /
// marcarEntradaOficina / marcarCierreViaje se armaban de forma independiente en
// AttendanceWidget.submitOperationalModal y en AttendanceAction.ACTION_MAP, con
// la misma forma pero leyendo de variables con nombres distintos. Se extraen
// como builders puros para que un cambio de contrato (ej. un campo nuevo que
// pida el backend) se haga una sola vez. NO se tocan las llamadas HTTP ni el
// manejo de exito/error de cada componente — esa orquestacion sigue separada
// a proposito (ver nota en el commit: cada pantalla tiene una estrategia de
// recuperacion ante 409 distinta y unificarla es una decision de producto,
// no un refactor mecanico).

export const buildOperationalStartPayload = ({
  description,
  category,
  usesPersonalVehicle,
  startKm,
  startPhoto,
}) => ({
  description: String(description || "").trim() || "Salida operacional de campo / oficina",
  operational_category: category,
  uses_personal_vehicle: Boolean(usesPersonalVehicle),
  odometer_start_km: startKm,
  start_odometer_photo: startPhoto,
});

export const buildOperationalClosurePayload = ({ endKm, endPhoto }) => ({
  odometer_end_km: endKm,
  end_odometer_photo: endPhoto,
});

export const buildOperationalTripClosePayload = ({ closureReason, endKm, endPhoto }) => ({
  closure_reason: String(closureReason || "").trim() || "Cierre de viaje operacional",
  odometer_end_km: endKm,
  end_odometer_photo: endPhoto,
});

