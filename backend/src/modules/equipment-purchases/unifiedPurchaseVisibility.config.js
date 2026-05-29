/**
 * Unified Purchase Visibility Configuration
 *
 * Define roles, dependencias y visibilidad dinámica por:
 * - Tipo de compra (public/private)
 * - Modalidad de compra privada (direct_purchase, rental, comodato)
 * - Rol del usuario
 * - Estado de la solicitud
 */

/**
 * Tipos de compra
 */
const PURCHASE_TYPES = {
  PUBLIC: 'public',
  PRIVATE: 'private'
};

/**
 * Modalidades de compra privada
 */
const PRIVATE_MODALITIES = {
  DIRECT_PURCHASE: 'direct_purchase',
  RENTAL: 'rental',
  RENTAL_WITH_TRANSFER: 'rental_with_transfer',
  COMODATO: 'comodato'
};

/**
 * Roles por tipo de compra
 */
const ROLES_BY_PURCHASE_TYPE = {
  [PURCHASE_TYPES.PUBLIC]: {
    viewer: ['gerencia', 'gerencia_general', 'jefe_comercial', 'acp_comercial', 'backoffice_comercial', 'jefe_operaciones', 'operaciones', 'jefe_logistica', 'logistica', 'tecnico', 'jefe_tecnico', 'jefe_servicio_tecnico'],
    comercial: ['jefe_comercial', 'backoffice_comercial', 'gerencia', 'gerencia_general'],
    acp: ['acp_comercial', 'jefe_comercial', 'gerencia', 'gerencia_general'],
    operaciones: ['jefe_operaciones', 'operaciones', 'jefe_logistica', 'logistica'],
    tecnico: ['tecnico', 'jefe_tecnico', 'jefe_servicio_tecnico']
  },
  [PURCHASE_TYPES.PRIVATE]: {
    viewer: ['gerencia', 'gerencia_general', 'jefe_comercial', 'backoffice_comercial', 'jefe_operaciones', 'operaciones', 'jefe_logistica', 'logistica', 'tecnico', 'jefe_tecnico', 'jefe_servicio_tecnico'],
    comercial: ['jefe_comercial', 'backoffice_comercial', 'gerencia', 'gerencia_general'],
    operaciones: ['jefe_operaciones', 'operaciones', 'jefe_logistica', 'logistica'],
    tecnico: ['tecnico', 'jefe_tecnico', 'jefe_servicio_tecnico']
  }
};

/**
 * Tabs visibles por tipo de compra y rol
 */
const TABS_VISIBILITY = {
  [PURCHASE_TYPES.PUBLIC]: {
    // Todos los tabs son visibles para compra pública
    commercial: { roles: ['*'] },
    availability: { roles: ['*'] },
    public_acp: { roles: ['*'] }, // Solo para compra pública
    contract: { roles: ['*'] },
    equipment_logistics: { roles: ['*'] },
    technical: { roles: ['*'] },
    training: { roles: ['*'] },
    supply_control: { roles: ['*'] },
    timeline: { roles: ['*'] }
  },
  [PURCHASE_TYPES.PRIVATE]: {
    commercial: { roles: ['*'] },
    availability: { roles: ['*'] },
    contract: { roles: ['*'] },
    equipment_logistics: { roles: ['*'] },
    technical: { roles: ['*'] },
    training: { roles: ['*'] },
    supply_control: { roles: ['*'] },
    timeline: { roles: ['*'] },
    // NO hay tab de ACP para compra privada
    public_acp: { hidden: true }
  }
};

/**
 * Acciones permitidas por estado y rol
 */
