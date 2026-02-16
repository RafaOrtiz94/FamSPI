/**
 * Private Purchases Controller
 *
 * Endpoints para gestión del flujo de compras privadas.
 */

const service = require('./privatePurchases.service');
const { PrivatePurchaseStateMachine } = require('./privatePurchaseStateMachine');
const db = require("../../config/db");
const logger = require("../../config/logger");

const normalizeDates = (row) => {
  if (!row || typeof row !== 'object') return row;
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (value instanceof Date) {
        return [key, value.toISOString()];
      }
      return [key, value];
    })
  );
};

// FASE 5: Contrato API final validado - movido a función para evitar problemas de carga
function logContractStates() {
  try {
    const { PRIVATE_PURCHASE_STATES } = require('./privatePurchaseStateMachine');
    logger.debug(`[FLOW_PRIVADA][BE][FASE5][CONTRACT][VERIFY] Endpoints contrato API cargados y validados`);
    logger.debug(`[FLOW_PRIVADA][BE][FASE5][CONTRACT][VERIFY] Estados disponibles: ${Object.values(PRIVATE_PURCHASE_STATES).join(', ')}`);
  } catch (error) {
    logger.warn('[FLOW_PRIVADA][BE][FASE5][CONTRACT][WARN] Error cargando estados:', error.message);
  }
}

// Ejecutar logging de forma segura
setImmediate(logContractStates);

/**
 * Crear nueva solicitud de compra privada
 */
exports.create = async (req, res, next) => {
  try {
    logger.debug(`[FLOW_PRIVADA][BE][FASE2][RBAC][DENY] Verificando rol asesor_comercial para create`);
    // RBAC check is done at route level with requireRole

    const {
      client_data,
      equipment,
      offer_kind = 'venta',
      notes = ''
    } = req.body;

    const flowId = req.headers['x-flow-id'] || null;
    logger.debug('[FLOW_PRIVADA][BE][CREATE][START]', {
      flowId,
      userId: req.user?.id,
      offerKind: offer_kind,
      equipmentCount: Array.isArray(equipment) ? equipment.length : 0
    });

    const result = await service.createPurchaseRequest({
      user: req.user,
      clientData: client_data,
      equipment,
      offerKind: offer_kind,
      notes
    });

    logger.debug('[FLOW_PRIVADA][BE][CREATE][SUCCESS]', {
      flowId,
      requestId: result?.id,
      status: result?.status
    });
    res.status(201).json({ ok: true, data: result });
  } catch (error) {
    logger.error('[FLOW_PRIVADA][BE][CREATE][ERROR]', {
      flowId: req.headers['x-flow-id'] || null,
      error: error.message
    });
    next(error);
  }
};

/**
 * Obtener solicitud por ID
 */
