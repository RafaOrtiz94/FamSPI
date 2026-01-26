/**
 * Private Purchase State Machine
 *
 * Domain-driven state management for private purchase workflow.
 * Enforces canonical state transitions and maintains audit trail.
 *
 * Supports both "Compra Directa" and "Comodato" flows.
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const { PRIVATE_PURCHASE_STATES, PRIVATE_PURCHASE_TRANSITIONS, FLOW_TYPES } = require('./privatePurchaseStates.constants');

class PrivatePurchaseStateMachine {
    static async _ensureTransitionTable() {
        if (this._transitionTableReady) return;
        await db.query(`
            CREATE TABLE IF NOT EXISTS private_purchase_state_transitions (
                id SERIAL PRIMARY KEY,
                purchase_id UUID NOT NULL,
                from_state TEXT NOT NULL,
                to_state TEXT NOT NULL,
                transition_reason TEXT,
                transitioned_by INTEGER,
                metadata JSONB,
                transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        this._transitionTableReady = true;
    }
    /**
     * Get current canonical state for a private purchase
     * @param {string} purchaseId - UUID of the private purchase
     * @returns {string} Current canonical state
     */
    static async getCurrentState(purchaseId) {
        const { rows } = await db.query(
            `SELECT status FROM private_purchase_requests WHERE id = $1`,
            [purchaseId]
        );

        if (!rows.length) {
            throw new Error(`Private Purchase ${purchaseId} not found`);
        }

        const currentState = rows[0].status;
        if (!currentState) {
            throw new Error(`Private Purchase ${purchaseId} has no status set`);
        }

        return currentState;
    }

    /**
     * Check if a transition is allowed
     * @param {string} fromState - Current state
     * @param {string} toState - Target state
     * @returns {boolean} True if transition is allowed
     */
    static canTransition(fromState, toState) {
        // Validate state existence
        if (!Object.values(PRIVATE_PURCHASE_STATES).includes(fromState)) {
            throw new Error(`Invalid fromState: ${fromState}`);
        }
        if (!Object.values(PRIVATE_PURCHASE_STATES).includes(toState)) {
            throw new Error(`Invalid toState: ${toState}`);
        }

        // Check transition rules
        return PRIVATE_PURCHASE_TRANSITIONS[fromState]?.includes(toState) || false;
    }

    /**
     * Execute a validated state transition
     * @param {string} purchaseId - UUID of the private purchase
     * @param {string} toState - Target canonical state
     * @param {string} userId - ID of user performing transition
     * @param {string} reason - Reason for transition (optional)
     * @param {object} metadata - Additional metadata (optional)
     * @returns {object} Transition result
     */
    static async transition(purchaseId, toState, userId, reason = '', metadata = {}) {
        // Validate inputs
        if (!purchaseId || !toState || !userId) {
            throw new Error('purchaseId, toState, and userId are required');
        }

        await this._ensureTransitionTable();

        // Get current state
        const fromState = await this.getCurrentState(purchaseId);

        // FASE 3: Rechazo con motivo obligatorio
        if (toState === PRIVATE_PURCHASE_STATES.CONTRACT_REJECTED) {
            console.log(`[FLOW_PRIVADA][BE][FASE3][GERENCIA][REJECT][START] Validando motivo para rejection de purchase ${purchaseId}`);

            if (!reason || reason.trim().length === 0) {
                console.log(`[FLOW_PRIVADA][BE][FASE3][GERENCIA][REJECT][BLOCKED_NO_REASON] Motivo faltante para purchase ${purchaseId}`);
                const error = new Error('Motivo de rechazo es obligatorio');
                error.status = 400;
                error.code = 'GERENCIA_REJECTION_REASON_REQUIRED';
                error.details = { field: 'reason' };
                throw error;
            }

            console.log(`[FLOW_PRIVADA][BE][FASE3][GERENCIA][REJECT][OK] Motivo válido para purchase ${purchaseId}`);
        }

        // FASE 3: Corrección sin reiniciar - validar docs antes de resubmit desde contract_rejected
        if (fromState === PRIVATE_PURCHASE_STATES.CONTRACT_REJECTED && toState === PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL) {
            console.log(`[FLOW_PRIVADA][BE][FASE3][CORRECTION][RESUBMIT][CHECK_DOCS] Verificando docs completos para resubmit desde rejected ${purchaseId}`);

            const documentsCheck = await this._checkRequiredDocumentsForGerencia(purchaseId);

            if (!documentsCheck.allPresent) {
                console.log(`[FLOW_PRIVADA][BE][FASE3][CORRECTION][RESUBMIT][BLOCKED_DOCS] Faltan docs para resubmit: ${documentsCheck.missingDocs.join(', ')}`);
                const error = new Error('Documentos incompletos para reenviar a gerencia');
                error.status = 409;
                error.code = 'DOCS_INCOMPLETE_FOR_GERENCIA';
                error.details = { missingDocs: documentsCheck.missingDocs };
                throw error;
            }

            console.log(`[FLOW_PRIVADA][BE][FASE3][CORRECTION][RESUBMIT][OK] Docs completos para resubmit ${purchaseId}`);
        }
        // FASE 2: Gate duro - documentos completos antes de enviar a gerencia
        if (toState === PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL) {
            console.log(`[FLOW_PRIVADA][BE][FASE2][GERENCIA_DOC_GATE][CHECK] Verificando documentos para purchase ${purchaseId}`);

            const documentsCheck = await this._checkRequiredDocumentsForGerencia(purchaseId);

            if (!documentsCheck.allPresent) {
                console.log(`[FLOW_PRIVADA][BE][FASE2][GERENCIA_DOC_GATE][BLOCKED] Faltan documentos: ${documentsCheck.missingDocs.join(', ')}`);

                const error = new Error('Documentos incompletos para enviar a gerencia');
                error.status = 409;
                error.code = 'DOCS_INCOMPLETE_FOR_GERENCIA';
                error.details = { missingDocs: documentsCheck.missingDocs };
                throw error;
            }

            console.log(`[FLOW_PRIVADA][BE][FASE2][GERENCIA_DOC_GATE][OK] Todos los documentos presentes para purchase ${purchaseId}`);
        }
        // Validate transition
        if (!this.canTransition(fromState, toState)) {
            const error = new Error(`Invalid transition from ${fromState} to ${toState}`);
            error.status = 400;
            error.code = 'INVALID_TRANSITION';
            throw error;
        }

        // Prevent no-op transitions
        if (fromState === toState) {
            const error = new Error(`Cannot transition to same state: ${toState}`);
            error.status = 400;
            error.code = 'NO_OP_TRANSITION';
            throw error;
        }

        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Update status
            const updateResult = await client.query(
                `UPDATE private_purchase_requests
         SET status = $1, updated_at = NOW()
         WHERE id = $2`,
                [toState, purchaseId]
            );

            if (updateResult.rowCount !== 1) {
                throw new Error(`Failed to update status for private purchase ${purchaseId}`);
            }

            console.log('[FLOW_PRIVADA][BE][STATE][TRANSITION]', {
                requestId: purchaseId,
                fromState,
                toState
            });

            // Log transition in audit table (create if doesn't exist)
            await client.query(
                `INSERT INTO private_purchase_state_transitions (
          purchase_id, from_state, to_state, transition_reason,
          transitioned_by, metadata, transitioned_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT DO NOTHING`, // Allow if table doesn't exist yet
                [purchaseId, fromState, toState, reason, userId, JSON.stringify(metadata)]
            ).catch(err => {
                // Table might not exist yet, log but don't fail
                logger.warn({ err, purchaseId }, 'Could not log state transition (table may not exist)');
            });

            await client.query('COMMIT');

            // NOTIFICACIONES: Enviar notificaciones después de transición exitosa
            setImmediate(async () => {
                try {
                    const recipients = await this._getTransitionRecipients(purchaseId, fromState, toState);
                    const notificationManager = require('../notifications/notificationManager');

                    for (const recipient of recipients) {
                        await notificationManager.sendNotification({
                            userId: recipient.userId,
                            template: 'private_purchase_state_transition',
                            data: {
                                purchase_id: purchaseId,
                                from_state: this._getStateFriendlyName(fromState),
                                to_state: this._getStateFriendlyName(toState),
                                transitioned_by: userId,
                                reason: reason || 'Sin motivo especificado'
                            },
                            email: recipient.sendEmail,
                            chat: recipient.sendChat,
                            priority: this._getTransitionPriority(toState),
                            source: 'private_purchase.state_transition',
                            meta: {
                                purchaseId,
                                fromState,
                                toState,
                                transitionedBy: userId
                            }
                        });
                    }
                } catch (notificationError) {
                    logger.warn({ notificationError, purchaseId }, 'Error enviando notificaciones de transición private purchase');
                    // No lanzamos error para no afectar la transición exitosa
                }
            });

            logger.info({
                purchaseId,
                fromState,
                toState,
                userId,
                reason
            }, 'Private purchase state transition completed');

            return {
                success: true,
                purchaseId,
                fromState,
                toState,
                transitionedAt: new Date(),
                transitionedBy: userId
            };

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error({
                purchaseId,
                fromState,
                toState,
                userId,
                error: error.message
            }, 'Private purchase state transition failed');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get all allowed transitions from current state
     * @param {string} currentState - Current canonical state
     * @returns {string[]} Array of allowed target states
     */
    static getAllowedTransitions(currentState) {
        if (!Object.values(PRIVATE_PURCHASE_STATES).includes(currentState)) {
            throw new Error(`Invalid state: ${currentState}`);
        }
        return [...PRIVATE_PURCHASE_TRANSITIONS[currentState]];
    }

    /**
     * Validate that a state exists in the canonical state machine
     * @param {string} state - State to validate
     * @returns {boolean} True if state is valid
     */
    static isValidState(state) {
        return Object.values(PRIVATE_PURCHASE_STATES).includes(state);
    }

    /**
     * Get all canonical states
     * @returns {object} Object with all state constants
     */
    static getStates() {
        return { ...PRIVATE_PURCHASE_STATES };
    }

    /**
     * Check if a state is terminal (no outgoing transitions)
     * @param {string} state - State to check
     * @returns {boolean} True if terminal state
     */
    static isTerminalState(state) {
        return PRIVATE_PURCHASE_TRANSITIONS[state]?.length === 0;
    }

    /**
     * Get recipients for state transition notifications
     * @private
     */
    static async _getTransitionRecipients(purchaseId, fromState, toState) {
        const recipients = [];

        // Get purchase data
        const { rows } = await db.query(`
      SELECT
        created_by,
        client_snapshot,
        offer_kind,
        delivery_act_assigned_to_user_id,
        delivery_act_assigned_to_email,
        delivery_act_assigned_to_name
      FROM private_purchase_requests
      WHERE id = $1
    `, [purchaseId]);

        if (!rows.length) return recipients;

        const purchase = rows[0];
        const clientData = purchase.client_snapshot || {};
        const isComodato = purchase.offer_kind === 'prestamo';
        let assignedTechnicianId = purchase.delivery_act_assigned_to_user_id || null;
        if (!assignedTechnicianId && purchase.delivery_act_assigned_to_email) {
            try {
                const { rows: techRows } = await db.query(
                    'SELECT id FROM users WHERE email = $1 AND active = true LIMIT 1',
                    [purchase.delivery_act_assigned_to_email]
                );
                assignedTechnicianId = techRows[0]?.id || null;
            } catch (error) {
                logger.warn({ error, purchaseId }, 'No se pudo resolver tecnico asignado por email');
            }
        }

        // Always notify creator
        if (purchase.created_by) {
            recipients.push({
                userId: purchase.created_by,
                sendEmail: true,
                sendChat: false,
                extraInfo: 'Como creador de la solicitud privada'
            });
        }

        // Notify according to target state and roles
        switch (toState) {
            case PRIVATE_PURCHASE_STATES.PENDING_BACKOFFICE:
                // Notify BackOffice users
                {
                    const backofficeUsers = await this._getUsersByRole('backoffice_comercial');
                    recipients.push(...backofficeUsers.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: true,
                        extraInfo: 'Nueva solicitud privada requiere atencion'
                    })));
                }
                break;

            case PRIVATE_PURCHASE_STATES.OFFER_SENT:
                // Notify asesor_comercial (creator)
                // Already included above
                break;

            case PRIVATE_PURCHASE_STATES.OFFER_SIGNED:
                // Notify BackOffice for review
                {
                    const backofficeReview = await this._getUsersByRole('backoffice_comercial');
                    recipients.push(...backofficeReview.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: false,
                        extraInfo: 'Oferta firmada lista para aprobacion'
                    })));
                }
                break;

            case PRIVATE_PURCHASE_STATES.CLIENT_REGISTERED:
                // Notify asesor_comercial to upload signed offer
                // Already included above
                break;

            case PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL:
                // Notify gerencia_general
                {
                    const management = await this._getUsersByRole('gerencia_general');
                    recipients.push(...management.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: true,
                        extraInfo: 'Contrato requiere aprobacion final'
                    })));
                }
                break;

            case PRIVATE_PURCHASE_STATES.CONTRACT_REJECTED:
                // Notify BackOffice to make corrections
                {
                    const backofficeCorrection = await this._getUsersByRole('backoffice_comercial');
                    recipients.push(...backofficeCorrection.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: false,
                        extraInfo: 'Contrato rechazado - requiere correcciones'
                    })));
                }
                break;

            case PRIVATE_PURCHASE_STATES.CONTRACT_AVAILABLE:
                // Notify jefe_operaciones + backoffice
                {
                    const operations = await this._getUsersByRole('jefe_operaciones');
                    recipients.push(...operations.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: true,
                        extraInfo: 'Contrato disponible para coordinar fechas'
                    })));

                    const backoffice = await this._getUsersByRole('backoffice_comercial');
                    recipients.push(...backoffice.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: false,
                        extraInfo: 'Contrato disponible'
                    })));
                }
                break;

            case PRIVATE_PURCHASE_STATES.DELIVERY_DATES_REQUESTED:
                // Notify asesor_comercial (creator already included above)
                break;

            case PRIVATE_PURCHASE_STATES.DELIVERY_DATES_SUBMITTED:
                // Notify jefe_logistica
                {
                    const logistics = await this._getUsersByRole('jefe_logistica');
                    recipients.push(...logistics.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: true,
                        extraInfo: 'Fecha de entrega definida'
                    })));
                }
                break;

            case PRIVATE_PURCHASE_STATES.WAITING_DISPATCH:
            case PRIVATE_PURCHASE_STATES.DISPATCH_READY:
                // Notify jefe_logistica
                {
                    const logistics = await this._getUsersByRole('jefe_logistica');
                    recipients.push(...logistics.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: true,
                        extraInfo: 'Despacho requiere preparacion'
                    })));
                }
                break;

            case PRIVATE_PURCHASE_STATES.DELIVERY_ACT_DRAFT_READY:
                // Notify jefe_tecnico + operaciones + logistica
                {
                    const techLead = await this._getUsersByRole('jefe_tecnico');
                    recipients.push(...techLead.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: true,
                        extraInfo: 'Borrador de acta listo para asignar tecnico'
                    })));

                    const operations = await this._getUsersByRole('jefe_operaciones');
                    recipients.push(...operations.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: true,
                        extraInfo: 'Borrador de acta generado por logistica'
                    })));

                    const logistics = await this._getUsersByRole('jefe_logistica');
                    recipients.push(...logistics.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: true,
                        extraInfo: 'Borrador de acta generado'
                    })));
                }
                break;

            case PRIVATE_PURCHASE_STATES.DELIVERY_ACT_TECH_ASSIGNED:
                // Notify logistica + tecnico asignado + operaciones
                {
                    const logistics = await this._getUsersByRole('jefe_logistica');
                    recipients.push(...logistics.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: true,
                        extraInfo: 'Tecnico asignado, pendiente firma de logistica'
                    })));

                    if (assignedTechnicianId) {
                        recipients.push({
                            userId: assignedTechnicianId,
                            sendEmail: true,
                            sendChat: true,
                            extraInfo: 'Fuiste asignado para entrega, espera firma de logistica'
                        });
                    }

                    const operations = await this._getUsersByRole('jefe_operaciones');
                    recipients.push(...operations.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: true,
                        extraInfo: 'Tecnico asignado para entrega'
                    })));
                }
                break;

            case PRIVATE_PURCHASE_STATES.DELIVERY_ACT_LOGISTICS_SIGNED:
                // Notify tecnico asignado + operaciones + logistica
                {
                    if (assignedTechnicianId) {
                        recipients.push({
                            userId: assignedTechnicianId,
                            sendEmail: true,
                            sendChat: true,
                            extraInfo: 'Acta firmada por logistica, sube acta final firmada'
                        });
                    }

                    const operations = await this._getUsersByRole('jefe_operaciones');
                    recipients.push(...operations.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: true,
                        extraInfo: 'Acta firmada por logistica'
                    })));

                    const logistics = await this._getUsersByRole('jefe_logistica');
                    recipients.push(...logistics.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: true,
                        extraInfo: 'Acta firmada por logistica'
                    })));
                }
                break;
            case PRIVATE_PURCHASE_STATES.DELIVERY_ACT_GENERATED:
                // Notify tecnico asignado + operaciones + logistica
                {
                    if (assignedTechnicianId) {
                        recipients.push({
                            userId: assignedTechnicianId,
                            sendEmail: true,
                            sendChat: true,
                            extraInfo: 'Acta final firmada y registrada'
                        });
                    }

                    const operations = await this._getUsersByRole('jefe_operaciones');
                    recipients.push(...operations.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: true,
                        extraInfo: 'Acta final firmada y registrada'
                    })));

                    const logistics = await this._getUsersByRole('jefe_logistica');
                    recipients.push(...logistics.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: true,
                        extraInfo: 'Acta final firmada y registrada'
                    })));
                }
                break;

            // Business Case specific notifications
            case PRIVATE_PURCHASE_STATES.BUSINESS_CASE_IN_PROGRESS:
                // Notify asesor_comercial to create business case
                // Already included above
                break;

            case PRIVATE_PURCHASE_STATES.BUSINESS_CASE_UNDER_REVIEW:
                // Notify jefe_comercial for feasibility evaluation
                {
                    const jefeComercial = await this._getUsersByRole('jefe_comercial');
                    recipients.push(...jefeComercial.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: false,
                        extraInfo: 'Business Case requiere evaluacion de viabilidad'
                    })));
                }
                break;

            case PRIVATE_PURCHASE_STATES.BUSINESS_CASE_FEASIBILITY_APPROVED:
                // Notify BackOffice to create offer
                {
                    const backofficeOffer = await this._getUsersByRole('backoffice_comercial');
                    recipients.push(...backofficeOffer.map(u => ({
                        userId: u.id,
                        sendEmail: true,
                        sendChat: false,
                        extraInfo: 'Business Case aprobado - crear oferta'
                    })));
                }
                break;
        }

        return recipients;
    }

    /**
     * Get users by role
     * @private
     */
    static async _getUsersByRole(role) {
        try {
            const { rows } = await db.query(
                'SELECT id, email, fullname FROM users WHERE role = $1 AND active = true',
                [role]
            );
            return rows;
        } catch (error) {
            logger.warn({ error, role }, 'Error obteniendo usuarios por rol');
            return [];
        }
    }

    /**
     * Get friendly name for state
     * @private
     */
    static _getStateFriendlyName(state) {
        const names = {
            [PRIVATE_PURCHASE_STATES.PENDING_COMMERCIAL]: 'Pendiente Asesor Comercial',
            [PRIVATE_PURCHASE_STATES.PENDING_BACKOFFICE]: 'Pendiente BackOffice',
            [PRIVATE_PURCHASE_STATES.OFFER_SENT]: 'Oferta Enviada',
            [PRIVATE_PURCHASE_STATES.PENDING_MANAGER_SIGNATURE]: 'Pendiente Firma Gerencia',
            [PRIVATE_PURCHASE_STATES.PENDING_CLIENT_SIGNATURE]: 'Pendiente Firma Cliente',
            [PRIVATE_PURCHASE_STATES.OFFER_SIGNED]: 'Oferta Firmada',
            [PRIVATE_PURCHASE_STATES.CLIENT_REGISTRATION_REQUESTED]: 'Registro Cliente Solicitado',
            [PRIVATE_PURCHASE_STATES.CLIENT_REGISTERED]: 'Cliente Registrado',
            [PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_CLIENT_SIGNATURE]: 'Pendiente firma cliente (contrato)',
            [PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL]: 'Pendiente Aprobacion Contrato',
            [PRIVATE_PURCHASE_STATES.CONTRACT_AVAILABLE]: 'Contrato Disponible',
            [PRIVATE_PURCHASE_STATES.CONTRACT_REJECTED]: 'Contrato Rechazado',
            [PRIVATE_PURCHASE_STATES.DELIVERY_DATES_REQUESTED]: 'Pendiente Fechas Entrega',
            [PRIVATE_PURCHASE_STATES.DELIVERY_DATES_SUBMITTED]: 'Fechas Entrega Establecidas',
            [PRIVATE_PURCHASE_STATES.CALENDAR_EVENTS_CREATED]: 'Eventos Calendario Creados',
            [PRIVATE_PURCHASE_STATES.WAITING_DISPATCH]: 'Esperando Despacho',
            [PRIVATE_PURCHASE_STATES.DISPATCH_READY]: 'Despacho Listo',
            [PRIVATE_PURCHASE_STATES.DELIVERY_ACT_DRAFT_READY]: 'Acta en borrador',
            [PRIVATE_PURCHASE_STATES.DELIVERY_ACT_TECH_ASSIGNED]: 'Tecnico asignado para entrega',
            [PRIVATE_PURCHASE_STATES.DELIVERY_ACT_LOGISTICS_SIGNED]: 'Acta firmada por logistica',
            [PRIVATE_PURCHASE_STATES.DELIVERY_ACT_GENERATED]: 'Acta de Entrega Generada',
            [PRIVATE_PURCHASE_STATES.DELIVERED]: 'Entregado',
            [PRIVATE_PURCHASE_STATES.REJECTED]: 'Rechazado',
            [PRIVATE_PURCHASE_STATES.SENT_TO_ACP]: 'Enviado a ACP',
            [PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_REQUESTED]: 'Disponibilidad ACP Solicitada',
            [PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_CONFIRMED]: 'Disponibilidad ACP Confirmada',
            [PRIVATE_PURCHASE_STATES.ACP_AVAILABILITY_REJECTED]: 'Disponibilidad ACP Rechazada',
            [PRIVATE_PURCHASE_STATES.BUSINESS_CASE_IN_PROGRESS]: 'Business Case en Llenado',
            [PRIVATE_PURCHASE_STATES.BUSINESS_CASE_UNDER_REVIEW]: 'Business Case en Revision',
            [PRIVATE_PURCHASE_STATES.BUSINESS_CASE_FEASIBILITY_APPROVED]: 'Business Case Aprobado',
            [PRIVATE_PURCHASE_STATES.BUSINESS_CASE_REJECTED]: 'Business Case Rechazado'
        };
        return names[state] || state;
    }

    /**
     * Get priority for transition notifications
     * @private
     */
    static _getTransitionPriority(toState) {
        // High priority for critical states
        const highPriorityStates = [
            PRIVATE_PURCHASE_STATES.CONTRACT_REJECTED,
            PRIVATE_PURCHASE_STATES.BUSINESS_CASE_REJECTED,
            PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_CLIENT_SIGNATURE,
            PRIVATE_PURCHASE_STATES.PENDING_CONTRACT_APPROVAL,
            PRIVATE_PURCHASE_STATES.CONTRACT_AVAILABLE,
            PRIVATE_PURCHASE_STATES.DELIVERY_DATES_REQUESTED
        ];

        if (highPriorityStates.includes(toState)) {
            return 3;
        }
        return 2;
    }

    /**
     * FASE 2: Check required documents before sending to gerencia
     * @private
     */
    static async _checkRequiredDocumentsForGerencia(purchaseId) {
        const requiredDocs = [
            'CLIENT_REGISTRATION',
            'INSPECTION_ACT',
            'LOPDP_APPROVAL',
            'CLIENT_ID',
            'OPERATING_PERMIT',
            'ACP_RESPONSE',
            'OFFER_DOCUMENT',
            'SIGNED_OFFER',
            'CONTRACT_DRAFT',
            'CONTRACT_CLIENT_SIGNED'
        ];

        const missingDocs = [];
        const presentDocs = [];

        // Get purchase data to check documents
        const { rows } = await db.query(`
            SELECT
                client_snapshot,
                client_request_id,
                offer_document_id,
                offer_signed_document_id,
                contract_document_id,
                contract_client_signed_document_id,
                inspection_acta_document_id,
                client_registered_at,
                client_approved_at,
                provider_response_at
            FROM private_purchase_requests
            WHERE id = $1
        `, [purchaseId]);

        if (!rows.length) {
            return { allPresent: false, missingDocs: ['PURCHASE_NOT_FOUND'], presentDocs: [] };
        }

        const purchase = rows[0];
        const clientRequestId =
            purchase.client_request_id ||
            purchase.client_snapshot?.registered_client_id ||
            null;

        let clientRequest = null;
        if (clientRequestId) {
            const { rows: clientRows } = await db.query(`
                SELECT
                    id,
                    client_type,
                    ruc_cedula,
                    operating_permit_status,
                    id_file_id,
                    ruc_file_id,
                    operating_permit_file_id,
                    legal_rep_appointment_file_id,
                    approval_letter_file_id,
                    consent_evidence_file_id,
                    consent_record_file_id,
                    lopdp_consent_status,
                    lopdp_consent_at
                FROM client_requests
                WHERE id = $1
            `, [clientRequestId]);
            clientRequest = clientRows[0] || null;
        }

        // Check client registration
        if (!purchase.client_registered_at) {
            missingDocs.push('CLIENT_REGISTRATION');
        } else {
            presentDocs.push('CLIENT_REGISTRATION');
        }

        // Check inspection act
        if (!purchase.inspection_acta_document_id) {
            missingDocs.push('INSPECTION_ACT');
        } else {
            presentDocs.push('INSPECTION_ACT');
        }

        // Acta/oficio de aprobacion es informativo (no bloquea gerencia)
        const approvalLetterId =
            clientRequest?.approval_letter_file_id ||
            purchase.client_snapshot?.acta_registro_file_id;
        if (approvalLetterId) {
            presentDocs.push('ACTA_REGISTRO');
        }

        // Check offer document
        if (!purchase.offer_document_id) {
            missingDocs.push('OFFER_DOCUMENT');
        } else {
            presentDocs.push('OFFER_DOCUMENT');
        }

        // Check LOPDP approval
        const hasLopdp =
            (clientRequest?.lopdp_consent_status || '').toLowerCase() === 'granted' ||
            clientRequest?.consent_record_file_id ||
            clientRequest?.consent_evidence_file_id ||
            purchase.client_approved_at;
        if (!hasLopdp) {
            missingDocs.push('LOPDP_APPROVAL');
        } else {
            presentDocs.push('LOPDP_APPROVAL');
        }

        // Check client ID document
        const idFileId = clientRequest?.id_file_id || purchase.client_snapshot?.id_file_id;
        if (!idFileId) {
            missingDocs.push('CLIENT_ID');
        } else {
            presentDocs.push('CLIENT_ID');
        }

        // Check RUC document (opcional)
        const rucFileId = clientRequest?.ruc_file_id || purchase.client_snapshot?.ruc_file_id;
        if (rucFileId) {
            presentDocs.push('RUC_FILE');
        }

        // Check operating permit when applicable
        const permitStatus = (clientRequest?.operating_permit_status || '').toLowerCase();
        const requiresPermit = permitStatus === 'has_it';
        const permitFileId = clientRequest?.operating_permit_file_id;
        if (requiresPermit && !permitFileId) {
            missingDocs.push('OPERATING_PERMIT');
        } else if (permitFileId) {
            presentDocs.push('OPERATING_PERMIT');
        }

        // Check ACP response
        if (!purchase.provider_response_at) {
            missingDocs.push('ACP_RESPONSE');
        } else {
            presentDocs.push('ACP_RESPONSE');
        }

        // Check signed offer
        if (!purchase.offer_signed_document_id) {
            missingDocs.push('SIGNED_OFFER');
        } else {
            presentDocs.push('SIGNED_OFFER');
        }

        // Check contract draft
        if (!purchase.contract_document_id) {
            missingDocs.push('CONTRACT_DRAFT');
        } else {
            presentDocs.push('CONTRACT_DRAFT');
        }

        // Check client-signed contract
        if (!purchase.contract_client_signed_document_id) {
            missingDocs.push('CONTRACT_CLIENT_SIGNED');
        } else {
            presentDocs.push('CONTRACT_CLIENT_SIGNED');
        }

        return {
            allPresent: missingDocs.length === 0,
            missingDocs,
            presentDocs,
            requiredDocs
        };
    }
}

PrivatePurchaseStateMachine._transitionTableReady = false;

module.exports = {
    PrivatePurchaseStateMachine,
    PRIVATE_PURCHASE_STATES,
    PRIVATE_PURCHASE_TRANSITIONS,
    FLOW_TYPES
};
