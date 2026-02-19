/**
 * Private Purchases API
 *
 * Cliente API para gestión de compras privadas.
 * Proporciona interfaz unificada para todas las operaciones del workflow.
 */

import api from './index';
import logger from '../utils/logger';

// ===== CONSTANTES =====
export const PRIVATE_PURCHASE_ENDPOINTS = {
  BASE: '/private-purchases',
  MINE: '/private-purchases/mine',
  BY_ROLE: '/private-purchases/by-role',
  TRANSITION: '/private-purchases/:id/transition',
  CLIENT_REGISTRATION: '/private-purchases/:id/client-registration',
  DELIVERY_DATES: '/private-purchases/:id/delivery-dates',
  READY_FOR_DELIVERY: '/private-purchases/:id/ready-for-delivery',
  COMPLETE_DELIVERY: '/private-purchases/:id/complete-delivery',
  CANCEL: '/private-purchases/:id/cancel',
  STATS: '/private-purchases/stats',
  TRANSITIONS: '/private-purchases/:id/transitions',
  VALIDATE_TRANSITION: '/private-purchases/:id/validate-transition',
  OFFER: '/private-purchases/:id/offer',
  SIGNED_OFFER: '/private-purchases/:id/offer/signed',
  REGISTER_CLIENT: '/private-purchases/:id/register-client',
  REQUEST_CLIENT_REGISTRATION: '/private-purchases/:id/request-client-registration',
  SEND_TO_ACP: '/private-purchases/:id/send-to-acp',
  START_AVAILABILITY: '/private-purchases/:id/start-availability',
  PROVIDER_RESPONSE: '/private-purchases/:id/provider-response',
  SUBMIT_CONTRACT: '/private-purchases/:id/submit-contract',
  CONTRACT_CLIENT_SIGNED: '/private-purchases/:id/contract/client-signed',
  INSPECTION_REQUEST: '/private-purchases/:id/inspection-request',
  COORDINATE_INSPECTION_DATE: '/private-purchases/:id/coordinate-inspection-date',
  REVIEW_INSPECTION_DATE: '/private-purchases/:id/review-inspection-date',
  DELIVERY_GUIDES: '/private-purchases/:id/delivery-guides',
  REQUEST_DELIVERY_DATES: '/private-purchases/:id/request-delivery-dates',
  SUBMIT_DELIVERY_DATES: '/private-purchases/:id/submit-delivery-dates',
  DOCUMENTS: '/private-purchases/:id/documents',
  MARK_EQUIPMENT_ARRIVED: '/private-purchases/:id/mark-equipment-arrived',
  DELIVERY_ACT: '/private-purchases/:id/delivery-act',
  DELIVERY_ACT_ASSIGN: '/private-purchases/:id/delivery-act/assign',
  DELIVERY_ACT_FINALIZE: '/private-purchases/:id/delivery-act/finalize',
  DISPATCH_DETAILS: '/private-purchases/:id/dispatch-details'
};

export const PRIVATE_PURCHASE_STATES = {
  PENDING_COMMERCIAL: 'pending_commercial',
  PENDING_BACKOFFICE: 'pending_backoffice',
  OFFER_SENT: 'offer_sent',
  PENDING_MANAGER_SIGNATURE: 'pending_manager_signature',
  PENDING_CLIENT_SIGNATURE: 'pending_client_signature',
  OFFER_SIGNED: 'offer_signed',
  OFFER_REJECTED_BY_COMMERCIAL: 'offer_rejected_by_commercial',
  PRICE_IMPROVEMENT_REQUESTED: 'price_improvement_requested',
  CLIENT_REGISTRATION_REQUESTED: 'client_registration_requested',
  CLIENT_REGISTERED: 'client_registered',
  INSPECTION_REQUESTED: 'inspection_requested',
  SENT_TO_ACP: 'sent_to_acp',
  ACP_AVAILABILITY_REQUESTED: 'acp_availability_requested',
  ACP_AVAILABILITY_CONFIRMED: 'acp_availability_confirmed',
  ACP_AVAILABILITY_REJECTED: 'acp_availability_rejected',
  PENDING_CONTRACT_APPROVAL: 'pending_contract_approval',
  PENDING_CONTRACT_CLIENT_SIGNATURE: 'pending_contract_client_signature',
  CONTRACT_AVAILABLE: 'contract_available',
  CONTRACT_REJECTED: 'contract_rejected',
  DELIVERY_DATES_REQUESTED: 'delivery_dates_requested',
  DELIVERY_DATES_SUBMITTED: 'delivery_dates_submitted',
  CALENDAR_EVENTS_CREATED: 'calendar_events_created',
  WAITING_DISPATCH: 'waiting_dispatch',
  DISPATCH_READY: 'dispatch_ready',
  DELIVERY_ACT_DRAFT_READY: 'delivery_act_draft_ready',
  DELIVERY_ACT_TECH_ASSIGNED: 'delivery_act_tech_assigned',
  DELIVERY_ACT_LOGISTICS_SIGNED: 'delivery_act_logistics_signed',
  DELIVERY_ACT_GENERATED: 'delivery_act_generated',
  DELIVERED: 'delivered_signed',
  REJECTED: 'rejected',
  BUSINESS_CASE_IN_PROGRESS: 'business_case_in_progress',
  BUSINESS_CASE_UNDER_REVIEW: 'business_case_under_review',
  BUSINESS_CASE_FEASIBILITY_APPROVED: 'business_case_feasibility_approved',
  BUSINESS_CASE_REJECTED: 'business_case_rejected'
};

