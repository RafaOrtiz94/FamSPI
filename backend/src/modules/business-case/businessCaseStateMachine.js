/**
 * Business Case State Machine
 *
 * Domain-driven state management for Business Case workflow.
 * Enforces canonical state transitions and maintains audit trail.
 *
 * Canonical States:
 * - DRAFT_INICIAL: Initial state for newly created business cases
 * - DATOS_BASE_COMPLETOS: Basic data entry completed
 * - EN_EVALUACION_VIABILIDAD: Under viability evaluation
 * - OBSERVADO_POR_VIABILIDAD: Viability evaluation found issues
 * - VIABLE: Passed viability evaluation
 * - AJUSTES_OPERATIVOS: Operational implementation planning
 * - CERRADO_PARA_APROBACION: Ready for final approval
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const { BusinessCaseStateReadiness } = require('./businessCaseStateReadiness');
const { STATES, TRANSITIONS } = require('./businessCaseStates.constants');

class BusinessCaseStateMachine {
  /**
   * Get current canonical state for a business case
   * @param {string} businessCaseId - UUID of the business case
   * @returns {string} Current canonical state
   */
  static async getCurrentState(businessCaseId) {
    const { rows } = await db.query(
      `SELECT canonical_state FROM v_business_cases_complete WHERE business_case_id = $1`,
      [businessCaseId]
    );

    if (!rows.length) {
      throw new Error(`Business Case ${businessCaseId} not found`);
    }

    const currentState = rows[0].canonical_state;
    if (!currentState) {
      throw new Error(`Business Case ${businessCaseId} has no canonical state set`);
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
    if (!Object.values(STATES).includes(fromState)) {
      throw new Error(`Invalid fromState: ${fromState}`);
    }
    if (!Object.values(STATES).includes(toState)) {
      throw new Error(`Invalid toState: ${toState}`);
    }

    // Check transition rules
    return TRANSITIONS[fromState]?.includes(toState) || false;
  }

  /**
   * Execute a validated state transition
   * @param {string} businessCaseId - UUID of the business case
   * @param {string} toState - Target canonical state
   * @param {string} userId - ID of user performing transition
   * @param {string} reason - Reason for transition (optional)
   * @param {object} metadata - Additional metadata (optional)
   * @returns {object} Transition result
   */
  static async transition(businessCaseId, toState, userId, reason = '', metadata = {}) {
    // Validate inputs
    if (!businessCaseId || !toState || !userId) {
      throw new Error('businessCaseId, toState, and userId are required');
    }

    // Get current state
    const fromState = await this.getCurrentState(businessCaseId);

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

    // STATE READINESS VALIDATION: Check if business case meets requirements for transition
    // Get complete business case data for validation
    const { rows } = await db.query(`
      SELECT * FROM v_business_cases_complete WHERE business_case_id = $1
    `, [businessCaseId]);

    if (!rows.length) {
      throw new Error(`Business Case ${businessCaseId} not found`);
    }

    const businessCase = rows[0];

    // Validate state readiness requirements
    const readinessValidation = await BusinessCaseStateReadiness.validateStateReadiness(businessCase, toState);

    if (!readinessValidation.isReady) {
      const error = new Error(`State transition blocked: ${readinessValidation.summary}`);
      error.status = 400;
      error.code = 'STATE_READINESS_FAILED';
      error.details = {
        transitionName: readinessValidation.transitionName,
        description: readinessValidation.description,
        failedRequirements: readinessValidation.failedRequirements,
        blockingIssues: readinessValidation.failedRequirements.map(req => ({
          section: req.section,
          field: req.friendlyName,
          issue: req.errorMessage
        }))
      };
      throw error;
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Update canonical state
      const updateResult = await client.query(
        `UPDATE equipment_purchase_requests
         SET canonical_state = $1, updated_at = NOW()
         WHERE id = $2`,
        [toState, businessCaseId]
      );

      if (updateResult.rowCount !== 1) {
        throw new Error(`Failed to update state for business case ${businessCaseId}`);
      }

      // Log transition in audit table
      await client.query(
        `INSERT INTO business_case_state_transitions (
          business_case_id, from_state, to_state, transition_reason,
          transitioned_by, metadata, transitioned_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [businessCaseId, fromState, toState, reason, userId, JSON.stringify(metadata)]
      );

      await client.query('COMMIT');

      // NOTIFICACIONES: Enviar notificaciones después de transición exitosa
      setImmediate(async () => {
        try {
          const recipients = await this._getTransitionRecipients(businessCaseId, fromState, toState, businessCase);
          const notificationManager = require('../notifications/notificationManager');

          for (const recipient of recipients) {
            await notificationManager.sendNotification({
              userId: recipient.userId,
              template: 'bc_state_transition',
              data: {
                business_case_id: businessCaseId,
                client_name: businessCase.client_name || 'Cliente no especificado',
                from_state: this._getStateFriendlyName(fromState),
                to_state: this._getStateFriendlyName(toState),
                extra_info: recipient.extraInfo || '',
                transitioned_by: userId,
                reason: reason || 'Sin motivo especificado'
              },
              email: recipient.sendEmail,
              chat: recipient.sendChat,
              priority: this._getTransitionPriority(toState),
              source: 'business_case.state_transition',
              meta: {
                businessCaseId,
                fromState,
                toState,
                transitionedBy: userId
              }
            });
          }
        } catch (notificationError) {
          logger.warn({ notificationError, businessCaseId }, 'Error enviando notificaciones de transición BC');
          // No lanzamos error para no afectar la transición exitosa
        }
      });

      logger.info({
        businessCaseId,
        fromState,
        toState,
        userId,
        reason
      }, 'Business case state transition completed');

      return {
        success: true,
        businessCaseId,
        fromState,
        toState,
        transitionedAt: new Date(),
        transitionedBy: userId
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({
        businessCaseId,
        fromState,
        toState,
        userId,
        error: error.message
      }, 'Business case state transition failed');
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
    if (!Object.values(STATES).includes(currentState)) {
      throw new Error(`Invalid state: ${currentState}`);
    }
    return [...TRANSITIONS[currentState]];
  }

  /**
   * Validate that a state exists in the canonical state machine
   * @param {string} state - State to validate
   * @returns {boolean} True if state is valid
   */
  static isValidState(state) {
    return Object.values(STATES).includes(state);
  }

  /**
   * Get all canonical states
   * @returns {object} Object with all state constants
   */
  static getStates() {
    return { ...STATES };
  }

  /**
   * Check if a state is terminal (no outgoing transitions)
   * @param {string} state - State to check
   * @returns {boolean} True if terminal state
   */
  static isTerminalState(state) {
    return TRANSITIONS[state]?.length === 0;
  }

  /**
   * Get recipients for state transition notifications
   * @private
   */
  static async _getTransitionRecipients(businessCaseId, fromState, toState, businessCase) {
    const recipients = [];

    // Siempre notificar al creador
    if (businessCase.created_by) {
      recipients.push({
        userId: businessCase.created_by,
        sendEmail: true,
        sendChat: false,
        extraInfo: 'Como creador del Business Case'
      });
    }

    // Notificar según estado destino
    switch (toState) {
      case STATES.EN_EVALUACION_VIABILIDAD:
        // Notificar a equipo de viabilidad
        const viabilityTeam = await this._getUsersByRole('viabilidad');
        recipients.push(...viabilityTeam.map(u => ({
          userId: u.id,
          sendEmail: true,
          sendChat: true,
          extraInfo: 'Revisión de viabilidad requerida'
        })));
        break;

      case STATES.OBSERVADO_POR_VIABILIDAD:
        // Notificar al comercial (creador)
        // Ya incluido arriba
        break;

      case STATES.VIABLE:
        // Notificar a jefe comercial y operaciones
        const jefeComercial = await this._getUsersByRole('jefe_comercial');
        recipients.push(...jefeComercial.map(u => ({
          userId: u.id,
          sendEmail: true,
          sendChat: false,
          extraInfo: 'Business Case aprobado por viabilidad'
        })));
        break;

      case STATES.AJUSTES_OPERATIVOS:
        // Notificar a operaciones
        const operations = await this._getUsersByRole('operaciones');
        recipients.push(...operations.map(u => ({
          userId: u.id,
          sendEmail: true,
          sendChat: true,
          extraInfo: 'Planificación operativa requerida'
        })));
        break;

      case STATES.CERRADO_PARA_APROBACION:
        // Notificar a gerencia
        const management = await this._getUsersByRole('gerencia');
        recipients.push(...management.map(u => ({
          userId: u.id,
          sendEmail: true,
          sendChat: true,
          extraInfo: 'Aprobación final requerida'
        })));
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
      [STATES.DRAFT_INICIAL]: 'Borrador Inicial',
      [STATES.DATOS_BASE_COMPLETOS]: 'Datos Base Completos',
      [STATES.EN_EVALUACION_VIABILIDAD]: 'En Evaluación de Viabilidad',
      [STATES.OBSERVADO_POR_VIABILIDAD]: 'Observado por Viabilidad',
      [STATES.VIABLE]: 'Viable',
      [STATES.AJUSTES_OPERATIVOS]: 'Ajustes Operativos',
      [STATES.CERRADO_PARA_APROBACION]: 'Cerrado para Aprobación'
    };
    return names[state] || state;
  }

  /**
   * Get priority for transition notifications
   * @private
   */
  static _getTransitionPriority(toState) {
    // Prioridad alta para estados críticos
    if ([STATES.OBSERVADO_POR_VIABILIDAD, STATES.CERRADO_PARA_APROBACION].includes(toState)) {
      return 3;
    }
    return 2;
  }
}

module.exports = {
  BusinessCaseStateMachine,
  STATES
};
