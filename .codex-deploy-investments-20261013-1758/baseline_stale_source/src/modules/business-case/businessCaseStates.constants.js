/**
 * Business Case State Constants
 *
 * Canonical state definitions for Business Case workflow.
 * This file contains ONLY constants and NO business logic.
 *
 * This is the single source of truth for all state-related constants.
 * All other modules should import from this file to avoid circular dependencies.
 */

// Canonical state definitions
const STATES = {
  DRAFT_INICIAL: 'DRAFT_INICIAL',
  DATOS_BASE_COMPLETOS: 'DATOS_BASE_COMPLETOS',
  EN_EVALUACION_VIABILIDAD: 'EN_EVALUACION_VIABILIDAD',
  OBSERVADO_POR_VIABILIDAD: 'OBSERVADO_POR_VIABILIDAD',
  VIABLE: 'VIABLE',
  AJUSTES_OPERATIVOS: 'AJUSTES_OPERATIVOS',
  CERRADO_PARA_APROBACION: 'CERRADO_PARA_APROBACION',
  // Terminal states for negative outcomes
  RECHAZADO_POR_GERENCIA: 'RECHAZADO_POR_GERENCIA',
  CANCELADO: 'CANCELADO'
};

// States from which a BC can be cancelled (before final approval)
const CANCELLABLE_STATES = [
  STATES.DRAFT_INICIAL,
  STATES.DATOS_BASE_COMPLETOS,
  STATES.EN_EVALUACION_VIABILIDAD,
  STATES.OBSERVADO_POR_VIABILIDAD,
  STATES.VIABLE,
  STATES.AJUSTES_OPERATIVOS
];

// Allowed transitions (exact specification)
const TRANSITIONS = {
  [STATES.DRAFT_INICIAL]: [STATES.DATOS_BASE_COMPLETOS, STATES.CANCELADO],
  [STATES.DATOS_BASE_COMPLETOS]: [STATES.EN_EVALUACION_VIABILIDAD, STATES.CANCELADO],
  [STATES.EN_EVALUACION_VIABILIDAD]: [STATES.OBSERVADO_POR_VIABILIDAD, STATES.VIABLE, STATES.CANCELADO],
  [STATES.OBSERVADO_POR_VIABILIDAD]: [STATES.EN_EVALUACION_VIABILIDAD, STATES.VIABLE, STATES.CANCELADO],
  [STATES.VIABLE]: [STATES.AJUSTES_OPERATIVOS, STATES.CANCELADO],
  [STATES.AJUSTES_OPERATIVOS]: [STATES.CERRADO_PARA_APROBACION, STATES.CANCELADO],
  [STATES.CERRADO_PARA_APROBACION]: [STATES.RECHAZADO_POR_GERENCIA], // Gerencia puede rechazar
  [STATES.RECHAZADO_POR_GERENCIA]: [], // Terminal
  [STATES.CANCELADO]: []               // Terminal
};

// Validation to ensure STATES is properly defined
if (!STATES || typeof STATES !== 'object') {
  throw new Error('STATES constants must be properly defined');
}

if (!Object.values(STATES).includes(STATES.DRAFT_INICIAL)) {
  throw new Error('STATES.DRAFT_INICIAL must be defined and valid');
}

module.exports = {
  STATES,
  TRANSITIONS,
  CANCELLABLE_STATES
};
