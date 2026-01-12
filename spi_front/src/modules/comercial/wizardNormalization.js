/**
 * Business Case Wizard Normalization Layer
 *
 * Provides canonical naming for frontend components while maintaining
 * backward compatibility with external data sources (API, localStorage).
 *
 * This layer ensures:
 * - Components use canonical names internally
 * - External data is normalized on input
 * - External data is denormalized on output
 * - Zero breaking changes to existing functionality
 */

// ============================================================================
// FIELD NAME MAPPINGS
// ============================================================================

const FIELD_MAPPINGS = {
  // State-level mappings
  bcType: 'businessCaseType',
  equipmentConfig: 'equipmentConfiguration',
  primary: 'primaryEquipment',
  backup: 'backupEquipment',
  secondary: 'secondaryEquipment',

  // Form field mappings
  lisIncludes: 'includesLis',
  lisIncludesHardware: 'includesLisHardware',
  requirementsDeadlineMonths: 'deadlineMonths',
  requirementsProjectedDeadlineMonths: 'projectedDeadlineMonths',

  // Component prop mappings
  onPrev: 'onPrevious',
};

// ============================================================================
// INPUT ADAPTERS (Normalize incoming data to canonical names)
// ============================================================================

/**
 * Normalizes wizard state from external sources (API, localStorage)
 * @param {Object} rawState - Raw state from external source
 * @returns {Object} - State with canonical field names
 */
export const normalizeWizardState = (rawState) => {
  if (!rawState || typeof rawState !== 'object') {
    return rawState;
  }

  const normalized = { ...rawState };

  // Apply field mappings
  Object.entries(FIELD_MAPPINGS).forEach(([legacyName, canonicalName]) => {
    if (normalized.hasOwnProperty(legacyName) && !normalized.hasOwnProperty(canonicalName)) {
      normalized[canonicalName] = normalized[legacyName];
    }
  });

  // Special handling for nested objects
  if (normalized.equipmentConfiguration || normalized.equipmentConfig) {
    const equipmentSource = normalized.equipmentConfiguration || normalized.equipmentConfig;
    normalized.equipmentConfiguration = {
      primaryEquipment: equipmentSource.primary || equipmentSource.primaryEquipment,
      backupEquipment: equipmentSource.backup || equipmentSource.backupEquipment,
      secondaryEquipment: equipmentSource.secondary || equipmentSource.secondaryEquipment,
    };
  }

  return normalized;
};

/**
 * Normalizes API response data to canonical names
 * @param {Object} apiData - Raw API response data
 * @returns {Object} - Data with canonical field names
 */
export const normalizeApiResponse = (apiData) => {
  if (!apiData || typeof apiData !== 'object') {
    return apiData;
  }

  const normalized = { ...apiData };

  // API-specific mappings (snake_case to camelCase)
  const apiMappings = {
    bc_type: 'businessCaseType',
    business_case_id: 'businessCaseId',
    calculation_mode: 'calculationMode',
    annual_quantity: 'annualQuantity',
    monthly_quantity: 'monthlyQuantity',
    determination_id: 'determinationId',
  };

  Object.entries(apiMappings).forEach(([apiName, canonicalName]) => {
    if (normalized.hasOwnProperty(apiName)) {
      normalized[canonicalName] = normalized[apiName];
    }
  });

  return normalized;
};

// ============================================================================
// OUTPUT ADAPTERS (Denormalize outgoing data to legacy names)
// ============================================================================

/**
 * Denormalizes wizard state for external storage (localStorage, API)
 * @param {Object} canonicalState - State with canonical field names
 * @returns {Object} - State with legacy field names for compatibility
 */
export const denormalizeWizardState = (canonicalState) => {
  if (!canonicalState || typeof canonicalState !== 'object') {
    return canonicalState;
  }

  const denormalized = { ...canonicalState };

  // Reverse field mappings for storage
  Object.entries(FIELD_MAPPINGS).forEach(([legacyName, canonicalName]) => {
    if (denormalized.hasOwnProperty(canonicalName) && !denormalized.hasOwnProperty(legacyName)) {
      denormalized[legacyName] = denormalized[canonicalName];
    }
  });

  // Special handling for nested equipment configuration
  if (denormalized.equipmentConfiguration) {
    denormalized.equipmentConfig = {
      primary: denormalized.equipmentConfiguration.primaryEquipment,
      backup: denormalized.equipmentConfiguration.backupEquipment,
      secondary: denormalized.equipmentConfiguration.secondaryEquipment,
    };
  }

  return denormalized;
};

/**
 * Denormalizes data for API requests (maintains backward compatibility)
 * @param {Object} canonicalData - Data with canonical field names
 * @returns {Object} - Data with legacy field names for API compatibility
 */
export const denormalizeApiRequest = (canonicalData) => {
  if (!canonicalData || typeof canonicalData !== 'object') {
    return canonicalData;
  }

  const denormalized = { ...canonicalData };

  // API expects snake_case and legacy field names
  const apiDenormalizations = {
    businessCaseType: 'bc_type',
    businessCaseId: 'business_case_id',
    calculationMode: 'calculation_mode',
    annualQuantity: 'annual_quantity',
    monthlyQuantity: 'monthly_quantity',
    determinationId: 'determination_id',
  };

  Object.entries(apiDenormalizations).forEach(([canonicalName, apiName]) => {
    if (denormalized.hasOwnProperty(canonicalName)) {
      denormalized[apiName] = denormalized[canonicalName];
    }
  });

  return denormalized;
};

