/**
 * State Machine - CA-01-01 (Control de Temperatura)
 * ---------------------------------------------------
 * Define estricta y restrictivamente los estados de una Alarma/Desviación Térmica
 * para cumplimiento GXP y trazabilidad CAPA.
 */

const ALARM_STATUS = Object.freeze({
  OPEN: "open",                   // Falla detectada (temperatura fuera de rango)
  ACKNOWLEDGED: "acknowledged",   // Visto por operador/jefe, evaluación inicial
  RESOLVED: "resolved",           // Causa raíz contenida o corregida a nivel equipo
  CLOSED: "closed",               // Documentado formalmente (vinculado a CAPA si aplica) y archivado
});

const INITIAL_STATUS = ALARM_STATUS.OPEN;

// Matriz de Transiciones Permitidas (GXP Compliance)
const ALLOWED_TRANSITIONS = Object.freeze({
  [ALARM_STATUS.OPEN]: new Set([
    ALARM_STATUS.ACKNOWLEDGED,
    ALARM_STATUS.RESOLVED,      // Resolución inmediata sin pase formal
    ALARM_STATUS.CLOSED         // Descartado si fue falso positivo
  ]),
  [ALARM_STATUS.ACKNOWLEDGED]: new Set([
    ALARM_STATUS.RESOLVED,
    ALARM_STATUS.CLOSED
  ]),
  [ALARM_STATUS.RESOLVED]: new Set([
    ALARM_STATUS.CLOSED,
    ALARM_STATUS.OPEN           // Re-apertura si reincide antes del cierre QA
  ]),
  [ALARM_STATUS.CLOSED]: new Set() // Estado Terminal
});

const TERMINAL_STATUS = new Set([ALARM_STATUS.CLOSED]);

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

/**
 * Valida si una transición de estado es legalmente permisible en el workflow.
 */
const isValidTransition = ({ fromStatus, toStatus }) => {
  const from = normalizeStatus(fromStatus);
  const to = normalizeStatus(toStatus);
  if (!from || !to) return false;
  if (from === to) return true;
  
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.has(to);
};

/**
 * Fuerza una excepción HTTP si se detecta una violación a la matriz de transiciones.
 * Esta aserción bloquea la corrupción de datos ISO 9001.
 */
const assertTransition = ({ fromStatus, toStatus }) => {
  if (!isValidTransition({ fromStatus, toStatus })) {
    const error = new Error(`Transición ilegal de Alarma CA-01-01: No se puede transicionar de '${fromStatus}' a '${toStatus}'`);
    error.status = 400;
    error.code = "CA0101_ALARM_INVALID_TRANSITION";
    throw error;
  }
};

module.exports = {
  ALARM_STATUS,
  INITIAL_STATUS,
  ALLOWED_TRANSITIONS,
  TERMINAL_STATUS,
  normalizeStatus,
  isValidTransition,
  assertTransition,
};
