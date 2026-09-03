const db = require("../../config/db");
const { getBusinessDate } = require("./attendance.utils");

const resolveCurrentState = ({ attendance = null, activeException = null, activeVisit = null }) => {
  const hasEntry = Boolean(attendance?.entry_time);
  const hasLunchOut = Boolean(attendance?.lunch_start_time);
  const hasLunchIn = Boolean(attendance?.lunch_end_time);
  const hasExit = Boolean(attendance?.exit_time);
  const hasOpenLunch = hasLunchOut && !hasLunchIn;
  const entryPendingRegularization = Boolean(attendance?.entry_pending_regularization);
  const hasAttendanceFlow = hasEntry || hasLunchOut || hasLunchIn || entryPendingRegularization;

  const exceptionStatus = String(activeException?.status || "").trim().toUpperCase();
  const hasActiveException = Boolean(activeException) && exceptionStatus !== "COMPLETED";
  const hasActiveOperational = hasActiveException && ["OPERACION_CAMPO", "OPERACION_DE_CAMPO", "SALIDA_OFICINA", "VIAJE", "CAMPO"].includes(String(activeException?.type || "").trim().toUpperCase());
  const hasActiveVisit = String(activeVisit?.status || "").trim().toLowerCase() === "in_visit";

  return {
    hasEntry,
    hasLunchOut,
    hasLunchIn,
    hasExit,
    hasOpenLunch,
    entryPendingRegularization,
    hasAttendanceFlow,
    hasActiveException,
    hasActiveOperational,
    hasActiveVisit,
    exceptionStatus,
  };
};

const ACTION_RULES = {
  "clock-in": (s) => !s.hasEntry && !s.hasExit,
  "clock-out-lunch": (s) => s.hasEntry && !s.hasLunchOut && !s.hasExit && !s.hasActiveOperational && !s.hasActiveVisit,
  "clock-in-lunch": (s) => s.hasLunchOut && !s.hasLunchIn && !s.hasExit,
  "clock-out": (s) => s.hasAttendanceFlow && !s.hasExit && !s.hasOpenLunch && !s.hasActiveOperational && !s.hasActiveVisit,
};

const ACTION_ERRORS = {
  "clock-in": "Ya existe una entrada registrada para hoy",
  "clock-out-lunch": "No puedes salir a almuerzo en el estado actual",
  "clock-in-lunch": "No puedes regresar de almuerzo sin salida previa o ya fue registrado",
  "clock-out": "No puedes cerrar jornada: valida almuerzo/operacion/visita activa",
};

const validateAttendanceTransition = ({ actionType, state }) => {
  const rule = ACTION_RULES[actionType];
  if (!rule) return { ok: true };
  if (rule(state)) return { ok: true };

  return {
    ok: false,
    code: "ATTENDANCE_INVALID_TRANSITION",
    message: ACTION_ERRORS[actionType] || "Transicion de asistencia invalida",
  };
};

const resolveNextAllowedActions = (state) => {
  const actions = [];
  if (!state.hasEntry && !state.hasExit) actions.push("clock-in");
  if (state.hasEntry && !state.hasLunchOut && !state.hasExit && !state.hasActiveOperational && !state.hasActiveVisit) {
    actions.push("clock-out-lunch");
  }
  if (state.hasLunchOut && !state.hasLunchIn && !state.hasExit) actions.push("clock-in-lunch");
  if (state.hasAttendanceFlow && !state.hasExit && !state.hasOpenLunch && !state.hasActiveOperational && !state.hasActiveVisit) {
    actions.push("clock-out");
  }
  return actions;
};

const getCurrentAttendanceState = async ({ userId, at = new Date() }) => {
  const businessDate = getBusinessDate(at);

  const [attendanceRes, exceptionRes, visitRes] = await Promise.all([
    db.query("SELECT * FROM user_attendance_records WHERE user_id = $1 AND date = $2 LIMIT 1", [userId, businessDate]),
    db.query(
      `SELECT * FROM attendance_exceptions WHERE user_id = $1 AND UPPER(COALESCE(status,'')) <> 'COMPLETED' ORDER BY id DESC LIMIT 1`,
      [userId],
    ),
    db.query(
      `SELECT * FROM prospect_visits WHERE LOWER(COALESCE(user_email,'')) = LOWER(COALESCE((SELECT email FROM users WHERE id = $1), '')) AND LOWER(COALESCE(status,'')) = 'in_visit' ORDER BY id DESC LIMIT 1`,
      [userId],
    ).catch(() => ({ rows: [] })),
  ]);

  const attendance = attendanceRes.rows[0] || null;
  const activeException = exceptionRes.rows[0] || null;
  const activeVisit = visitRes.rows[0] || null;

  const state = resolveCurrentState({ attendance, activeException, activeVisit });

  return {
    businessDate,
    attendance,
    activeException,
    activeVisit,
    state,
    nextAllowedActions: resolveNextAllowedActions(state),
  };
};

module.exports = {
  getCurrentAttendanceState,
  validateAttendanceTransition,
  resolveNextAllowedActions,
};
