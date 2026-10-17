/**
 * Unified Purchases Flow Service
 *
 * Funciones esenciales del flujo unificado: comercial → backoffice → ACP
 *
 * Este servicio contiene las funciones clave del flujo de private-purchases
 * adaptadas para equipment-purchases.
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const { UnifiedPurchaseStateMachine, UNIFIED_PURCHASE_STATES } = require('./unifiedPurchaseStateMachine');
const crmPurchaseSyncService = require("../crm-fam/crmPurchaseSync.service");
const {
  PURCHASE_TYPES,
  PRIVATE_MODALITIES,
  getVisibleTabs,
  getAllowedActions,
  isTabVisible,
  isActionAllowed
} = require('./unifiedPurchaseVisibility.config');

class UnifiedPurchasesFlowService {
  /**
   * Enviar solicitud a ACP
   */
  static async forwardToAcp(purchaseId, user) {
    logger.debug('[UNIFIED_PURCHASE][BE][ACP_FORWARD][REQUEST]', {
      requestId: purchaseId,
      userId: user?.id
    });

    const { rows } = await db.query(
      'SELECT forwarded_to_acp_at FROM equipment_purchase_requests WHERE id = $1',
      [purchaseId]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    if (rows[0].forwarded_to_acp_at) {
      const error = new Error('Solicitud ya fue enviada a ACP');
      error.status = 409;
      error.code = 'DOC_ALREADY_EXISTS';
      throw error;
    }

    await db.query(
      'UPDATE equipment_purchase_requests SET forwarded_to_acp_at = NOW(), updated_at = NOW() WHERE id = $1',
      [purchaseId]
    );

    await UnifiedPurchaseStateMachine.transition(
      purchaseId,
      UNIFIED_PURCHASE_STATES.ACP_AVAILABILITY_REQUESTED,
      user?.id,
      'Solicitud enviada a ACP'
    );

    const { rows: statusRows } = await db.query(
      'SELECT status_unified FROM equipment_purchase_requests WHERE id = $1',
      [purchaseId]
    );

    logger.debug('[UNIFIED_PURCHASE][BE][ACP_FORWARD][STATUS_CHECK]', {
      requestId: purchaseId,
      status: statusRows[0]?.status_unified
    });

    logger.debug('[UNIFIED_PURCHASE][BE][ACP_FORWARD][DONE]', {
      requestId: purchaseId
    });

    return { forwarded: true };
  }

  /**
   * Confirmar disponibilidad desde ACP
   */
  static async confirmAcpAvailability(purchaseId, user, confirmed = true, notes = '') {
    logger.debug('[UNIFIED_PURCHASE][BE][ACP_AVAILABILITY][CONFIRM]', {
      requestId: purchaseId,
      userId: user?.id,
      confirmed,
      notes
    });

    const targetState = confirmed
      ? UNIFIED_PURCHASE_STATES.ACP_AVAILABILITY_CONFIRMED
      : UNIFIED_PURCHASE_STATES.ACP_AVAILABILITY_REJECTED;

    const reason = confirmed
      ? 'Disponibilidad confirmada por ACP'
      : `Disponibilidad rechazada por ACP: ${notes || 'Sin notas'}`;

    await UnifiedPurchaseStateMachine.transition(
      purchaseId,
      targetState,
      user?.id,
      reason,
      { notes }
    );

    return { confirmed, notes };
  }

  /**
   * Volver a backoffice desde ACP
   */
  static async returnToBackoffice(purchaseId, user, notes = '') {
    logger.debug('[UNIFIED_PURCHASE][BE][ACP_RETURN_TO_BACKOFFICE]', {
      requestId: purchaseId,
      userId: user?.id,
      notes
    });

    await UnifiedPurchaseStateMachine.transition(
      purchaseId,
      UNIFIED_PURCHASE_STATES.PENDING_BACKOFFICE,
      user?.id,
      `Volviendo a backoffice desde ACP: ${notes || 'Sin notas'}`,
      { notes }
    );

    return { returned: true, notes };
  }

  /**
   * Iniciar Business Case para comodato
   */
  static async startBusinessCase(purchaseId, user) {
    logger.debug('[UNIFIED_PURCHASE][BE][BC_START]', {
      requestId: purchaseId,
      userId: user?.id
    });

    await UnifiedPurchaseStateMachine.transition(
      purchaseId,
      UNIFIED_PURCHASE_STATES.BUSINESS_CASE_IN_PROGRESS,
      user?.id,
      'Iniciando Business Case'
    );

    return { started: true };
  }

  /**
   * Enviar oferta
   */
  static async sendOffer(purchaseId, user, offerDocumentId = null) {
    logger.debug('[UNIFIED_PURCHASE][BE][OFFER_SEND]', {
      requestId: purchaseId,
      userId: user?.id,
      offerDocumentId
    });

    const updateData = { updated_at: 'NOW()' };
    const updateValues = [purchaseId];

    if (offerDocumentId) {
      updateData.offer_document_id = offerDocumentId;
    }

    await UnifiedPurchaseStateMachine.transition(
      purchaseId,
      UNIFIED_PURCHASE_STATES.OFFER_SENT,
      user?.id,
      'Oferta enviada'
    );

    try {
      await crmPurchaseSyncService.syncPublicPurchaseStage(
        purchaseId,
        crmPurchaseSyncService.STAGE_NAMES.PROPOSAL_PRESENTATION,
        user,
      );
    } catch (crmSyncError) {
      logger.warn({ crmSyncError, purchaseId }, 'No se pudo sincronizar oferta publica con CRM');
    }

    return { sent: true, offerDocumentId };
  }

  /**
   * Subir oferta firmada por el cliente (requisito para contrato)
   */
  static async uploadSignedOffer(purchaseId, { signedOfferBase64, fileName, mimeType, fileId } = {}, user) {
    logger.debug('[UNIFIED_PURCHASE][BE][OFFER_SIGNED_UPLOAD]', {
      requestId: purchaseId,
      userId: user?.id,
      fileName
    });

    // Verificar que la solicitud exista y no tenga oferta firmada aún
    const { rows } = await db.query(
      'SELECT offer_signed_document_id FROM equipment_purchase_requests WHERE id = $1',
      [purchaseId]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    if (rows[0].offer_signed_document_id) {
      const error = new Error('Oferta firmada ya fue subida anteriormente');
      error.status = 409;
      error.code = 'DOC_ALREADY_EXISTS';
      throw error;
    }

    // TODO: Aquí debería ir la lógica de subida a Drive
    // Por ahora, usamos el fileId directamente si se proporciona
    let finalFileId = fileId;

    if (!finalFileId && signedOfferBase64) {
      // TODO: Implementar subida real a Drive usando uploadBase64File
      // Por ahora, generamos un ID temporal para demostración
      finalFileId = `signed-offer-${purchaseId}-${Date.now()}`;
    }

    if (!finalFileId) {
      const error = new Error('Se requiere fileId o signedOfferBase64');
      error.status = 400;
      throw error;
    }

    // Actualizar la solicitud con la oferta firmada
    await db.query(
      `UPDATE equipment_purchase_requests
       SET offer_signed_document_id = $1,
           offer_signed_uploaded_at = NOW(),
           signed_offer_received_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [finalFileId, purchaseId]
    );

    // Transición de estado (si aplica)
    try {
      await UnifiedPurchaseStateMachine.transition(
        purchaseId,
        UNIFIED_PURCHASE_STATES.OFFER_SIGNED,
        user?.id,
        'Oferta firmada subida'
      );
    } catch (transitionError) {
      logger.warn({ error: transitionError.message }, 'No se pudo transicionar estado, pero la oferta se subió correctamente');
    }

    try {
      await crmPurchaseSyncService.syncPublicPurchaseStage(
        purchaseId,
        crmPurchaseSyncService.STAGE_NAMES.NEGOTIATION,
        user,
      );
    } catch (crmSyncError) {
      logger.warn({ crmSyncError, purchaseId }, 'No se pudo sincronizar oferta firmada publica con CRM');
    }

    return {
      uploaded: true,
      fileId: finalFileId,
      uploadedAt: new Date().toISOString()
    };
  }

  /**
   * Marcar equipo interno como listo (regla de disponibilidad)
   */
  static async setEquipmentReady(purchaseId, user) {
    logger.debug('[UNIFIED_PURCHASE][BE][EQUIPMENT_READY]', {
      requestId: purchaseId,
      userId: user?.id
    });

    await db.query(
      `UPDATE equipment_purchase_requests
       SET equipment_ready_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [purchaseId]
    );

    return { ready: true, readyAt: new Date().toISOString() };
  }

  /**
   * Actualizar checklist del portal público
   */
  static async updatePublicPortalChecklist(purchaseId, user, { checklist, evidenceUrl, dueDate, responsibleId } = {}) {
    logger.debug('[UNIFIED_PURCHASE][BE][PORTAL_CHECKLIST_UPDATE]', {
      requestId: purchaseId,
      userId: user?.id
    });

    const updateFields = [];
    const updateValues = [purchaseId];
    let paramIndex = 2;

    if (checklist !== undefined) {
      updateFields.push(`public_portal_checklist = $${paramIndex++}`);
      updateValues.push(checklist);
    }
    if (evidenceUrl !== undefined) {
      updateFields.push(`public_portal_evidence_url = $${paramIndex++}`);
      updateValues.push(evidenceUrl);
    }
    if (dueDate !== undefined) {
      updateFields.push(`public_portal_due_date = $${paramIndex++}`);
      updateValues.push(dueDate);
    }
    if (responsibleId !== undefined) {
      updateFields.push(`public_portal_responsible_id = $${paramIndex++}`);
      updateValues.push(responsibleId);
    }

    if (updateFields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    await db.query(
      `UPDATE equipment_purchase_requests
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $1`,
      updateValues
    );

    return { updated: true };
  }

  /**
   * Iniciar control operativo
   */
  static async startControlOperativo(purchaseId, user, { maxQuantity, requestedQuantity } = {}) {
    logger.debug('[UNIFIED_PURCHASE][BE][CONTROL_OPERATIVO_START]', {
      requestId: purchaseId,
      userId: user?.id
    });

    const remaining = maxQuantity ? maxQuantity - (requestedQuantity || 0) : null;

    await db.query(
      `UPDATE equipment_purchase_requests
       SET max_quantity = $1,
           requested_quantity = $2,
           remaining_quantity = $3,
           control_operativo_started_at = NOW(),
           status_unified = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [
        maxQuantity,
        requestedQuantity,
        remaining,
        UNIFIED_PURCHASE_STATES.CONTROL_OPERATIVO_IN_PROGRESS,
        purchaseId
      ]
    );

    return { started: true };
  }

  /**
   * Registrar entrega (fuente de verdad: Logística)
   */
  static async registerDelivery(purchaseId, user, { deliveredQuantity } = {}) {
    logger.debug('[UNIFIED_PURCHASE][BE][DELIVERY_REGISTER]', {
      requestId: purchaseId,
      userId: user?.id,
      deliveredQuantity
    });

    // Obtener valores actuales
    const { rows } = await db.query(
      `SELECT max_quantity, requested_quantity, delivered_quantity
       FROM equipment_purchase_requests
       WHERE id = $1`,
      [purchaseId]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const current = rows[0];
    const newDelivered = (current.delivered_quantity || 0) + (deliveredQuantity || 0);
    const remaining = current.max_quantity ? current.max_quantity - newDelivered : null;

    // Actualizar (solo Logística puede registrar entregas)
    await db.query(
      `UPDATE equipment_purchase_requests
       SET delivered_quantity = $1,
           remaining_quantity = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [newDelivered, remaining, purchaseId]
    );

    // Verificar si control operativo está completo
    if (remaining !== null && remaining <= 0) {
      await db.query(
        `UPDATE equipment_purchase_requests
         SET control_operativo_completed_at = NOW(),
             status_unified = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [UNIFIED_PURCHASE_STATES.CONTROL_OPERATIVO_COMPLETADO, purchaseId]
      );
    }

    return {
      registered: true,
      deliveredQuantity: newDelivered,
      remainingQuantity: remaining
    };
  }

  /**
   * Completar control operativo manualmente
   */
  static async completeControlOperativo(purchaseId, user) {
    logger.debug('[UNIFIED_PURCHASE][BE][CONTROL_OPERATIVO_COMPLETE]', {
      requestId: purchaseId,
      userId: user?.id
    });

    await db.query(
      `UPDATE equipment_purchase_requests
       SET control_operativo_completed_at = NOW(),
           status_unified = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [UNIFIED_PURCHASE_STATES.CONTROL_OPERATIVO_COMPLETADO, purchaseId]
    );

    return { completed: true };
  }

  /**
   * Obtener configuración de visibilidad dinámica por usuario y solicitud
   */
  static async getVisibilityConfig(purchaseId, user) {
    logger.debug('[UNIFIED_PURCHASE][BE][VISIBILITY_CONFIG]', {
      requestId: purchaseId,
      userId: user?.id,
      userRole: user?.role
    });

    // Obtener la solicitud para conocer el tipo y estado
    const { rows } = await db.query(
      `SELECT 
         status_unified,
         status,
         purchase_type,
         private_modality,
         offer_signed_document_id,
         public_portal_outcome
       FROM equipment_purchase_requests
       WHERE id = $1`,
      [purchaseId]
    );

    if (!rows.length) {
      throw new Error('Solicitud no encontrada');
    }

    const purchase = rows[0];
    const purchaseType = purchase.purchase_type || PURCHASE_TYPES.PRIVATE;
    const currentState = purchase.status_unified || purchase.status;
    const userRole = user?.role;

    // Obtener tabs visibles
    const visibleTabs = getVisibleTabs(purchaseType, userRole);

    // Obtener acciones permitidas
    const allowedActions = getAllowedActions(currentState, purchaseType, userRole, {
      modality: purchase.private_modality
    });

    // Verificar dependencias específicas
    const canStartContract = (() => {
      if (purchaseType === PURCHASE_TYPES.PRIVATE) {
        return Boolean(purchase.offer_signed_document_id);
      }
      if (purchaseType === PURCHASE_TYPES.PUBLIC) {
        const outcome = purchase.public_portal_outcome?.outcome || purchase.public_portal_outcome;
        return String(outcome).trim().toLowerCase() === 'ganado';
      }
      return false;
    })();

    return {
      purchaseType,
      currentState,
      userRole,
      visibleTabs,
      allowedActions,
      dependencies: {
        canStartContract
      },
      purchaseDetails: {
        private_modality: purchase.private_modality,
        has_signed_offer: Boolean(purchase.offer_signed_document_id),
        public_portal_outcome: purchase.public_portal_outcome
      }
    };
  }
}

module.exports = UnifiedPurchasesFlowService;
