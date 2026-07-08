// Fase 3 (Plan Maestro Asistencia): mapa completo de codigos reales emitidos por
// attendance.controller.js (backend). Mantener sincronizado si el backend agrega codigos.
const ATTENDANCE_ERROR_CODE_MESSAGES = Object.freeze({
  LOCATION_REQUIRED_RETRY: {
    type: "warning",
    message: "Ubicacion obligatoria. Activa GPS preciso y vuelve a intentar.",
  },
  LOCATION_ACCURACY_LOW: {
    type: "warning",
    message: "Precision GPS insuficiente. Espera mejor senal y reintenta.",
  },
  TIME_OFF_ACTIVE: {
    type: "warning",
    message: "No puedes marcar asistencia mientras tengas permiso/vacaciones activos.",
  },
  ENTRY_MARK_CUTOFF_REACHED: {
    type: "warning",
    message: "Ya pasó la hora límite para marcar entrada (09:20). Solicita regularización.",
  },
  INVALID_POST_VISIT_ACTION: {
    type: "warning",
    message: "Selecciona una accion valida para continuar despues de la visita.",
  },
  OPERATIONAL_ALREADY_ACTIVE: {
    type: "info",
    message: "Ya tienes una salida operacional activa. Ciérrala antes de iniciar otra.",
  },
  NO_ACTIVE_OPERATIONAL: {
    type: "warning",
    message: "No tienes una salida operacional activa en este momento.",
  },
  OPERATIONAL_LUNCH_ALREADY_STARTED: {
    type: "warning",
    message: "Ya registraste la salida a almuerzo de esta gestion operacional.",
  },
  OPERATIONAL_LUNCH_NOT_STARTED: {
    type: "warning",
    message: "Debes registrar la salida a almuerzo antes de marcar el regreso.",
  },
  OPERATIONAL_LUNCH_ALREADY_ENDED: {
    type: "warning",
    message: "Ya registraste el regreso de almuerzo de esta gestion operacional.",
  },
  ATTENDANCE_INVALID_TRANSITION: {
    type: "warning",
    message: "Esa marcacion no corresponde al estado actual de tu jornada.",
  },
  NO_ACTIVE_VISIT: {
    type: "warning",
    message: "No hay una visita activa para cerrar en este momento.",
  },
  VISIT_ALREADY_CLOSED: {
    type: "info",
    message: "La visita ya estaba cerrada.",
  },
  FORBIDDEN: {
    type: "warning",
    message: "No tienes permisos para esta operacion de asistencia.",
  },
  ATTENDANCE_WORKSPACE_FORBIDDEN: {
    type: "warning",
    message: "No tienes permisos para ver este panel de asistencia.",
  },
  ATTENDANCE_TEAM_FORBIDDEN: {
    type: "warning",
    message: "No tienes permisos para ver la asistencia de este equipo.",
  },
  ATTENDANCE_NON_COMPLIANCE_FORBIDDEN: {
    type: "warning",
    message: "No tienes permisos para ver este reporte de incumplimientos.",
  },
});

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const inferByStatus = (status, fallbackMessage, fallbackType) => {
  if (status === 401) {
    return { message: "Sesion expirada. Inicia sesion nuevamente.", type: "error" };
  }
  if (status === 403) {
    return { message: "No tienes permisos para ejecutar esta accion.", type: "warning" };
  }
  if (status >= 500) {
    return { message: "Error del servidor de asistencia. Intenta nuevamente.", type: "error" };
  }
  return { message: fallbackMessage, type: fallbackType };
};

export const getAttendanceErrorInfo = (
  err,
  fallbackMessage = "Error procesando asistencia",
  fallbackType = "error",
) => {
  const response = err?.response || {};
  const payload = response?.data || {};
  const code = String(payload?.code || "").trim();
  const status = toNumber(response?.status, 0);
  const backendMessage = String(payload?.message || "").trim();
  const directMessage = String(err?.message || "").trim();

  if (code && ATTENDANCE_ERROR_CODE_MESSAGES[code]) {
    const mapped = ATTENDANCE_ERROR_CODE_MESSAGES[code];
    return {
      code,
      status,
      message: backendMessage || mapped.message,
      type: mapped.type,
    };
  }

  const inferred = inferByStatus(status, backendMessage || directMessage || fallbackMessage, fallbackType);
  return {
    code: code || null,
    status,
    message: inferred.message || fallbackMessage,
    type: inferred.type || fallbackType,
  };
};
