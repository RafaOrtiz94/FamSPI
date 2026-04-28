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
  ATTENDANCE_OPS_FORBIDDEN: {
    type: "warning",
    message: "No tienes permisos para esta operacion de asistencia.",
  },
  NO_ACTIVE_VISIT: {
    type: "warning",
    message: "No hay una visita activa para cerrar en este momento.",
  },
  VISIT_ALREADY_CLOSED: {
    type: "info",
    message: "La visita ya estaba cerrada.",
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
