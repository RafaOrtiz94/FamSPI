/**
 * Purchase Request Mapper - DTO to API payload transformation
 */

/**
 * Maps internal DTO to API payload for equipment purchases
 * @param {Object} dto - Internal DTO
 * @returns {Object} API payload
 */
export const mapDtoToApi = (dto) => {
    const {
        clientId,
        clientName,
        clientEmail,
        assignedTo,
        equipment,
        notes,
        requiresLis,
        lisOption,
        // Extended fields for optional mode
        fechaTentativaVisita,
        fechaInstalacion,
        fechaTopeInstalacion,
        anotaciones,
        accesorios,
        observaciones,
        // Metadata
        _metadata = {}
    } = dto;

    // Normalize field names from camelCase to snake_case
    const payload = {
        client_id: clientId,
        client_name: clientName,
        client_email: clientEmail,
        assigned_to: assignedTo,
        equipment: equipment.map(item => ({
            id: item.id,
            type: item.type,
        })),
        notes: notes || '',
        // Extra data - includes LIS config and metadata (backend ignores _metadata at root)
        extra: {
            requires_lis: requiresLis || false,
            lis_system: requiresLis ? lisOption : null,
            // Metadata moved inside extra (backend persists this)
            _metadata: {
                source: _metadata.source || 'unknown',
                intent: _metadata.intent || 'provider_handoff',
                mode: _metadata.mode || 'acp_required',
                version: _metadata.version || '2.0'
            },
            // Extended fields only if they have values
            ...(fechaTentativaVisita && { fecha_tentativa_visita: fechaTentativaVisita }),
            ...(fechaInstalacion && { fecha_instalacion: fechaInstalacion }),
            ...(fechaTopeInstalacion && { fecha_tope_instalacion: fechaTopeInstalacion }),
            ...(anotaciones && { anotaciones }),
            ...(accesorios && { accesorios }),
            ...(observaciones && { observaciones })
        }
    };

    return payload;
};

/**
 * Maps API response back to internal DTO format
 * @param {Object} apiResponse - API response
 * @returns {Object} Internal DTO
 */
export const mapApiToDto = (apiResponse) => {
    // This would be used if we need to convert API responses back to DTO format
    // For now, keeping it simple as the modal doesn't need this
    return apiResponse;
};

/**
 * Validates DTO before mapping
 * @param {Object} dto - Internal DTO
 * @throws {Error} If validation fails
 */
export const validateDto = (dto) => {
    if (!dto.clientId) {
        throw new Error('clientId is required');
    }

    if (!dto.equipment || !Array.isArray(dto.equipment) || dto.equipment.length === 0) {
        throw new Error('At least one equipment item is required');
    }

    if (dto.requiresLis && !dto.lisOption) {
        throw new Error('lisOption is required when requiresLis is true');
    }

    // Mode-specific validations
    if (dto._metadata?.mode === 'acp_required' && !dto.assignedTo) {
        throw new Error('assignedTo is required in acp_required mode');
    }

    return true;
};
