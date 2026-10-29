/**
 * State Machine - CA-01-02 (Limpieza de Áreas)
 * -----------------------------------------------
 * Controla el ciclo de vida de cada registro de limpieza GXP.
 * Estados: draft -> executed -> verified -> closed
 *
 * Reglas ISO 9001:
 *  - Solo Calidad puede verificar y cerrar.
 *  - Toda transición ilegal lanza error 400 trazable.
 *  - La matriz es INMUTABLE (Object.freeze) para evitar mutaciones en runtime.
 */

const LOG_STATUS = Object.freeze({
  EXECUTED: "executed",
  VERIFIED: "verified",
  CLOSED: "closed",
});

// Matriz de transiciones permitidas: { desde: [permitidos] }
const ALLOWED_TRANSITIONS = Object.freeze({
  executed: [LOG_STATUS.VERIFIED],
  verified: [LOG_STATUS.CLOSED],
  closed: [], // Estado terminal
});

/**
 * Valida si una transición es legítima según la matriz GXP.
 * @param {string} fromStatus - Estado actual del registro
 * @param {string} toStatus - Estado objetivo
 * @returns {boolean}
 */
const isValidTransition = (fromStatus, toStatus) => {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
};

/**
 * Aplica transición. Lanza AppError[400] ante transición ilegal.
 */
const applyTransition = (log, toStatus) => {
  if (!isValidTransition(log.status, toStatus)) {
    const err = new Error(
      `Transición GXP inválida: '${log.status}' → '${toStatus}' no está permitida por ISO 9001.`
    );
    err.status = 400;
    throw err;
  }
  return { ...log, status: toStatus };
};

module.exports = { LOG_STATUS, isValidTransition, applyTransition };
