/**
 * Unified Purchase State Machine
 *
 * State management para el flujo unificado de compras (public + private).
 * Combina los flujos de equipment-purchases y private-purchases.
 * Enforces canonical state transitions y mantiene auditoría.
 *
 * Soporte para flujos: "Compra pública", "Venta Directa", "Alquiler" y "Comodato".
 */

const db = require("../../config/db");
const logger = require("../../config/logger");
const { UNIFIED_PURCHASE_STATES, UNIFIED_PURCHASE_TRANSITIONS, FLOW_TYPES } = require('./unifiedPurchaseStates.constants');

class UnifiedPurchaseStateMachine {
    static async _ensureTransitionTable() {
        if (this._transitionTableReady) return;
        await db.query(`
            CREATE TABLE IF NOT EXISTS equipment_purchase_state_transitions (
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
     * Get current canonical state para una compra unificada
     * @param {string} purchaseId - UUID de la solicitud de compra
     * @returns {string} Current canonical state
     */
    static async getCurrentState(purchaseId) {
        const { rows } = await db.query(
            `SELECT status_unified, status FROM equipment_purchase_requests WHERE id = $1`,
            [purchaseId]
        );

        if (!rows.length) {
            throw new Error(`Equipment Purchase ${purchaseId} not found`);
        }

        const currentState = rows[0].status_unified || rows[0].status;
        if (!currentState) {
            throw new Error(`Equipment Purchase ${purchaseId} has no status set`);
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
        if (!Object.values(UNIFIED_PURCHASE_STATES).includes(fromState)) {
            throw new Error(`Invalid fromState: ${fromState}`);
        }
        if (!Object.values(UNIFIED_PURCHASE_STATES).includes(toState)) {
            throw new Error(`Invalid toState: ${toState}`);
        }

        // Check transition rules
        return UNIFIED_PURCHASE_TRANSITIONS[fromState]?.includes(toState) || false;
    }

    /**
     * Execute a validated state transition
     * @param {string} purchaseId - UUID de la solicitud de compra
     * @param {string} toState - Target canonical state
     * @param {string} userId - ID del usuario que realiza la transición
     * @param {string} reason - Motivo de la transición (opcional)
     * @param {object} metadata - Metadata adicional (opcional)
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

        // Rechazo con motivo obligatorio para contract_rejected
        if (toState === UNIFIED_PURCHASE_STATES.CONTRACT_REJECTED) {
            logger.debug(`[UNIFIED_PURCHASE][BE][REJECT][START] Validando motivo para rejection de purchase ${purchaseId}`);

            if (!reason || reason.trim().length === 0) {
                logger.debug(`[UNIFIED_PURCHASE][BE][REJECT][BLOCKED_NO_REASON] Motivo faltante para purchase ${purchaseId}`);
                const error = new Error('Motivo de rechazo es obligatorio');
                error.status = 400;
                error.code = 'REJECTION_REASON_REQUIRED';
                error.details = { field: 'reason' };
                throw error;
            }

            logger.debug(`[UNIFIED_PURCHASE][BE][REJECT][OK] Motivo válido para purchase ${purchaseId}`);
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
                `UPDATE equipment_purchase_requests
         SET status_unified = $1, updated_at = NOW()
         WHERE id = $2`,
                [toState, purchaseId]
            );

            if (updateResult.rowCount !== 1) {
                throw new Error(`Failed to update status for equipment purchase ${purchaseId}`);
            }

            logger.debug('[UNIFIED_PURCHASE][BE][STATE][TRANSITION]', {
                requestId: purchaseId,
                fromState,
                toState
            });

            // Log transition in audit table
            await client.query(
                `INSERT INTO equipment_purchase_state_transitions (
          purchase_id, from_state, to_state, transition_reason,
          transitioned_by, metadata, transitioned_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT DO NOTHING`,
                [purchaseId, fromState, toState, reason, userId, JSON.stringify(metadata)]
            ).catch(err => {
                logger.warn({ err, purchaseId }, 'Could not log state transition');
            });

            await client.query('COMMIT');

            logger.info({
                purchaseId,
                fromState,
                toState,
                userId,
                reason
            }, 'Unified purchase state transition completed');

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
            }, 'Unified purchase state transition failed');
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
        if (!Object.values(UNIFIED_PURCHASE_STATES).includes(currentState)) {
            throw new Error(`Invalid state: ${currentState}`);
        }
        return [...(UNIFIED_PURCHASE_TRANSITIONS[currentState] || [])];
    }

    /**
     * Validate that a state exists in the canonical state machine
     * @param {string} state - State to validate
     * @returns {boolean} True if state is valid
     */
    static isValidState(state) {
        return Object.values(UNIFIED_PURCHASE_STATES).includes(state);
    }

    /**
     * Get all canonical states
     * @returns {object} Object with all state constants
     */
    static getStates() {
        return { ...UNIFIED_PURCHASE_STATES };
    }

    /**
     * Check if a state is terminal (no outgoing transitions)
     * @param {string} state - State to check
     * @returns {boolean} True if terminal state
     */
    static isTerminalState(state) {
        return (UNIFIED_PURCHASE_TRANSITIONS[state]?.length === 0);
    }
}

UnifiedPurchaseStateMachine._transitionTableReady = false;

module.exports = {
    UnifiedPurchaseStateMachine,
    UNIFIED_PURCHASE_STATES,
    UNIFIED_PURCHASE_TRANSITIONS,
    FLOW_TYPES
};
