/**
 * Business Case Permissions Matrix
 *
 * Centralized permission control for Business Case editing.
 * Permissions depend on: role, canonical_state, section, field.
 *
 * Rules:
 * - Prices can ONLY be edited by jefe_operaciones
 * - Inversiones adicionales section is ALWAYS accessible (state-independent)
 * - All permission checks enforced in backend only
 */

const { STATES } = require('./businessCaseStates.constants');

// Role definitions
const ROLES = {
  COMERCIAL: 'comercial',
  ACP_COMERCIAL: 'acp_comercial',
  BACKOFFICE: 'backoffice',
  BACKOFFICE_COMERCIAL: 'backoffice_comercial',
  JEFE_TECNICO: 'jefe_tecnico',
  JEFE_COMERCIAL: 'jefe_comercial',
  JEFE_OPERACIONES: 'jefe_operaciones',
  JEFE_FINANCIERO: 'jefe_financiero',
  JEFE_TI: 'jefe_ti',
  ING_SERVICIO: 'ing_servicio',
  ESP_APP: 'esp_app',
  GERENCIA: 'gerencia'
};

// Roles que se mapean al rol canónico de la matriz de permisos.
// jefe_servicio hereda exactamente los permisos de jefe_tecnico (reemplazo
// directo del mismo puesto).
//
// BUG corregido: gerencia/gerencia_general mapeaban a jefe_comercial, dandoles
// edicion completa en todas las secciones/estados. El frontend
// (roleSectionConfig.js, BC-04) documenta explicitamente que gerencia es
// "solo lectura en todo excepto feasibility" -- feasibility no es una seccion
// de esta matriz (se gatea aparte via assertCanSaveFeasibilityDecision/rutas),
// asi que el rol GERENCIA aqui queda de solo lectura en las 7 secciones que
// esta matriz controla.
//
// jefe_ti y jefe_financiero YA NO se mapean a jefe_tecnico/jefe_operaciones:
// jefe_ti solo trabaja el carrito de inversiones (BC-10), no tiene trabajo
// tecnico real en el BC; jefe_financiero es su propio bucket de solo
// precios/valores financieros, sin los permisos operacionales completos de
// jefe_operaciones. Cada uno tiene su propia fila en PERMISSION_MATRIX.
//
// BUG corregido: ing_servicio y esp_app mapeaban a jefe_tecnico (edicion
// completa), contradiciendo los comentarios de businessCase.routes.js que
// los documentan como "solo visualizacion en BC". ing_servicio reemplaza al
// tecnico base (no al jefe), esp_app es un rol nuevo de solo lectura. Ambos
// tienen su propia fila en PERMISSION_MATRIX (identica a JEFE_TI: solo
// investments accesible, todo lo demas de solo lectura).
const ROLE_CANONICAL_MAP = {
  jefe_servicio: 'jefe_tecnico',
  asesor_comercial: 'comercial',
  analista_comercial: 'comercial',
  jefe_de_comercial: 'jefe_comercial',
  jefe_de_operaciones: 'jefe_operaciones',
  operaciones: 'jefe_operaciones',
  gerencia_general: 'gerencia',
};

// Section definitions
const SECTIONS = {
  GENERAL: 'general',
  LAB_ENVIRONMENT: 'lab_environment',
  EQUIPMENT: 'equipment',
  LIS: 'lis',
  DETERMINATIONS: 'determinations',
  INVESTMENTS: 'investments',
  PRICES: 'prices' // Sub-section/field-level control
};

// Price-sensitive fields (only editable by jefe_operaciones)
const PRICE_SENSITIVE_FIELDS = [
  'bc_equipment_cost',
  'bc_target_margin_percentage',
  'bc_amortization_months',
  'equipment_cost',
  'target_margin_percentage',
  'amortization_months'
];