const ACTIONS_BY_STATE = {
  // Estados iniciales
  pending_commercial: {
    [PURCHASE_TYPES.PUBLIC]: {
      set_purchase_type: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PUBLIC].comercial },
      start_business_case: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PUBLIC].comercial }
    },
    [PURCHASE_TYPES.PRIVATE]: {
      set_purchase_type: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PRIVATE].comercial },
      set_private_modality: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PRIVATE].comercial },
      start_business_case: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PRIVATE].comercial, only_if: { modality: PRIVATE_MODALITIES.COMODATO } }
    }
  },
  pending_backoffice: {
    [PURCHASE_TYPES.PUBLIC]: {
      send_to_acp: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PUBLIC].comercial },
      set_availability: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PUBLIC].acp }
    },
    [PURCHASE_TYPES.PRIVATE]: {
      send_to_acp: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PRIVATE].comercial },
      set_availability: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PRIVATE].comercial },
      send_offer: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PRIVATE].comercial }
    }
  },
  acp_availability_requested: {
    [PURCHASE_TYPES.PUBLIC]: {
      confirm_acp_availability: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PUBLIC].acp },
      return_to_backoffice: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PUBLIC].acp }
    },
    [PURCHASE_TYPES.PRIVATE]: {
      confirm_acp_availability: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PRIVATE].comercial },
      return_to_backoffice: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PRIVATE].comercial }
    }
  },
  acp_availability_confirmed: {
    [PURCHASE_TYPES.PUBLIC]: {
      return_to_backoffice: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PUBLIC].acp }
    },
    [PURCHASE_TYPES.PRIVATE]: {
      send_offer: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PRIVATE].comercial }
    }
  },
  offer_sent: {
    [PURCHASE_TYPES.PUBLIC]: {},
    [PURCHASE_TYPES.PRIVATE]: {
      upload_signed_offer: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PRIVATE].comercial }
    }
  },
  offer_signed: {
    [PURCHASE_TYPES.PUBLIC]: {},
    [PURCHASE_TYPES.PRIVATE]: {
      upload_contract: { roles: ROLES_BY_PURCHASE_TYPE[PURCHASE_TYPES.PRIVATE].comercial }
    }
  }
};

/**
 * Dependencias entre estados (requisitos para avanzar)
 */
const STATE_DEPENDENCIES = {
  // Para contrato: requiere oferta firmada
  contract_draft_uploaded: {
    requires: {
      [PURCHASE_TYPES.PRIVATE]: ['offer_signed'],
      [PURCHASE_TYPES.PUBLIC]: ['public_portal_outcome_ganado']
    }
  }
};

/**
 * Verifica si un rol tiene acceso a un tipo de compra
 */
function hasRoleAccess(purchaseType, userRole, requiredRoles = []) {
  if (requiredRoles.includes('*')) return true;
  return requiredRoles.includes(userRole);
}

/**
 * Verifica si un tab es visible para un usuario
 */
function isTabVisible(tabKey, purchaseType, userRole) {
  const tabConfig = TABS_VISIBILITY[purchaseType]?.[tabKey];
  if (!tabConfig) return false;
  if (tabConfig.hidden) return false;
  return hasRoleAccess(purchaseType, userRole, tabConfig.roles);
}

/**
 * Verifica si una acción está permitida para un usuario
 */
function isActionAllowed(actionKey, state, purchaseType, userRole, extra = {}) {
  const stateConfig = ACTIONS_BY_STATE[state]?.[purchaseType];
  if (!stateConfig) return false;
  
  const actionConfig = stateConfig[actionKey];
  if (!actionConfig) return false;
  
  // Verificar rol
  if (!hasRoleAccess(purchaseType, userRole, actionConfig.roles)) {
    return false;
  }
  
  // Verificar condiciones adicionales (only_if)
  if (actionConfig.only_if) {
    const conditions = actionConfig.only_if;
    for (const [key, value] of Object.entries(conditions)) {
      if (extra[key] !== value) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Obtiene la lista de tabs visibles para un usuario
 */
function getVisibleTabs(purchaseType, userRole) {
  const allTabs = Object.keys(TABS_VISIBILITY[purchaseType] || {});
  return allTabs.filter(tab => isTabVisible(tab, purchaseType, userRole));
}

/**
 * Obtiene la lista de acciones permitidas para un usuario
 */
function getAllowedActions(state, purchaseType, userRole, extra = {}) {
  const stateConfig = ACTIONS_BY_STATE[state]?.[purchaseType];
  if (!stateConfig) return [];
  
  return Object.keys(stateConfig).filter(action => 
    isActionAllowed(action, state, purchaseType, userRole, extra)
  );
}

module.exports = {
  PURCHASE_TYPES,
  PRIVATE_MODALITIES,
  ROLES_BY_PURCHASE_TYPE,
  TABS_VISIBILITY,
  ACTIONS_BY_STATE,
  STATE_DEPENDENCIES,
  hasRoleAccess,
  isTabVisible,
  isActionAllowed,
  getVisibleTabs,
  getAllowedActions
};
