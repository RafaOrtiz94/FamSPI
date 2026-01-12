/**
 * Purchase Request Modes - Configuration for different modal behaviors
 */

/**
 * Mode configurations for purchase request modals
 *
 * NOTE: Only acp_required is supported since backend doesn't support auto-assignment
 */
export const PURCHASE_MODES = {
    acp_required: {
        id: 'acp_required',
        label: 'ACP Obligatorio',
        description: 'Asignación ACP mandatoria para gestión de proveedores',

        // Validation rules
        validations: {
            assignedToRequired: true,
            equipmentRequired: true,
            clientRequired: true,
            acpAutoAssign: false // Backend doesn't support auto-assignment
        },

        // UI configuration
        ui: {
            acpLabel: 'Asignar a',
            acpPlaceholder: 'Selecciona un ACP Comercial',
            acpRequired: true,
            acpHelpText: null,
            lisLabel: 'El cliente requiere LIS',
            lisOptions: ['Cobas Infinity', 'Orion'],
            buttonText: 'Enviar a ACP',
            successMessage: 'Solicitud enviada al ACP Comercial'
        },

        // Default values
        defaults: {
            assignedTo: 'first_available' // Auto-select first ACP
        }
    }

    // REMOVED: acp_optional_autoassign - Backend doesn't support auto-assignment
};

/**
 * Get mode configuration by ID
 * @param {string} modeId - Mode identifier
 * @returns {Object} Mode configuration
 */
export const getModeConfig = (modeId) => {
    const config = PURCHASE_MODES[modeId];
    if (!config) {
        throw new Error(`Unknown purchase mode: ${modeId}`);
    }
    return config;
};

/**
 * Validate form data against mode rules
 * @param {Object} formData - Form data
 * @param {string} modeId - Mode identifier
 * @returns {Object} Validation result { isValid, errors }
 */
export const validateFormForMode = (formData, modeId) => {
    const mode = getModeConfig(modeId);
    const errors = [];

    // Required field validations
    if (mode.validations.clientRequired && !formData.clientId) {
        errors.push('Cliente es requerido');
    }

    if (mode.validations.equipmentRequired &&
        (!formData.equipment || !Array.isArray(formData.equipment) || formData.equipment.length === 0)) {
        errors.push('Al menos un equipo es requerido');
    }

    if (mode.validations.assignedToRequired && !formData.assignedTo) {
        errors.push('Debes asignar la solicitud a un ACP Comercial');
    }

    if (formData.requiresLis && !formData.lisOption) {
        const lisError = modeId === 'acp_required'
            ? "Selecciona la plataforma LIS solicitada"
            : "Selecciona el tipo de LIS";
        errors.push(lisError);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Get LIS options for a specific mode
 * @param {string} modeId - Mode identifier
 * @returns {Array} LIS options
 */
export const getLisOptionsForMode = (modeId) => {
    const mode = getModeConfig(modeId);
    return mode.ui.lisOptions;
};

/**
 * Check if mode supports extended fields
 * @param {string} modeId - Mode identifier
 * @returns {boolean} True if extended fields are supported
 */
export const modeSupportsExtendedFields = (modeId) => {
    const mode = getModeConfig(modeId);
    return !!(mode.extendedFields && mode.extendedFields.length > 0);
};

/**
 * Get extended fields for a mode
 * @param {string} modeId - Mode identifier
 * @returns {Array} Extended field names
 */
export const getExtendedFieldsForMode = (modeId) => {
    const mode = getModeConfig(modeId);
    return mode.extendedFields || [];
};