// Permission Matrix: Single Source of Truth
const PERMISSION_MATRIX = {
  // DRAFT_INICIAL - Early stage, limited editing
  [STATES.DRAFT_INICIAL]: {
    [ROLES.COMERCIAL]: {
      [SECTIONS.GENERAL]: true,
      [SECTIONS.LAB_ENVIRONMENT]: true,
      [SECTIONS.EQUIPMENT]: true,
      [SECTIONS.LIS]: true,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true, // Always accessible
      [SECTIONS.PRICES]: false
    },
    [ROLES.ACP_COMERCIAL]: {
      [SECTIONS.GENERAL]: true,
      [SECTIONS.LAB_ENVIRONMENT]: true,
      [SECTIONS.EQUIPMENT]: true,
      [SECTIONS.LIS]: true,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.BACKOFFICE]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.BACKOFFICE_COMERCIAL]: {
      [SECTIONS.GENERAL]: true,
      [SECTIONS.LAB_ENVIRONMENT]: true,
      [SECTIONS.EQUIPMENT]: true,
      [SECTIONS.LIS]: true,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_TECNICO]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_COMERCIAL]: {
      [SECTIONS.GENERAL]: true,
      [SECTIONS.LAB_ENVIRONMENT]: true,
      [SECTIONS.EQUIPMENT]: true,
      [SECTIONS.LIS]: true,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_OPERACIONES]: {
      [SECTIONS.GENERAL]: true,
      [SECTIONS.LAB_ENVIRONMENT]: true,
      [SECTIONS.EQUIPMENT]: true,
      [SECTIONS.LIS]: true,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: true
    },
    [ROLES.JEFE_FINANCIERO]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: true
    },
    [ROLES.JEFE_TI]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true, // Solo carrito (BC-10)
      [SECTIONS.PRICES]: false
    },
    [ROLES.ING_SERVICIO]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true, // Solo lectura en BC, salvo carrito
      [SECTIONS.PRICES]: false
    },
    [ROLES.ESP_APP]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true, // Solo lectura en BC, salvo carrito
      [SECTIONS.PRICES]: false
    },
    [ROLES.GERENCIA]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true, // Always accessible (ver canEdit)
      [SECTIONS.PRICES]: false
    }
  },

  // DATOS_BASE_COMPLETOS - Data entry completed
  [STATES.DATOS_BASE_COMPLETOS]: {
    [ROLES.COMERCIAL]: {
      [SECTIONS.GENERAL]: false, // Lock basic data
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.ACP_COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      // BUG corregido: acp_comercial es el editor de reactivos en compra
      // publica (equivalente a backoffice_comercial en compra privada, que
      // ya tenia esto en true abajo) -- determinationsGateService y
      // DETERMINATIONS_REACTIVO_PUBLIC_ROLES en el controller ya lo
      // esperaban, pero esta matriz lo bloqueaba antes de llegar ahi.
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.BACKOFFICE]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: true, // Can work on determinations
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.BACKOFFICE_COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_TECNICO]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_COMERCIAL]: {
      [SECTIONS.GENERAL]: true, // Can still adjust
      [SECTIONS.LAB_ENVIRONMENT]: true,
      [SECTIONS.EQUIPMENT]: true,
      [SECTIONS.LIS]: true,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_OPERACIONES]: {
      [SECTIONS.GENERAL]: true,
      [SECTIONS.LAB_ENVIRONMENT]: true,
      [SECTIONS.EQUIPMENT]: true,
      [SECTIONS.LIS]: true,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: true
    },
    [ROLES.JEFE_FINANCIERO]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: true
    },
    [ROLES.JEFE_TI]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.GERENCIA]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    }
  },

  // EN_EVALUACION_VIABILIDAD - Under evaluation
  [STATES.EN_EVALUACION_VIABILIDAD]: {
    [ROLES.COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.ACP_COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      // BUG corregido: acp_comercial edita reactivos en compra publica (ver
      // nota en DATOS_BASE_COMPLETOS).
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.BACKOFFICE]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.BACKOFFICE_COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_TECNICO]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_OPERACIONES]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: true
    },
    [ROLES.JEFE_FINANCIERO]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: true
    },
    [ROLES.JEFE_TI]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.GERENCIA]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    }
  },

  // OBSERVADO_POR_VIABILIDAD - Issues found, can adjust
  [STATES.OBSERVADO_POR_VIABILIDAD]: {
    [ROLES.COMERCIAL]: {
      [SECTIONS.GENERAL]: true, // Can fix issues
      [SECTIONS.LAB_ENVIRONMENT]: true,
      [SECTIONS.EQUIPMENT]: true,
      [SECTIONS.LIS]: true,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.ACP_COMERCIAL]: {
      [SECTIONS.GENERAL]: true,
      [SECTIONS.LAB_ENVIRONMENT]: true,
      [SECTIONS.EQUIPMENT]: true,
      [SECTIONS.LIS]: true,
      // BUG corregido: acp_comercial edita reactivos en compra publica (ver
      // nota en DATOS_BASE_COMPLETOS).
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.BACKOFFICE]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.BACKOFFICE_COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_TECNICO]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_COMERCIAL]: {
      [SECTIONS.GENERAL]: true,
      [SECTIONS.LAB_ENVIRONMENT]: true,
      [SECTIONS.EQUIPMENT]: true,
      [SECTIONS.LIS]: true,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_OPERACIONES]: {
      [SECTIONS.GENERAL]: true,
      [SECTIONS.LAB_ENVIRONMENT]: true,
      [SECTIONS.EQUIPMENT]: true,
      [SECTIONS.LIS]: true,
      [SECTIONS.DETERMINATIONS]: true,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: true
    },
    [ROLES.JEFE_FINANCIERO]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: true
    },
    [ROLES.JEFE_TI]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.GERENCIA]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    }
  },

  // VIABLE - Approved, moving to implementation
  [STATES.VIABLE]: {
    [ROLES.COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.ACP_COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.BACKOFFICE]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.BACKOFFICE_COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_TECNICO]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_OPERACIONES]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: true
    },
    [ROLES.JEFE_FINANCIERO]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: true
    },
    [ROLES.JEFE_TI]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.GERENCIA]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    }
  },

  // AJUSTES_OPERATIVOS - Implementation planning
  [STATES.AJUSTES_OPERATIVOS]: {
    [ROLES.COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.ACP_COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.BACKOFFICE]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.BACKOFFICE_COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_TECNICO]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_OPERACIONES]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: true
    },
    [ROLES.JEFE_FINANCIERO]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: true
    },
    [ROLES.JEFE_TI]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.GERENCIA]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    }
  },

  // CERRADO_PARA_APROBACION - Final approval stage
  [STATES.CERRADO_PARA_APROBACION]: {
    [ROLES.COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: false, // Lock everything except always-accessible investments
      [SECTIONS.PRICES]: false
    },
    [ROLES.ACP_COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: false,
      [SECTIONS.PRICES]: false
    },
    [ROLES.BACKOFFICE]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: false,
      [SECTIONS.PRICES]: false
    },
    [ROLES.BACKOFFICE_COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: false,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_TECNICO]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: false,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_COMERCIAL]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: false,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_OPERACIONES]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true, // Keep investments accessible
      [SECTIONS.PRICES]: false // Even jefe_operaciones cannot edit prices in final state
    },
    [ROLES.JEFE_FINANCIERO]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.JEFE_TI]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    },
    [ROLES.GERENCIA]: {
      [SECTIONS.GENERAL]: false,
      [SECTIONS.LAB_ENVIRONMENT]: false,
      [SECTIONS.EQUIPMENT]: false,
      [SECTIONS.LIS]: false,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
      [SECTIONS.PRICES]: false
    }
  }
};

