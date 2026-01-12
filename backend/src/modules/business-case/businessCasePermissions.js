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
  JEFE_TECNICO: 'jefe_tecnico',
  JEFE_COMERCIAL: 'jefe_comercial',
  JEFE_OPERACIONES: 'jefe_operaciones'
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
      [SECTIONS.DETERMINATIONS]: false,
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
    }
  },

  // DATOS_BASE_COMPLETOS - Data entry completed
  [STATES.DATOS_BASE_COMPLETOS]: {
    [ROLES.COMERCIAL]: {
      [SECTIONS.GENERAL]: false, // Lock basic data
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
      [SECTIONS.DETERMINATIONS]: true, // Can work on determinations
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
      [SECTIONS.DETERMINATIONS]: false,
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
    }
  },

  // OBSERVADO_POR_VIABILIDAD - Issues found, can adjust
  [STATES.OBSERVADO_POR_VIABILIDAD]: {
    [ROLES.COMERCIAL]: {
      [SECTIONS.GENERAL]: true, // Can fix issues
      [SECTIONS.LAB_ENVIRONMENT]: true,
      [SECTIONS.EQUIPMENT]: true,
      [SECTIONS.LIS]: true,
      [SECTIONS.DETERMINATIONS]: false,
      [SECTIONS.INVESTMENTS]: true,
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
    // Validate inputs
    if (!role || !canonicalState || !section) {
      return false;
    }

    // Price-sensitive fields can ONLY be edited by jefe_operaciones
    if (field && PRICE_SENSITIVE_FIELDS.includes(field)) {
      return role === ROLES.JEFE_OPERACIONES;
    }

    // Investments section is ALWAYS accessible (state-independent)
    if (section === SECTIONS.INVESTMENTS) {
      return true;
    }

    // Check permission matrix
    const statePermissions = PERMISSION_MATRIX[canonicalState];
    if (!statePermissions) {
      return false;
    }

    const rolePermissions = statePermissions[role];
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

    const statePermissions = PERMISSION_MATRIX[canonicalState];
    if (!statePermissions) {
      return [];
    }

    const rolePermissions = statePermissions[role];
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
}

module.exports = {
  BusinessCasePermissions,
  ROLES,
  SECTIONS,
  PRICE_SENSITIVE_FIELDS
};