export const FLOW_TYPES = {
  DIRECT_PURCHASE: 'direct_purchase',
  RENTAL: 'rental',
  COMODATO: 'comodato'
};

// ===== FUNCIONES API =====

/**
 * Crear nueva solicitud de compra privada
 * @param {Object} data - Datos de la solicitud
 * @param {Object} data.client_data - Datos del cliente
 * @param {Array} data.equipment - Lista de equipos
 * @param {string} data.offer_kind - Tipo de oferta (venta, alquiler, comodato)
 * @param {string} data.notes - Notas adicionales
 * @returns {Promise<Object>} Respuesta del servidor
 */
export const createPrivatePurchaseRequest = async (data, config = {}) => {
  const startTime = Date.now();

  logger.apiCall("POST", PRIVATE_PURCHASE_ENDPOINTS.BASE, {
    client_data_keys: Object.keys(data.client_data || {}),
    equipment_count: data.equipment?.length || 0,
    offer_kind: data.offer_kind || 'venta'
  });

  logger.requestFlow("CREACION_SOLICITUD_FE", "Creando solicitud privada desde FE", {
    client_name: data.client_data?.commercial_name || data.client_data?.legal_person_business_name,
    equipment_count: data.equipment?.length || 0,
    offer_kind: data.offer_kind || 'venta'
  });

  logger.requestFlow("CREACIÓN_SOLICITUD", "Iniciando creación de solicitud de compra privada", {
    client_name: data.client_data?.commercial_name || data.client_data?.legal_person_business_name,
    equipment_count: data.equipment?.length || 0,
    offer_kind: data.offer_kind || 'venta'
  });

  try {
    logger.requestFlow("ENVIO_DATOS", "Enviando datos de solicitud al servidor", {
      client_data_size: JSON.stringify(data.client_data || {}).length,
      equipment_data_size: JSON.stringify(data.equipment || []).length
    });

    const response = await api.post(
      PRIVATE_PURCHASE_ENDPOINTS.BASE,
      {
        client_data: data.client_data,
        equipment: data.equipment,
        offer_kind: data.offer_kind || 'venta',
        notes: data.notes || ''
      },
      config
    );

    if (!response.data?.ok) {
      logger.error("❌ Respuesta inválida del servidor al crear solicitud", {
        response_data: response.data,
        offer_kind: data.offer_kind
      });
      throw new Error(response.data?.message || 'Error creando solicitud');
    }

    logger.performance("Creación de solicitud de compra privada", startTime);
    logger.success("✅ Solicitud de compra privada creada exitosamente", {
      request_id: response.data?.data?.id,
      client_name: data.client_data?.commercial_name,
      status: response.data?.data?.status,
      offer_kind: data.offer_kind
    });

    return response.data.data;
  } catch (error) {
    logger.error("❌ Error creando solicitud de compra privada", error, {
      client_data_keys: Object.keys(data.client_data || {}),
      equipment_count: data.equipment?.length || 0,
      processing_time: `${Date.now() - startTime}ms`,
      response_status: error?.response?.status
    });
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Alias para createPrivatePurchaseRequest (compatibilidad)
 * @param {Object} data - Datos de la solicitud
 * @returns {Promise<Object>} Respuesta del servidor
 */
export const createPrivatePurchase = createPrivatePurchaseRequest;

/**
 * Obtener solicitud por ID
 * @param {string} id - ID de la solicitud
 * @returns {Promise<Object>} Datos de la solicitud
 */
export const getPrivatePurchaseById = async (id) => {
  try {
    const response = await api.get(`${PRIVATE_PURCHASE_ENDPOINTS.BASE}/${id}`);

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error obteniendo solicitud');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error obteniendo solicitud ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Obtener timeline por ID
 * @param {string} id - ID de la solicitud
 * @returns {Promise<Object>} Timeline
 */
export const getPrivatePurchaseTimeline = async (id) => {
  try {
    const response = await api.get(`${PRIVATE_PURCHASE_ENDPOINTS.BASE}/${id}/timeline`);

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error obteniendo timeline');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error obteniendo timeline ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Listar solicitudes del usuario actual
 * @returns {Promise<Array>} Lista de solicitudes
 */
export const getMyPrivatePurchases = async () => {
  try {
    const response = await api.get(PRIVATE_PURCHASE_ENDPOINTS.MINE);

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error obteniendo solicitudes');
    }

    return response.data.data || [];
  } catch (error) {
    console.error('[PrivatePurchasesAPI] Error obteniendo mis solicitudes:', error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Listar solicitudes por rol (dashboard)
 * @param {string} role - Rol del usuario
 * @returns {Promise<Array>} Lista de solicitudes filtradas por rol
 */
export const getPrivatePurchasesByRole = async (role) => {
  try {
    const response = await api.get(`${PRIVATE_PURCHASE_ENDPOINTS.BY_ROLE}/${role}`);

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error obteniendo solicitudes por rol');
    }

    return response.data.data || [];
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error obteniendo solicitudes por rol ${role}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Transición de estado de una solicitud
 * @param {string} id - ID de la solicitud
 * @param {string} toState - Estado destino
 * @param {string} reason - Razón del cambio (opcional)
 * @returns {Promise<Object>} Resultado de la transición
 */
export const transitionPrivatePurchaseState = async (id, toState, reason = '') => {
  const startTime = Date.now();

  logger.apiCall("POST", PRIVATE_PURCHASE_ENDPOINTS.TRANSITION.replace(':id', id), {
    to_state: toState,
    reason: reason || 'Sin razón especificada'
  });

  logger.requestFlow("TRANSICIÓN_ESTADO", `Cambiando estado de solicitud ${id}`, {
    from_state: 'desconocido',
    to_state: toState,
    reason: reason || 'Sin razón especificada'
  });

  try {
    logger.requestFlow("VALIDACIÓN_TRANSICIÓN", "Validando transición permitida", {
      request_id: id,
      to_state: toState
    });

    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.TRANSITION.replace(':id', id), {
      to_state: toState,
      reason
    });

    if (!response.data?.ok) {
      logger.error("❌ Respuesta inválida en transición de estado", {
        request_id: id,
        to_state: toState,
        response_data: response.data
      });
      throw new Error(response.data?.message || 'Error cambiando estado');
    }

    logger.performance("Transición de estado de compra privada", startTime);
    logger.success("✅ Estado de solicitud cambiado exitosamente", {
      request_id: id,
      from_state: response.data?.data?.previous_state || 'desconocido',
      to_state: toState,
      reason: reason || 'Sin razón especificada'
    });

    return response.data.data;
  } catch (error) {
    logger.error("❌ Error cambiando estado de solicitud de compra privada", error, {
      request_id: id,
      to_state: toState,
      reason: reason || 'Sin razón especificada',
      processing_time: `${Date.now() - startTime}ms`,
      response_status: error?.response?.status
    });
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Actualizar registro de cliente
 * @param {string} id - ID de la solicitud
 * @param {string} clientId - ID del cliente registrado
 * @returns {Promise<Object>} Datos actualizados
 */
export const updateClientRegistration = async (id, clientId) => {
  try {
    const response = await api.put(PRIVATE_PURCHASE_ENDPOINTS.CLIENT_REGISTRATION.replace(':id', id), {
      client_id: clientId
    });

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error actualizando registro cliente');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error registrando cliente ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Establecer fechas de entrega
 * @param {string} id - ID de la solicitud
 * @param {Object} deliveryDates - Fechas de entrega
 * @param {string} deliveryDates.start - Fecha inicio (ISO string)
 * @param {string} deliveryDates.end - Fecha fin (ISO string)
 * @returns {Promise<Object>} Datos actualizados
 */
export const setDeliveryDates = async (id, deliveryDates) => {
  try {
    const response = await api.put(PRIVATE_PURCHASE_ENDPOINTS.DELIVERY_DATES.replace(':id', id), {
      delivery_dates: deliveryDates
    });

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error estableciendo fechas');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error estableciendo fechas ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Solicitar fechas de entrega (operaciones)
 * @param {string} id - ID de la solicitud
 * @returns {Promise<Object>} Resultado
 */
export const requestDeliveryDates = async (id) => {
  try {
    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.REQUEST_DELIVERY_DATES.replace(':id', id));

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error solicitando fechas');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error solicitando fechas ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Enviar fechas de entrega (comercial)
 * @param {string} id - ID de la solicitud
 * @param {Object} deliveryDates - Fechas
 * @param {string} notes - Notas opcionales
 * @returns {Promise<Object>} Resultado
 */
export const submitDeliveryDates = async (id, deliveryDates, notes = '') => {
  try {
    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.SUBMIT_DELIVERY_DATES.replace(':id', id), {
      delivery_dates: deliveryDates,
      notes
    });

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error enviando fechas');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error enviando fechas ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

export const updatePrivatePurchaseOperationsDetails = async (id, { includes_starter_kit, operations_notes, estimated_arrival_at } = {}) => {
  try {
    const response = await api.post(`${PRIVATE_PURCHASE_ENDPOINTS.BASE}/${id}/operations-details`, {
      includes_starter_kit,
      operations_notes,
      estimated_arrival_at
    });

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error actualizando detalles de operaciones');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error actualizando operaciones ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

export const markPrivatePurchaseEquipmentArrived = async (id) => {
  try {
    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.MARK_EQUIPMENT_ARRIVED.replace(':id', id));

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error marcando llegada de equipo');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error marcando llegada ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

export const uploadPrivatePurchaseDeliveryAct = async (id, { act_base64, file_name, mime_type, file_id } = {}) => {
  try {
    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.DELIVERY_ACT.replace(':id', id), {
      act_base64,
      file_name,
      mime_type,
      file_id
    });

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error subiendo acta de entrega');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error subiendo acta firmada por logistica ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

export const assignPrivatePurchaseDeliveryActTechnician = async (id, { assigned_to_email, assigned_to_name } = {}) => {
  try {
    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.DELIVERY_ACT_ASSIGN.replace(':id', id), {
      assigned_to_email,
      assigned_to_name
    });

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error asignando tecnico');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error asignando tecnico ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

export const updatePrivatePurchaseDispatchDetails = async (id, { items = [], notes = '', dispatched_at, observations } = {}) => {
  try {
    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.DISPATCH_DETAILS.replace(':id', id), {
      items,
      notes,
      dispatched_at,
      observations
    });

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error registrando despacho');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error registrando despacho ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

export const finalizePrivatePurchaseDeliveryAct = async (id, { act_base64, file_name, mime_type, file_id } = {}) => {
  try {
    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.DELIVERY_ACT_FINALIZE.replace(':id', id), {
      act_base64,
      file_name,
      mime_type,
      file_id
    });

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error subiendo acta final');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error subiendo acta final ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};


/**
 * Marcar como listo para entrega
 * @param {string} id - ID de la solicitud
 * @returns {Promise<Object>} Datos actualizados
 */
export const markReadyForDelivery = async (id) => {
  try {
    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.READY_FOR_DELIVERY.replace(':id', id));

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error marcando listo para entrega');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error marcando listo ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Completar entrega
 * @param {string} id - ID de la solicitud
 * @param {string} deliveryNotes - Notas de entrega
 * @returns {Promise<Object>} Datos actualizados
 */
export const completeDelivery = async (id, deliveryNotes = '') => {
  try {
    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.COMPLETE_DELIVERY.replace(':id', id), {
      delivery_notes: deliveryNotes
    });

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error completando entrega');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error completando entrega ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Cancelar solicitud
 * @param {string} id - ID de la solicitud
 * @param {string} reason - Razón de cancelación
 * @returns {Promise<Object>} Resultado de la cancelación
 */
export const cancelPrivatePurchase = async (id, reason = '') => {
  try {
    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.CANCEL.replace(':id', id), {
      reason
    });

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error cancelando solicitud');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error cancelando solicitud ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Obtener estadísticas por rol
 * @param {string} role - Rol del usuario
 * @returns {Promise<Object>} Estadísticas
 */
export const getPrivatePurchaseStats = async (role) => {
  try {
    const response = await api.get(`${PRIVATE_PURCHASE_ENDPOINTS.STATS}/${role}`);

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error obteniendo estadísticas');
    }

    return response.data.data || {};
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error obteniendo estadísticas ${role}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Obtener transiciones permitidas desde estado actual
 * @param {string} id - ID de la solicitud
 * @returns {Promise<Object>} Estado actual y transiciones permitidas
 */
export const getAllowedTransitions = async (id) => {
  try {
    const response = await api.get(PRIVATE_PURCHASE_ENDPOINTS.TRANSITIONS.replace(':id', id));

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error obteniendo transiciones');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error obteniendo transiciones ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Validar si una transición es permitida
 * @param {string} id - ID de la solicitud
 * @param {string} toState - Estado destino
 * @returns {Promise<Object>} Resultado de validación
 */
export const validateTransition = async (id, toState) => {
  try {
    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.VALIDATE_TRANSITION.replace(':id', id), {
      to_state: toState
    });

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error validando transición');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error validando transición ${id} → ${toState}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Enviar oferta de compra privada
 * @param {string} id - ID de la solicitud
 * @param {Object} offerData - Datos de la oferta
 * @returns {Promise<Object>} Resultado del envío
 */
export const sendPrivatePurchaseOffer = async (id, offerData) => {
  const startTime = Date.now();

  logger.apiCall("POST", PRIVATE_PURCHASE_ENDPOINTS.OFFER.replace(':id', id), {
    offer_data_keys: Object.keys(offerData || {})
  });

  logger.requestFlow("ENVIAR_OFERTA", `Enviando oferta para solicitud ${id}`, {
    request_id: id,
    offer_data_size: JSON.stringify(offerData || {}).length
  });

  try {
    logger.requestFlow("PREPARACIÓN_OFERTA", "Preparando envío de oferta al cliente", {
      request_id: id,
      has_terms: !!offerData?.terms,
      has_pricing: !!offerData?.pricing,
      has_conditions: !!offerData?.conditions
    });

    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.OFFER.replace(':id', id), offerData);

    if (!response.data?.ok) {
      logger.error("❌ Respuesta inválida al enviar oferta", {
        request_id: id,
        response_data: response.data,
        offer_data_keys: Object.keys(offerData || {})
      });
      throw new Error(response.data?.message || 'Error enviando oferta');
    }

    logger.performance("Envío de oferta de compra privada", startTime);
    logger.success("✅ Oferta enviada exitosamente", {
      request_id: id,
      offer_id: response.data?.data?.offer_id,
      client_notified: response.data?.data?.client_notified,
      status_changed_to: response.data?.data?.new_status
    });

    return response.data.data;
  } catch (error) {
    logger.error("❌ Error enviando oferta de compra privada", error, {
      request_id: id,
      offer_data_keys: Object.keys(offerData || {}),
      processing_time: `${Date.now() - startTime}ms`,
      response_status: error?.response?.status
    });
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Subir oferta firmada
 * @param {string} id - ID de la solicitud
 * @param {Object} signedOfferData - Datos de la oferta firmada
 * @returns {Promise<Object>} Resultado del envío
 */
export const uploadPrivateSignedOffer = async (id, signedOfferData) => {
  try {
    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.SIGNED_OFFER.replace(':id', id), signedOfferData);

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error subiendo oferta firmada');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error subiendo oferta firmada ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Registrar cliente
 * @param {string} id - ID de la solicitud
 * @returns {Promise<Object>} Resultado del registro
 */
export const registerPrivateClient = async (id) => {
  const startTime = Date.now();

  logger.apiCall("POST", PRIVATE_PURCHASE_ENDPOINTS.REGISTER_CLIENT.replace(':id', id));
  logger.requestFlow("REGISTRO_CLIENTE", `Registrando cliente para solicitud ${id}`, {
    request_id: id
  });

  try {
    logger.requestFlow("VALIDACIÓN_CLIENTE", "Validando datos del cliente antes del registro", {
      request_id: id
    });

    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.REGISTER_CLIENT.replace(':id', id));

    if (!response.data?.ok) {
      logger.error("❌ Respuesta inválida en registro de cliente", {
        request_id: id,
        response_data: response.data
      });
      throw new Error(response.data?.message || 'Error registrando cliente');
    }

    logger.performance("Registro de cliente en compra privada", startTime);
    logger.success("✅ Cliente registrado exitosamente", {
      request_id: id,
      client_id: response.data?.data?.client_id,
      client_name: response.data?.data?.client_name,
      status_changed_to: response.data?.data?.new_status
    });

    return response.data.data;
  } catch (error) {
    logger.error("❌ Error registrando cliente en compra privada", error, {
      request_id: id,
      processing_time: `${Date.now() - startTime}ms`,
      response_status: error?.response?.status
    });
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Enviar solicitud a ACP
 * @param {string} id - ID de la solicitud
 * @returns {Promise<Object>} Resultado del envío
 */
export const forwardPrivatePurchaseToAcp = async (id, config = {}) => {
  try {
    const response = await api.post(
      PRIVATE_PURCHASE_ENDPOINTS.SEND_TO_ACP.replace(':id', id),
      null,
      config
    );

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error enviando a ACP');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error enviando a ACP ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Solicitar disponibilidad al proveedor (ACP)
 * @param {string} id - ID de la solicitud
 * @param {Object} payload - Datos del proveedor
 * @param {string} payload.provider_email - Correo del proveedor
 * @param {string} payload.notes - Notas opcionales
 * @returns {Promise<Object>} Resultado
 */
export const startPrivatePurchaseAvailability = async (id, payload) => {
  try {
    const response = await api.post(
      PRIVATE_PURCHASE_ENDPOINTS.START_AVAILABILITY.replace(':id', id),
      payload
    );

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error solicitando disponibilidad');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error solicitando disponibilidad ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Registrar respuesta del proveedor (ACP)
 * @param {string} id - ID de la solicitud
 * @param {Object} payload - Respuesta del proveedor
 * @returns {Promise<Object>} Resultado
 */
export const savePrivatePurchaseProviderResponse = async (id, payload) => {
  try {
    const response = await api.post(
      PRIVATE_PURCHASE_ENDPOINTS.PROVIDER_RESPONSE.replace(':id', id),
      payload
    );

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error registrando respuesta');
    }

    return response.data.data;
  } catch (error) {
    const apiMessage = error.response?.data?.error || error.response?.data?.message;
    if (apiMessage) {
      error.message = apiMessage;
    }
    console.error(`[PrivatePurchasesAPI] Error registrando respuesta ${id}:`, error);
    throw error;
  }
};

/**
 * Subir contrato (gerencia)
 * @param {string} id - ID de la solicitud
 * @param {Object} contractData - Datos del contrato
 * @returns {Promise<Object>} Resultado del envio
 */
export const uploadPrivatePurchaseContract = async (id, contractData) => {
  try {
    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.SUBMIT_CONTRACT.replace(':id', id), contractData);

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error subiendo contrato');
    }

    return response.data.data;
  } catch (error) {
    const apiMessage = error.response?.data?.error || error.response?.data?.message;
    if (apiMessage) {
      error.message = apiMessage;
    }
    console.error(`[PrivatePurchasesAPI] Error subiendo contrato ${id}:`, error);
    throw error;
  }
};

/**
 * Subir contrato firmado por el cliente (comercial)
 * @param {string} id - ID de la solicitud
 * @param {Object} contractData - Datos del contrato firmado
 * @returns {Promise<Object>} Resultado del envio
 */
export const uploadPrivatePurchaseClientSignedContract = async (id, contractData) => {
  try {
    const response = await api.post(
      PRIVATE_PURCHASE_ENDPOINTS.CONTRACT_CLIENT_SIGNED.replace(':id', id),
      contractData
    );

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error subiendo contrato firmado por cliente');
    }

    return response.data.data;
  } catch (error) {
    const apiMessage = error.response?.data?.error || error.response?.data?.message;
    if (apiMessage) {
      error.message = apiMessage;
    }
    console.error(`[PrivatePurchasesAPI] Error subiendo contrato firmado por cliente ${id}:`, error);
    throw error;
  }
};

/**
 * Registrar solicitud de inspeccion de ambiente
 * @param {string} id - ID de la solicitud
 * @param {Object} payload - Datos de inspeccion
 * @returns {Promise<Object>} Resultado del envio
 */
export const savePrivatePurchaseInspectionRequest = async (id, payload = {}) => {
  try {
    const response = await api.post(
      PRIVATE_PURCHASE_ENDPOINTS.INSPECTION_REQUEST.replace(':id', id),
      payload
    );

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error registrando inspeccion');
    }

    return response.data.data;
  } catch (error) {
    const apiMessage = error.response?.data?.error || error.response?.data?.message;
    if (apiMessage) {
      error.message = apiMessage;
    }
    console.error(`[PrivatePurchasesAPI] Error registrando inspeccion ${id}:`, error);
    throw error;
  }
};

export const coordinatePrivatePurchaseInspectionDate = async (
  id,
  { inspection_date, notes = '' } = {},
) => {
  try {
    const response = await api.patch(
      PRIVATE_PURCHASE_ENDPOINTS.COORDINATE_INSPECTION_DATE.replace(':id', id),
      { inspection_date, notes },
    );
    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error coordinando inspección');
    }
    return response.data.data;
  } catch (error) {
    const apiMessage = error.response?.data?.error || error.response?.data?.message;
    if (apiMessage) {
      error.message = apiMessage;
    }
    console.error(`[PrivatePurchasesAPI] Error coordinando inspección ${id}:`, error);
    throw error;
  }
};

export const reviewPrivatePurchaseInspectionDate = async (
  id,
  { decision, review_notes = '' } = {},
) => {
  try {
    const response = await api.patch(
      PRIVATE_PURCHASE_ENDPOINTS.REVIEW_INSPECTION_DATE.replace(':id', id),
      { decision, review_notes },
    );
    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error revisando inspección');
    }
    return response.data.data;
  } catch (error) {
    const apiMessage = error.response?.data?.error || error.response?.data?.message;
    if (apiMessage) {
      error.message = apiMessage;
    }
    console.error(`[PrivatePurchasesAPI] Error revisando inspección ${id}:`, error);
    throw error;
  }
};

/**
 * Subir guias de despacho (operaciones)
 * @param {string} id - ID de la solicitud
 * @param {Array} guides - Lista de guias con base64
 * @returns {Promise<Object>} Resultado del envio
 */
export const uploadPrivatePurchaseDeliveryGuides = async (id, guides = []) => {
  try {
    const response = await api.post(
      PRIVATE_PURCHASE_ENDPOINTS.DELIVERY_GUIDES.replace(':id', id),
      { guides }
    );

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error subiendo guias');
    }

    return response.data.data;
  } catch (error) {
    const apiMessage = error.response?.data?.error || error.response?.data?.message;
    if (apiMessage) {
      error.message = apiMessage;
    }
    console.error(`[PrivatePurchasesAPI] Error subiendo guias ${id}:`, error);
    throw error;
  }
};

/**
 * Obtener expediente por solicitud
 * @param {string} id - ID de la solicitud
 * @returns {Promise<Array>} Documentos
 */
export const getPrivatePurchaseDocuments = async (id) => {
  try {
    const response = await api.get(PRIVATE_PURCHASE_ENDPOINTS.DOCUMENTS.replace(':id', id));

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error obteniendo documentos');
    }

    return response.data.data || [];
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error obteniendo documentos ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Consultar estado de aprobación de cliente para una compra privada
 * @param {string} purchaseId - ID de la solicitud de compra privada
 * @returns {Promise<Object>} Estado de aprobación del cliente
 */
export const checkClientApproval = async (purchaseId) => {
  console.log(`[PrivatePurchasesAPI] Iniciando consulta de aprobación para purchase ${purchaseId}`);

  try {
    console.log(`[PrivatePurchasesAPI] Realizando petición GET a /private-purchases/${purchaseId}/check-client-approval`);
    const response = await api.get(`/private-purchases/${purchaseId}/check-client-approval`);

    console.log(`[PrivatePurchasesAPI] Respuesta recibida:`, {
      status: response.status,
      ok: response.data?.ok,
      data: response.data?.data,
      message: response.data?.message
    });

    if (!response.data?.ok) {
      console.error(`[PrivatePurchasesAPI] Respuesta no OK para purchase ${purchaseId}:`, response.data);
      throw new Error(response.data?.message || 'Error consultando aprobación de cliente');
    }

    console.log(`[PrivatePurchasesAPI] ✅ Consulta exitosa para purchase ${purchaseId}:`, response.data.data);
    return response.data.data || {};
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] ❌ Error consultando aprobación de cliente ${purchaseId}:`, {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};


/**
 * Listar solicitudes de compra privada
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de solicitudes
 */
export const listPrivatePurchases = async (filters = {}) => {
  try {
    const sanitizedFilters = Object.fromEntries(
      Object.entries(filters || {}).filter(([, value]) => {
        if (value === undefined || value === null) return false;
        if (typeof value === "string" && value.trim() === "") return false;
        return true;
      }),
    );
    const response = await api.get(PRIVATE_PURCHASE_ENDPOINTS.BASE, { params: sanitizedFilters });

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error obteniendo solicitudes');
    }

    return response.data.data || [];
  } catch (error) {
    console.error('[PrivatePurchasesAPI] Error obteniendo solicitudes:', error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

/**
 * Listar solicitudes por rol (dashboard)
 * @param {string} role - Rol objetivo (ej: gerencia_general)
 * @returns {Promise<Array>} Lista de solicitudes
 */
export const listPrivatePurchasesByRole = async (role) => {
  if (!role) {
    throw new Error('Rol requerido para listar solicitudes');
  }

  try {
    const response = await api.get(`${PRIVATE_PURCHASE_ENDPOINTS.BY_ROLE}/${role}`);

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error obteniendo solicitudes por rol');
    }

    return response.data.data || [];
  } catch (error) {
    console.error('[PrivatePurchasesAPI] Error obteniendo solicitudes por rol:', error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

// ===== HELPERS =====

/**
 * Formatear estado para display amigable
 * @param {string} state - Estado técnico
 * @returns {string} Estado amigable
 */
export const formatPrivatePurchaseState = (state) => {
  const stateNames = {
    [PRIVATE_PURCHASE_STATES.PENDING_COMMERCIAL]: 'Pendiente Asesor',
    [PRIVATE_PURCHASE_STATES.PENDING_BACKOFFICE]: 'Pendiente BackOffice',
    [PRIVATE_PURCHASE_STATES.OFFER_SENT]: 'Oferta Enviada',
    [PRIVATE_PURCHASE_STATES.PENDING_MANAGER_SIGNATURE]: 'Pendiente Firma Gerencia',
    [PRIVATE_PURCHASE_STATES.PENDING_CLIENT_SIGNATURE]: 'Esperando oferta firmada',
    [PRIVATE_PURCHASE_STATES.OFFER_SIGNED]: 'Oferta Firmada',
    [PRIVATE_PURCHASE_STATES.CLIENT_REGISTRATION_REQUESTED]: 'Registro Solicitado',
    [PRIVATE_PURCHASE_STATES.CLIENT_REGISTERED]: 'Cliente Registrado',
    [PRIVATE_PURCHASE_STATES.SENT_TO_ACP]: 'Enviada a ACP',
    [PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_REQUESTED]: 'Disponibilidad Solicitada',
    [PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_CONFIRMED]: 'Disponibilidad Confirmada',
    [PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_REJECTED]: 'Disponibilidad Rechazada',
    [PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL]: 'Pendiente Aprobacion',
    [PRIVATE_PURCHASE_STATES.CONTRACT_AVAILABLE]: 'Contrato Disponible',
    [PRIVATE_PURCHASE_STATES.CONTRACT_REJECTED]: 'Contrato Rechazado',
    [PRIVATE_PURCHASE_STATES.DELIVERY_DATES_REQUESTED]: 'Pendiente Fechas',
    [PRIVATE_PURCHASE_STATES.DELIVERY_DATES_SUBMITTED]: 'Fechas Establecidas',
    [PRIVATE_PURCHASE_STATES.CALENDAR_EVENTS_CREATED]: 'Calendario Creado',
    [PRIVATE_PURCHASE_STATES.WAITING_DISPATCH]: 'Esperando Despacho',
    [PRIVATE_PURCHASE_STATES.DISPATCH_READY]: 'Despacho Listo',
  [PRIVATE_PURCHASE_STATES.DELIVERY_ACT_DRAFT_READY]: 'Acta en borrador',
  [PRIVATE_PURCHASE_STATES.DELIVERY_ACT_TECH_ASSIGNED]: 'Tecnico asignado',
  [PRIVATE_PURCHASE_STATES.DELIVERY_ACT_LOGISTICS_SIGNED]: 'Acta firmada por logistica',
  [PRIVATE_PURCHASE_STATES.DELIVERY_ACT_GENERATED]: 'Acta firmada por cliente',
    [PRIVATE_PURCHASE_STATES.DELIVERED]: 'Entregado',
    [PRIVATE_PURCHASE_STATES.REJECTED]: 'Rechazado',
    [PRIVATE_PURCHASE_STATES.BUSINESS_CASE_IN_PROGRESS]: 'Business Case Pendiente',
    [PRIVATE_PURCHASE_STATES.BUSINESS_CASE_UNDER_REVIEW]: 'Business Case en Revision',
    [PRIVATE_PURCHASE_STATES.BUSINESS_CASE_FEASIBILITY_APPROVED]: 'Business Case Viable',
    [PRIVATE_PURCHASE_STATES.BUSINESS_CASE_REJECTED]: 'Business Case Rechazado'
  };

  return stateNames[state] || state;
};

/**
 * Obtener color para estado (para UI)
 * @param {string} state - Estado tecnico
 * @returns {string} Clase CSS de color
 */
export const getStateColor = (state) => {
  const colorMap = {
    // Estados iniciales
    [PRIVATE_PURCHASE_STATES.PENDING_COMMERCIAL]: 'bg-yellow-100 text-yellow-800',
    [PRIVATE_PURCHASE_STATES.PENDING_BACKOFFICE]: 'bg-yellow-100 text-yellow-800',

    // Estados de progreso
    [PRIVATE_PURCHASE_STATES.OFFER_SENT]: 'bg-blue-100 text-blue-800',
    [PRIVATE_PURCHASE_STATES.PENDING_MANAGER_SIGNATURE]: 'bg-blue-100 text-blue-800',
    [PRIVATE_PURCHASE_STATES.PENDING_CLIENT_SIGNATURE]: 'bg-blue-100 text-blue-800',
    [PRIVATE_PURCHASE_STATES.OFFER_SIGNED]: 'bg-blue-100 text-blue-800',
    [PRIVATE_PURCHASE_STATES.CLIENT_REGISTERED]: 'bg-green-100 text-green-800',
    [PRIVATE_PURCHASE_STATES.SENT_TO_ACP]: 'bg-purple-100 text-purple-800',
    [PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_REQUESTED]: 'bg-purple-100 text-purple-800',
    [PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_CONFIRMED]: 'bg-emerald-100 text-emerald-800',
    [PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_REJECTED]: 'bg-red-100 text-red-800',

    // Estados criticos
    [PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL]: 'bg-orange-100 text-orange-800',
    [PRIVATE_PURCHASE_STATES.CONTRACT_AVAILABLE]: 'bg-amber-100 text-amber-800',
    [PRIVATE_PURCHASE_STATES.CONTRACT_REJECTED]: 'bg-red-100 text-red-800',
    [PRIVATE_PURCHASE_STATES.DELIVERY_DATES_REQUESTED]: 'bg-orange-100 text-orange-800',

    // Logistica
    [PRIVATE_PURCHASE_STATES.DELIVERY_DATES_SUBMITTED]: 'bg-teal-100 text-teal-800',
    [PRIVATE_PURCHASE_STATES.WAITING_DISPATCH]: 'bg-indigo-100 text-indigo-800',
    [PRIVATE_PURCHASE_STATES.DISPATCH_READY]: 'bg-indigo-100 text-indigo-800',
    [PRIVATE_PURCHASE_STATES.DELIVERY_ACT_DRAFT_READY]: 'bg-amber-100 text-amber-800',
    [PRIVATE_PURCHASE_STATES.DELIVERY_ACT_TECH_ASSIGNED]: 'bg-yellow-100 text-yellow-800',
    [PRIVATE_PURCHASE_STATES.DELIVERY_ACT_LOGISTICS_SIGNED]: 'bg-blue-100 text-blue-800',
    [PRIVATE_PURCHASE_STATES.DELIVERY_ACT_GENERATED]: 'bg-indigo-100 text-indigo-800',

    // Estados finales
    [PRIVATE_PURCHASE_STATES.DELIVERED]: 'bg-green-100 text-green-800',
    [PRIVATE_PURCHASE_STATES.REJECTED]: 'bg-gray-100 text-gray-800',

    // Estados especiales
    [PRIVATE_PURCHASE_STATES.BUSINESS_CASE_IN_PROGRESS]: 'bg-purple-100 text-purple-800',
    [PRIVATE_PURCHASE_STATES.BUSINESS_CASE_UNDER_REVIEW]: 'bg-purple-100 text-purple-800',
    [PRIVATE_PURCHASE_STATES.BUSINESS_CASE_FEASIBILITY_APPROVED]: 'bg-purple-100 text-purple-800',
    [PRIVATE_PURCHASE_STATES.BUSINESS_CASE_REJECTED]: 'bg-red-100 text-red-800'
  };

  return colorMap[state] || 'bg-gray-100 text-gray-800';
};

/**
 * Solicitar registro de cliente
 * @param {string} id - ID de la solicitud
 * @returns {Promise<Object>} Resultado de la solicitud
 */
export const requestClientRegistration = async (id) => {
  try {
    const response = await api.post(PRIVATE_PURCHASE_ENDPOINTS.REQUEST_CLIENT_REGISTRATION.replace(':id', id));

    if (!response.data?.ok) {
      throw new Error(response.data?.message || 'Error solicitando registro de cliente');
    }

    return response.data.data;
  } catch (error) {
    console.error(`[PrivatePurchasesAPI] Error solicitando registro de cliente ${id}:`, error);
    throw error.response?.data?.message || error.message || 'Error desconocido';
  }
};

export default {
  createPrivatePurchaseRequest,
  createPrivatePurchase,
  getPrivatePurchaseById,
  getPrivatePurchaseTimeline,
  getMyPrivatePurchases,
  getPrivatePurchasesByRole,
  transitionPrivatePurchaseState,
  updateClientRegistration,
  setDeliveryDates,
  requestDeliveryDates,
  submitDeliveryDates,
  updatePrivatePurchaseOperationsDetails,
  markPrivatePurchaseEquipmentArrived,
  uploadPrivatePurchaseDeliveryAct,
  assignPrivatePurchaseDeliveryActTechnician,
  finalizePrivatePurchaseDeliveryAct,
  updatePrivatePurchaseDispatchDetails,
  markReadyForDelivery,
  completeDelivery,
  cancelPrivatePurchase,
  getPrivatePurchaseStats,
  getAllowedTransitions,
  validateTransition,
  sendPrivatePurchaseOffer,
  uploadPrivateSignedOffer,
  uploadPrivatePurchaseContract,
  uploadPrivatePurchaseClientSignedContract,
  savePrivatePurchaseInspectionRequest,
  coordinatePrivatePurchaseInspectionDate,
  reviewPrivatePurchaseInspectionDate,
  uploadPrivatePurchaseDeliveryGuides,
  registerPrivateClient,
  requestClientRegistration,
  forwardPrivatePurchaseToAcp,
  startPrivatePurchaseAvailability,
  savePrivatePurchaseProviderResponse,
  getPrivatePurchaseDocuments,
  listPrivatePurchases,
  listPrivatePurchasesByRole,
  formatPrivatePurchaseState,
  getStateColor,
  PRIVATE_PURCHASE_STATES,
  FLOW_TYPES
};
