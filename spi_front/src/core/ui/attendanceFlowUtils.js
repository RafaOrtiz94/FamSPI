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
    shortcutLabel: "Nueva salida o visita",
    shortcutDetail: "Cliente, reunion, banco u otra gestion",
    syncTarget: "start",
    requiresParams: false,
    nextStepHint: "Continúa con llegada a destino y luego con el cierre operacional.",
  },
  {
    key: "entrada-oficina",
    aliases: ["entrada-oficina", "entrada-campo"],
    actionLabel: "Cierre operacional",
    shortcutLabel: "Entrada oficina",
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
export const resolveAttendancePendingActions = (attendanceData = {}) => {
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
    });
  }

  if (flowStep.contextFlags?.has_active_unexpected) {
    pending.push({
      id: "unexpected_open",
      severity: "warning",
      label: "Salida inesperada abierta",
      detail: "Registra tu regreso para cerrar esta salida.",
      actionKey: flowStep.nextActionKey,
    });
  }

  if (flowStep.contextFlags?.has_active_field_visit) {
    pending.push({
      id: "field_visit_open",
      severity: "info",
      label: "Visita en curso",
      detail: "Cierra la visita cuando termines la gestion con el cliente.",
      actionKey: flowStep.nextActionKey,
    });
  }

  if (flowStep.contextFlags?.has_active_permission_exception || flowStep.contextFlags?.has_active_time_off) {
    pending.push({
      id: "permission_active",
      severity: "info",
      label: "Permiso en curso",
      detail: "Tu permiso aprobado esta activo hoy.",
      actionKey: flowStep.nextActionKey,
    });
  }

  if (flowStep.contextFlags?.entry_pending_regularization) {
    pending.push({
      id: "entry_regularization",
      severity: "warning",
      label: "Entrada pendiente de regularizacion",
      detail: "Tu entrada de hoy quedo pendiente de aprobacion de Talento Humano.",
      actionKey: null,
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
    });
  }

  return pending;
};