// ============================================================================
// CANONICAL SELECTORS (Provide clean access to canonical data)
// ============================================================================

/**
 * Selector for business case type with canonical naming
 * @param {Object} state - Wizard state
 * @returns {string} - Canonical business case type
 */
export const selectBusinessCaseType = (state) => {
  return state.businessCaseType || state.bcType || 'comodato_publico';
};

/**
 * Selector for business case ID with canonical naming
 * @param {Object} state - Wizard state
 * @returns {string|null} - Canonical business case ID
 */
export const selectBusinessCaseId = (state) => {
  return state.businessCaseId || state.business_case_id || null;
};

/**
 * Selector for equipment configuration with canonical naming
 * @param {Object} state - Wizard state
 * @returns {Object} - Canonical equipment configuration
 */
export const selectEquipmentConfiguration = (state) => {
  const config = state.equipmentConfiguration || state.equipmentConfig || {};
  return {
    primaryEquipment: config.primaryEquipment || config.primary || null,
    backupEquipment: config.backupEquipment || config.backup || null,
    secondaryEquipment: config.secondaryEquipment || config.secondary || [],
  };
};

/**
 * Selector for calculation mode with canonical naming
 * @param {Object} state - Wizard state
 * @returns {string} - Canonical calculation mode
 */
export const selectCalculationMode = (state) => {
  return state.calculationMode || state.calculation_mode || 'annual';
};

/**
 * Selector for determinations with canonical quantity fields
 * @param {Array} determinations - Raw determinations array
 * @returns {Array} - Determinations with canonical field names
 */
export const selectCanonicalDeterminations = (determinations) => {
  if (!Array.isArray(determinations)) return [];

  return determinations.map(det => ({
    ...det,
    annualQuantity: det.annualQuantity || det.annual_quantity || det.annualQty || 0,
    monthlyQuantity: det.monthlyQuantity || det.monthly_quantity || det.monthlyQty || 0,
  }));
};

// ============================================================================
// COMPONENT PROP NORMALIZERS
// ============================================================================

/**
 * Normalizes component props to accept both legacy and canonical names
 * @param {Object} props - Component props
 * @returns {Object} - Props with canonical names
 */
export const normalizeComponentProps = (props) => {
  if (!props || typeof props !== 'object') {
    return props;
  }

  const normalized = { ...props };

  // Component prop mappings
  if (props.onPrev && !props.onPrevious) {
    normalized.onPrevious = props.onPrev;
  }

  return normalized;
};

// ============================================================================
// SAFETY GUARANTEES
// ============================================================================

/**
 * Validates that normalization is working correctly
 * @param {Object} original - Original data
 * @param {Object} normalized - Normalized data
 * @param {Object} denormalized - Denormalized data
 * @returns {boolean} - True if round-trip conversion works
 */
export const validateNormalization = (original, normalized, denormalized) => {
  // Check that denormalized data can recreate original structure
  const roundTrip = denormalizeWizardState(normalizeWizardState(original));

  // Deep equality check (simplified)
  return JSON.stringify(roundTrip) === JSON.stringify(original);
};

/**
 * Creates a safe wrapper for state updates that maintains backward compatibility
 * @param {Function} updateFn - Original state update function
 * @returns {Function} - Wrapped update function
 */
export const createSafeStateUpdater = (updateFn) => {
  return (updater) => {
    if (typeof updater === 'function') {
      updateFn((prevState) => {
        const canonicalPrev = normalizeWizardState(prevState);
        const canonicalNext = updater(canonicalPrev);
        const legacyNext = denormalizeWizardState(canonicalNext);
        return legacyNext;
      });
    } else {
      const canonicalUpdater = normalizeWizardState(updater);
      const legacyUpdater = denormalizeWizardState(canonicalUpdater);
      updateFn(legacyUpdater);
    }
  };
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Checks if a field name is canonical
 * @param {string} fieldName - Field name to check
 * @returns {boolean} - True if field name is canonical
 */
export const isCanonicalField = (fieldName) => {
  return Object.values(FIELD_MAPPINGS).includes(fieldName);
};

/**
 * Gets the canonical name for a field (or returns original if already canonical)
 * @param {string} fieldName - Field name to canonicalize
 * @returns {string} - Canonical field name
 */
export const getCanonicalFieldName = (fieldName) => {
  return FIELD_MAPPINGS[fieldName] || fieldName;
};

/**
 * Gets the legacy name for a canonical field
 * @param {string} canonicalName - Canonical field name
 * @returns {string} - Legacy field name
 */
export const getLegacyFieldName = (canonicalName) => {
  const entry = Object.entries(FIELD_MAPPINGS).find(([legacy, canonical]) => canonical === canonicalName);
  return entry ? entry[0] : canonicalName;
};