exports.getOne = async (req, res, next) => {
  try {
    const item = await service.getById(req.params.id, req.user);
    if (!item) return res.status(404).json({ ok: false, message: 'No encontrado' });
    res.json({ ok: true, data: normalizeDates(item) });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar todas las solicitudes (con filtros opcionales)
 */
exports.list = async (req, res, next) => {
  try {
    const filters = req.query || {};
    const data = await service.listAll(req.user, filters);
    const normalizedData = (Array.isArray(data) ? data : []).map((row) => ({
      ...row,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
    }));
    if (Array.isArray(data) && data.length > 0) {
      const sample = data[0] || {};
      logger.debug('[FLOW_PRIVADA][BE][LIST][DATE_SAMPLE]', {
        id: sample.id,
        created_at: sample.created_at,
        updated_at: sample.updated_at,
        keys: Object.keys(sample || {})
      });
    }
    res.json({ ok: true, data: normalizedData });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar solicitudes del usuario actual
 */
exports.listMine = async (req, res, next) => {
  try {
    const data = await service.listByUser(req.user);
    res.json({ ok: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar solicitudes por rol (dashboard)
 */
exports.listByRole = async (req, res, next) => {
  try {
    const { role } = req.params;
    const data = await service.listByRole(req.user, role);
    const normalizedData = (Array.isArray(data) ? data : []).map((row) => ({
      ...row,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
    }));
    if (Array.isArray(data) && data.length > 0) {
      const sample = data[0] || {};
      logger.debug('[FLOW_PRIVADA][BE][LIST_BY_ROLE][DATE_SAMPLE]', {
        role,
        id: sample.id,
        created_at: sample.created_at,
        updated_at: sample.updated_at,
        keys: Object.keys(sample || {})
      });
    }
    res.json({ ok: true, data: normalizedData });
  } catch (error) {
    next(error);
  }
};

/**
 * Transición de estado
 */
exports.transitionState = async (req, res, next) => {
  try {
    const { to_state, reason = '' } = req.body;

    const result = await service.transitionState(req.params.id, to_state, req.user, reason);
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Enviar oferta (backoffice)
 */
exports.sendOffer = async (req, res, next) => {
  try {
    const { offer_base64, file_name, mime_type } = req.body || {};

    const result = await service.sendOffer(
      req.params.id,
      { offerBase64: offer_base64, fileName: file_name, mimeType: mime_type },
      req.user
    );

    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Subir oferta firmada (comercial)
 */
exports.uploadSignedOffer = async (req, res, next) => {
  try {
    const { signed_offer_base64, file_name, mime_type } = req.body || {};

    const result = await service.uploadSignedOffer(
      req.params.id,
      { signedOfferBase64: signed_offer_base64, fileName: file_name, mimeType: mime_type },
      req.user
    );

    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Enviar solicitud a ACP
 */
exports.forwardToAcp = async (req, res, next) => {
  try {
    const flowId = req.headers['x-flow-id'] || null;
    logger.debug('[FLOW_PRIVADA][BE][ACP_FORWARD][START]', {
      flowId,
      requestId: req.params.id,
      userId: req.user?.id
    });
    const result = await service.forwardToAcp(req.params.id, req.user);
    logger.debug('[FLOW_PRIVADA][BE][ACP_FORWARD][SUCCESS]', {
      flowId,
      requestId: req.params.id
    });
    res.json({ ok: true, data: result });
  } catch (error) {
    logger.error('[FLOW_PRIVADA][BE][ACP_FORWARD][ERROR]', {
      flowId: req.headers['x-flow-id'] || null,
      requestId: req.params.id,
      error: error.message
    });
    next(error);
  }
};

/**
 * Solicitar disponibilidad a proveedor
 */
exports.startAvailability = async (req, res, next) => {
  try {
    const { provider_email, notes } = req.body || {};
    const updated = await service.startAvailabilityRequest(
      req.params.id,
      req.user,
      provider_email,
      notes
    );

    res.json({ ok: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * Solicitar registro de cliente
 */
exports.requestClientRegistration = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    logger.debug(`[CONTROLLER] Solicitando registro de cliente para purchase ${id} por usuario ${user.id}`);

    const result = await service.requestClientRegistration(id, user);

    res.json({
      ok: true,
      data: result,
      message: 'Solicitud de registro de cliente enviada exitosamente'
    });
  } catch (error) {
    logger.error('Error solicitando registro de cliente:', error);
    next(error);
  }
};

/**
 * ACP registra respuesta del proveedor
 */
exports.saveProviderResponse = async (req, res, next) => {
  try {
    const { outcome, items, notes } = req.body || {};
    const result = await service.saveProviderResponse({
      id: req.params.id,
      user: req.user,
      outcome,
      items,
      notes
    });
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Gerencia sube contrato y deja disponible
 */
exports.uploadContract = async (req, res, next) => {
  try {
    const { contract_base64, file_name, mime_type, reason = '' } = req.body || {};

    const result = await service.uploadContract(
      req.params.id,
      { contractBase64: contract_base64, fileName: file_name, mimeType: mime_type, decisionReason: reason },
      req.user
    );

    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Comercial sube contrato firmado por cliente
 */
exports.uploadClientSignedContract = async (req, res, next) => {
  try {
    const { contract_base64, file_name, mime_type } = req.body || {};
    const result = await service.uploadClientSignedContract(
      req.params.id,
      { contractBase64: contract_base64, fileName: file_name, mimeType: mime_type },
      req.user
    );
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Operaciones sube guias de despacho
 */
exports.uploadDeliveryGuides = async (req, res, next) => {
  try {
    const { guides } = req.body || {};
    const result = await service.uploadDeliveryGuides(
      req.params.id,
      { guides },
      req.user
    );
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Comercial solicita inspeccion de ambiente
 */
exports.saveInspectionRequest = async (req, res, next) => {
  try {
    const { request_id, acta_document_id } = req.body || {};
    const result = await service.saveInspectionRequest(
      req.params.id,
      { requestId: request_id, actaDocumentId: acta_document_id },
      req.user
    );
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Operaciones solicita fecha de entrega
 */
exports.requestDeliveryDates = async (req, res, next) => {
  try {
    const result = await service.requestDeliveryDates(req.params.id, req.user);
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Comercial ingresa fecha de entrega
 */
exports.submitDeliveryDates = async (req, res, next) => {
  try {
    const { delivery_dates, deliveryDates, notes = '' } = req.body || {};
    const payload = delivery_dates || deliveryDates;

    const result = await service.submitDeliveryDates(req.params.id, payload, notes, req.user);
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Expediente por compra privada
 */
exports.getDocuments = async (req, res, next) => {
  try {
    const rows = await service.getDocuments(req.params.id);
    res.json({ ok: true, data: rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Consultar estado de aprobación de cliente
 */
exports.checkClientApproval = async (req, res, next) => {
  try {
    const purchaseId = req.params.id;

    // Obtener datos de la compra
    const purchase = await service.getById(purchaseId, req.user);
    const clientData = purchase.client_snapshot || {};

    // Consultar estado de aprobación
    const approvalStatus = await service.checkClientApprovalStatus(clientData, purchase);

    res.json({ ok: true, data: approvalStatus });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar registro de cliente
 */
exports.updateClientRegistration = async (req, res, next) => {
  try {
    const { client_id } = req.body || {};

    const result = await service.updateClientRegistration(req.params.id, client_id, req.user);
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Establecer fechas de entrega
 */
exports.setDeliveryDates = async (req, res, next) => {
  try {
    const { delivery_dates, delivery_notes = '', notes = '' } = req.body || {};

    const result = await service.setDeliveryDates(
      req.params.id,
      delivery_dates,
      req.user,
      delivery_notes || notes
    );
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Marcar como listo para entrega
 */
exports.markReadyForDelivery = async (req, res, next) => {
  try {
    const result = await service.markReadyForDelivery(req.params.id, req.user);
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Completar entrega
 */
exports.completeDelivery = async (req, res, next) => {
  try {
    const { delivery_notes = '' } = req.body;

    const result = await service.completeDelivery(req.params.id, req.user, delivery_notes);
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancelar solicitud
 */
exports.cancel = async (req, res, next) => {
  try {
    const { reason = '' } = req.body;

    const result = await service.cancelPurchase(req.params.id, req.user, reason);
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar detalles de operaciones (kit de arranque y observaciones)
 */
exports.updateOperationsDetails = async (req, res, next) => {
  try {
    const { includes_starter_kit, operations_notes, estimated_arrival_at } = req.body || {};
    const result = await service.updateOperationsDetails(
      req.params.id,
      { includesStarterKit: includes_starter_kit, operationsNotes: operations_notes, estimatedArrivalAt: estimated_arrival_at },
      req.user
    );
    res.json({ ok: true, data: normalizeDates(result) });
  } catch (error) {
    next(error);
  }
};

/**
 * Marcar llegada de equipo en operaciones
 */
exports.markEquipmentArrived = async (req, res, next) => {
  try {
    const result = await service.markEquipmentArrived(req.params.id, req.user);
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Subir acta firmada por logistica
 */
exports.uploadDeliveryAct = async (req, res, next) => {
  try {
    const { act_base64, file_name, mime_type, file_id } = req.body || {};
    const result = await service.uploadDeliveryActLogisticsSigned(
      req.params.id,
      { actBase64: act_base64, fileName: file_name, mimeType: mime_type, fileId: file_id },
      req.user
    );
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Registrar detalles de despacho (logistica)
 */
exports.updateDispatchDetails = async (req, res, next) => {
  try {
    const { items, notes, dispatched_at, observations } = req.body || {};
    const result = await service.updateDispatchDetails(
      req.params.id,
      { items, notes, dispatchedAt: dispatched_at, observations },
      req.user
    );
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Asignar tecnico para entrega (jefe tecnico)
 */
exports.assignDeliveryActTechnician = async (req, res, next) => {
  try {
    const { assigned_to_email, assigned_to_name } = req.body || {};
    const result = await service.assignDeliveryActTechnician(
      req.params.id,
      { assigned_to_email, assigned_to_name },
      req.user
    );
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Subir acta final firmada por tecnico y cliente
 */
exports.finalizeDeliveryAct = async (req, res, next) => {
  try {
    const { act_base64, file_name, mime_type, file_id } = req.body || {};
    const result = await service.uploadDeliveryActFinalSigned(
      req.params.id,
      { actBase64: act_base64, fileName: file_name, mimeType: mime_type, fileId: file_id },
      req.user
    );
    res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener estadísticas por rol
 */
exports.getStats = async (req, res, next) => {
  try {
    const { role } = req.params;
    const stats = await service.getStatsByRole(req.user, role);
    res.json({ ok: true, data: stats });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener estados permitidos desde estado actual
 */
exports.getAllowedTransitions = async (req, res, next) => {
  try {
    const currentState = await PrivatePurchaseStateMachine.getCurrentState(req.params.id);
    const allowedTransitions = PrivatePurchaseStateMachine.getAllowedTransitions(currentState);

    res.json({
      ok: true,
      data: {
        current_state: currentState,
        allowed_transitions: allowedTransitions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validar si una transición es permitida
 */
exports.validateTransition = async (req, res, next) => {
  try {
    const { to_state } = req.body;
    const currentState = await PrivatePurchaseStateMachine.getCurrentState(req.params.id);
    const isValid = PrivatePurchaseStateMachine.canTransition(currentState, to_state);

    res.json({
      ok: true,
      data: {
        current_state: currentState,
        target_state: to_state,
        is_valid: isValid
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * FASE 3/5: Obtener timeline/auditoría consumible por widgets (endurecido FASE 5)
 */
exports.getTimeline = async (req, res, next) => {
  try {
    logger.debug(`[FLOW_PRIVADA][BE][FASE5][TIMELINE][VERIFY_ROUTE] Endpoint timeline llamado para purchase ${req.params.id}`);

    const purchaseId = req.params.id;

    // Get basic purchase data
    const purchaseData = await service.getById(purchaseId, req.user);
    const currentState = purchaseData.status;

    logger.debug(`[FLOW_PRIVADA][BE][FASE5][TIMELINE][ORDER_OK] Estado actual: ${currentState}, created_at: ${purchaseData.created_at}`);
    logger.debug('[FLOW_PRIVADA][BE][FASE5][TIMELINE][DATE_SAMPLE]', {
      id: purchaseId,
      created_at: purchaseData.created_at,
      updated_at: purchaseData.updated_at,
      keys: Object.keys(purchaseData || {})
    });

    let documents = [];
    try {
      documents = await service.getDocuments(purchaseId);
    } catch (error) {
      logger.warn('[FLOW_PRIVADA][BE][FASE5][TIMELINE][DOCS_WARN] Error obteniendo documentos:', error.message);
    }

    let checklist = null;
    try {
      const docsCheck = await PrivatePurchaseStateMachine._checkRequiredDocumentsForGerencia(purchaseId);
      checklist = (docsCheck?.requiredDocs || []).map((docType) => ({
        docType,
        present: Array.isArray(docsCheck.presentDocs) && docsCheck.presentDocs.includes(docType)
      }));
    } catch (error) {
      logger.warn('[FLOW_PRIVADA][BE][FASE5][TIMELINE][CHECKLIST_WARN] Error generando checklist:', error.message);
    }

    // Get state transitions (if table exists)
    let transitions = [];
    let transitionRows = [];
    try {
      const { rows } = await db.query(`
        SELECT
          transitioned_at as timestamp,
          from_state,
          to_state,
          transition_reason as reason,
          transitioned_by,
          metadata
        FROM private_purchase_state_transitions
        WHERE purchase_id = $1
        ORDER BY transitioned_at DESC
      `, [purchaseId]);

      transitionRows = rows;

      logger.debug(`[FLOW_PRIVADA][BE][FASE5][TIMELINE][ORDER_OK] Encontradas ${transitionRows.length} transiciones persistidas`);
    } catch (err) {
      // Table might not exist, fallback to derived timeline
      logger.debug(`[FLOW_PRIVADA][BE][FASE5][TIMELINE][FALLBACK_OK] Tabla transitions no disponible, usando fallback derivado`);
    }

    const userIds = new Set();
    transitionRows.forEach((t) => {
      if (t.transitioned_by) userIds.add(t.transitioned_by);
    });
    if (purchaseData.created_by) userIds.add(purchaseData.created_by);
    if (purchaseData.manager_contract_decision_by) userIds.add(purchaseData.manager_contract_decision_by);
    if (purchaseData.contract_client_signed_by) userIds.add(purchaseData.contract_client_signed_by);
    if (purchaseData.provider_response?.actor?.id) userIds.add(purchaseData.provider_response.actor.id);

    const userMap = new Map();
    if (userIds.size > 0) {
      const { rows: users } = await db.query(
        'SELECT id, fullname, name, role FROM users WHERE id = ANY($1::int[])',
        [Array.from(userIds)]
      );
      users.forEach((user) => {
        userMap.set(user.id, {
          name: user.fullname || user.name || 'Usuario',
          role: user.role || null
        });
      });
    }

    const resolveActorName = (userId, fallback = 'Sistema') => {
      if (!userId) return fallback;
      return userMap.get(userId)?.name || fallback;
    };
    const resolveActorRole = (userId, fallback = 'system') => {
      if (!userId) return fallback;
      return userMap.get(userId)?.role || fallback;
    };

    transitions = transitionRows.map(t => ({
      type: 'STATE_TRANSITION',
      eventType: 'STATE_TRANSITION', // FASE 6: Alias FE-compat
      timestamp: t.timestamp,
      actorName: resolveActorName(t.transitioned_by),
      actorRole: resolveActorRole(t.transitioned_by),
      actorUserId: t.transitioned_by,
      prevState: t.from_state,
      nextState: t.next_state,
      newState: t.next_state, // FASE 6: Alias FE-compat
      metadata: t.metadata || {},
      reason: t.reason
    }));

    // Add current state as synthetic event if no transitions
    if (transitions.length === 0) {
      transitions.push({
        type: 'CURRENT_STATE',
        timestamp: purchaseData.created_at,
        actorName: resolveActorName(purchaseData.created_by),
        actorRole: resolveActorRole(purchaseData.created_by),
        actorUserId: purchaseData.created_by,
        prevState: null,
        nextState: currentState,
        metadata: {},
        reason: 'Estado actual'
      });
    }

    // Add key business events derived from data
    const businessEvents = [];

    if (purchaseData.created_at) {
      businessEvents.push({
        type: 'REQUEST_CREATED',
        eventType: 'REQUEST_CREATED',
        timestamp: purchaseData.created_at,
        actorName: resolveActorName(purchaseData.created_by),
        actorRole: resolveActorRole(purchaseData.created_by),
        actorUserId: purchaseData.created_by,
        metadata: { reason: 'Solicitud creada' }
      });
    }

    if (purchaseData.client_registered_at) {
      businessEvents.push({
        type: 'CLIENT_REGISTERED',
        eventType: 'CLIENT_REGISTERED', // FASE 6: Alias FE-compat
        timestamp: purchaseData.client_registered_at,
        actorName: 'Backoffice',
        actorRole: 'backoffice_comercial',
        actorUserId: null,
        metadata: { event: 'Client registration completed' }
      });
    }

    if (purchaseData.inspection_requested_at) {
      businessEvents.push({
        type: 'INSPECTION_REQUESTED',
        eventType: 'INSPECTION_REQUESTED',
        timestamp: purchaseData.inspection_requested_at,
        actorName: 'Comercial',
        actorRole: 'asesor_comercial',
        actorUserId: purchaseData.created_by,
        metadata: { docType: 'INSPECTION_ACT', fileId: purchaseData.inspection_acta_document_id, reason: 'Inspeccion de ambiente solicitada' }
      });
    }

    if (purchaseData.offer_document_id) {
      businessEvents.push({
        type: 'OFFER_UPLOADED',
        eventType: 'OFFER_UPLOADED',
        timestamp: purchaseData.updated_at,
        actorName: 'Backoffice',
        actorRole: 'backoffice_comercial',
        actorUserId: null,
        metadata: { docType: 'OFFER', fileId: purchaseData.offer_document_id, reason: 'Oferta enviada' }
      });
    }

    if (purchaseData.offer_signed_document_id) {
      const signedAt = purchaseData.offer_signed_uploaded_at || purchaseData.signed_offer_received_at || purchaseData.updated_at;
      businessEvents.push({
        type: 'SIGNED_OFFER_UPLOADED',
        eventType: 'SIGNED_OFFER_UPLOADED', // FASE 6: Alias FE-compat
        timestamp: signedAt,
        actorName: resolveActorName(purchaseData.created_by),
        actorRole: 'asesor_comercial',
        actorUserId: purchaseData.created_by,
        metadata: { docType: 'SIGNED_OFFER', fileId: purchaseData.offer_signed_document_id, reason: 'Oferta firmada subida' }
      });
    }

    if (purchaseData.provider_response_at) {
      const actorId = purchaseData.provider_response?.actor?.id || null;
      const actorName = purchaseData.provider_response?.actor?.name || resolveActorName(actorId);
      const actorRole = purchaseData.provider_response?.actor?.role || resolveActorRole(actorId, 'acp_comercial');
      businessEvents.push({
        type: 'PROVIDER_RESPONSE',
        eventType: 'PROVIDER_RESPONSE',
        timestamp: purchaseData.provider_response_at,
        actorName,
        actorRole,
        actorUserId: actorId,
        metadata: { outcome: purchaseData.provider_response?.outcome, reason: 'Respuesta de disponibilidad registrada' }
      });
    }

    if (purchaseData.reservation_email_sent_at) {
      businessEvents.push({
        type: 'RESERVATION_REQUESTED',
        eventType: 'RESERVATION_REQUESTED',
        timestamp: purchaseData.reservation_email_sent_at,
        actorName: resolveActorName(purchaseData.provider_response?.actor?.id, 'ACP'),
        actorRole: resolveActorRole(purchaseData.provider_response?.actor?.id, 'acp_comercial'),
        actorUserId: purchaseData.provider_response?.actor?.id || null,
        metadata: {
          fileId: purchaseData.reservation_email_file_id,
          reason: 'Reserva solicitada al proveedor'
        }
      });
    }

    if (purchaseData.contract_document_id) {
      businessEvents.push({
        type: 'CONTRACT_DRAFT_UPLOADED',
        eventType: 'CONTRACT_DRAFT_UPLOADED',
        timestamp: purchaseData.updated_at,
        actorName: 'Backoffice',
        actorRole: 'backoffice_comercial',
        actorUserId: null,
        metadata: { docType: 'CONTRACT_DRAFT', fileId: purchaseData.contract_document_id, reason: 'Contrato borrador subido' }
      });
    }

    if (purchaseData.contract_client_signed_document_id) {
      const clientSignerId = purchaseData.contract_client_signed_by || null;
      const clientSignerName = clientSignerId ? resolveActorName(clientSignerId) : 'Comercial';
      const clientSignerRole = clientSignerId ? resolveActorRole(clientSignerId, 'comercial') : 'comercial';
      businessEvents.push({
        type: 'CONTRACT_CLIENT_SIGNED_UPLOADED',
        eventType: 'CONTRACT_CLIENT_SIGNED_UPLOADED',
        timestamp: purchaseData.contract_client_signed_uploaded_at || purchaseData.updated_at,
        actorName: clientSignerName,
        actorRole: clientSignerRole,
        actorUserId: clientSignerId,
        metadata: { docType: 'CONTRACT_CLIENT_SIGNED', fileId: purchaseData.contract_client_signed_document_id, reason: 'Contrato firmado por cliente subido' }
      });
    }

    if (purchaseData.contract_signed_document_id) {
      const contractActorId = purchaseData.manager_contract_decision_by || null;
      const contractActorName = contractActorId ? resolveActorName(contractActorId) : 'Gerencia';
      const contractActorRole = contractActorId ? resolveActorRole(contractActorId, 'gerencia_general') : 'gerencia_general';
      businessEvents.push({
        type: 'CONTRACT_SIGNED_UPLOADED',
        eventType: 'CONTRACT_SIGNED_UPLOADED',
        timestamp: purchaseData.contract_signed_uploaded_at || purchaseData.updated_at,
        actorName: contractActorName,
        actorRole: contractActorRole,
        actorUserId: contractActorId,
        metadata: { docType: 'CONTRACT_SIGNED', fileId: purchaseData.contract_signed_document_id, reason: 'Contrato firmado subido' }
      });
    }

    if (purchaseData.estimated_arrival_at) {
      businessEvents.push({
        type: 'ESTIMATED_ARRIVAL_SET',
        eventType: 'ESTIMATED_ARRIVAL_SET',
        timestamp: purchaseData.estimated_arrival_updated_at || purchaseData.updated_at,
        actorName: 'Operaciones',
        actorRole: 'jefe_operaciones',
        actorUserId: null,
        metadata: { estimatedArrivalAt: purchaseData.estimated_arrival_at, reason: 'Fecha tentativa de llegada definida' }
      });
    }

    if (purchaseData.equipment_arrived_at) {
      const arrivedActorId = purchaseData.equipment_arrived_by || null;
      businessEvents.push({
        type: 'EQUIPMENT_ARRIVED',
        eventType: 'EQUIPMENT_ARRIVED',
        timestamp: purchaseData.equipment_arrived_at,
        actorName: resolveActorName(arrivedActorId, 'Operaciones'),
        actorRole: resolveActorRole(arrivedActorId, 'jefe_operaciones'),
        actorUserId: arrivedActorId,
        metadata: { reason: 'Equipo recibido en operaciones' }
      });
    }

    if (purchaseData.delivery_dates_json) {
      businessEvents.push({
        type: 'DELIVERY_DATES_SET',
        eventType: 'DELIVERY_DATES_SET', // FASE 6: Alias FE-compat
        timestamp: purchaseData.updated_at,
        actorRole: 'asesor_comercial',
        actorUserId: null,
        metadata: { deliveryDates: purchaseData.delivery_dates_json, reason: 'Fechas entrega establecidas' }
      });
    }

    // Combine and sort all events
    const allEvents = [...transitions, ...businessEvents]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map((event) => ({
        ...event,
        timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp
      }));

    res.json({
      ok: true,
      data: {
        purchase_id: purchaseId,
        current_state: currentState,
        requested_by_name: resolveActorName(purchaseData.created_by),
        requested_by_role: resolveActorRole(purchaseData.created_by),
        documents,
        checklist,
        events: allEvents,
        total_events: allEvents.length
      }
    });
  } catch (error) {
    next(error);
  }
};