class BusinessCasePermissions {
  /**
   * Check if a user can edit a specific section/field in a business case
   * @param {object} params - Permission check parameters
   * @param {string} params.role - User role
   * @param {string} params.canonicalState - Current canonical state
   * @param {string} params.section - Section to check (general, equipment, etc.)
   * @param {string} [params.field] - Specific field to check (for price validation)
   * @returns {boolean} True if editing is allowed
   */
  static canEdit({ role, canonicalState, section, field }) {
    // Validate inputs (canonicalState se valida mas abajo, despues del bypass
    // de INVESTMENTS -- esa seccion es state-independent por diseño y no debe
    // depender de que canonical_state ya este seteado).
    if (!role || !section) {
      return false;
    }

    // Normalizar roles nuevos a su canónico en la matriz
    const effectiveRole = ROLE_CANONICAL_MAP[role] ?? role;

    // Price-sensitive fields can ONLY be edited by jefe_operaciones o jefe_financiero
    if (field && PRICE_SENSITIVE_FIELDS.includes(field)) {
      return effectiveRole === ROLES.JEFE_OPERACIONES || effectiveRole === ROLES.JEFE_FINANCIERO;
    }

    // Investments section is ALWAYS accessible (state-independent)
    if (section === SECTIONS.INVESTMENTS) {
      return true;
    }

    if (!canonicalState) {
      return false;
    }

    // Check permission matrix
    const statePermissions = PERMISSION_MATRIX[canonicalState];
    if (!statePermissions) {
      return false;
    }

    const rolePermissions = statePermissions[effectiveRole];
    if (!rolePermissions) {
      return false;
    }

    return rolePermissions[section] || false;
  }

  /**
   * Get all sections a user can edit in the current state
   * @param {string} role - User role
   * @param {string} canonicalState - Current canonical state
   * @returns {string[]} Array of editable sections
   */
  static getEditableSections(role, canonicalState) {
    if (!role || !canonicalState) {
      return [];
    }

    const effectiveRole = ROLE_CANONICAL_MAP[role] ?? role;

    const statePermissions = PERMISSION_MATRIX[canonicalState];
    if (!statePermissions) {
      return [];
    }

    const rolePermissions = statePermissions[effectiveRole];
    if (!rolePermissions) {
      return [];
    }

    return Object.keys(rolePermissions).filter(section => rolePermissions[section]);
  }

  /**
   * Validate that all fields in an update payload are editable by the user
   * @param {object} params - Validation parameters
   * @param {string} params.role - User role
   * @param {string} params.canonicalState - Current canonical state
   * @param {object} params.updateData - Data being updated
   * @returns {object} Validation result with allowed/forbidden fields
   */
  static validateUpdatePayload({ role, canonicalState, updateData }) {
    const result = {
      allowed: {},
      forbidden: {},
      hasForbiddenFields: false
    };

    for (const [key, value] of Object.entries(updateData)) {
      // Skip non-section fields (like metadata, timestamps, etc.)
      const section = this.mapFieldToSection(key);
      const canEdit = this.canEdit({ role, canonicalState, section, field: key });

      if (canEdit) {
        result.allowed[key] = value;
      } else {
        result.forbidden[key] = value;
        result.hasForbiddenFields = true;
      }
    }

    return result;
  }

  /**
   * Map a field name to its section for permission checking
   * @param {string} fieldName - Database field name
   * @returns {string} Section name
   */
  static mapFieldToSection(fieldName) {
    const fieldMappings = {
      // General section
      'client_name': SECTIONS.GENERAL,
      'client_id': SECTIONS.GENERAL,
      'bc_purchase_type': SECTIONS.GENERAL,
      'business_case_type': SECTIONS.GENERAL,

      // Equipment section
      'bc_equipment_cost': SECTIONS.EQUIPMENT,
      'equipment_cost': SECTIONS.EQUIPMENT,
      'equipment_id': SECTIONS.EQUIPMENT,
      'equipment_name': SECTIONS.EQUIPMENT,

      // Prices section (special handling)
      'bc_target_margin_percentage': SECTIONS.PRICES,
      'target_margin_percentage': SECTIONS.PRICES,
      'bc_amortization_months': SECTIONS.PRICES,
      'amortization_months': SECTIONS.PRICES,

      // LIS section
      'bc_show_roi': SECTIONS.LIS,
      'bc_show_margin': SECTIONS.LIS,

      // Determinations section
      'bc_calculation_mode': SECTIONS.DETERMINATIONS,
      'calculation_mode': SECTIONS.DETERMINATIONS,

      // Investments section (always accessible)
      'extra': SECTIONS.INVESTMENTS, // Contains investment data
    };

    return fieldMappings[fieldName] || SECTIONS.GENERAL; // Default to general
  }

  /**
   * Get permission matrix for documentation/testing
   * @returns {object} Complete permission matrix
   */
  static getPermissionMatrix() {
    return { ...PERMISSION_MATRIX };
  }

  /**
   * Get valid roles
   * @returns {object} Role constants
   */
  static getRoles() {
    return { ...ROLES };
  }

  /**
   * Get valid sections
   * @returns {object} Section constants
   */
  static getSections() {
    return { ...SECTIONS };
  }

  /**
   * Normaliza un rol crudo (alias como asesor_comercial/jefe_de_comercial) a
   * su rol canonico. Usar en cualquier otro modulo del BC que necesite
   * comparar roles contra un set fijo, en vez de duplicar la lista de alias.
   * @param {string} role
   * @returns {string}
   */
  static normalizeRole(role) {
    return ROLE_CANONICAL_MAP[role] ?? role;
  }
}

module.exports = {
  BusinessCasePermissions,
  ROLES,
  SECTIONS,
  PRICE_SENSITIVE_FIELDS,
  ROLE_CANONICAL_MAP
};
