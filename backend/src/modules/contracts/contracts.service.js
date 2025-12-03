const db = require('../../config/db');
const logger = require('../../config/logger');
const alertsService = require('../alerts/alerts.service');

exports.activateBusinessCase = async (businessCaseId, determinations) => {
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        // Verificar que el BC existe
        const bcResult = await client.query(
            'SELECT id, client_id, client_name FROM equipment_purchase_requests WHERE id = $1',
            [businessCaseId]
        );

        if (bcResult.rows.length === 0) {
            throw new Error('Business Case no encontrado');
        }

        const bc = bcResult.rows[0];
        const inventory = [];

        // Crear registro de inventario por cada determinación
        for (const det of determinations) {
            const { rows } = await client.query(
                `INSERT INTO contract_determinations 
         (business_case_id, client_id, determination_id, annual_negotiated_quantity, remaining_quantity, consumed_quantity)
         VALUES ($1, $2, $3, $4, $4, 0)
         RETURNING *`,
                [businessCaseId, bc.client_id, det.determination_id, det.annual_volume]
            );

            inventory.push(rows[0]);
        }

        await client.query('COMMIT');
        logger.info('Business Case %s activated with %d determinations', businessCaseId, determinations.length);

        return inventory;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

exports.registerConsumption = async ({ contractDeterminationId, quantity, userId, source = 'manual', notes = null }) => {
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        // Obtener contrato actual
        const contractResult = await client.query(
            'SELECT * FROM contract_determinations WHERE id = $1',
            [contractDeterminationId]
        );

        if (contractResult.rows.length === 0) {
            throw new Error('Contrato de determinación no encontrado');
        }

        const contract = contractResult.rows[0];

        // Actualizar inventario
        const newConsumed = parseInt(contract.consumed_quantity) + parseInt(quantity);
        const newRemaining = parseInt(contract.annual_negotiated_quantity) - newConsumed;

        await client.query(
            `UPDATE contract_determinations 
       SET consumed_quantity = $1, remaining_quantity = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
            [newConsumed, newRemaining, contractDeterminationId]
        );

        // Registrar en log
        await client.query(
            `INSERT INTO determination_consumption_log 
       (contract_determination_id, consumed_quantity, consumption_date, consumed_by_user_id, source, notes)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)`,
            [contractDeterminationId, quantity, userId, source, notes]
        );

        await client.query('COMMIT');

        // Verificar si se deben crear alertas
        await alertsService.checkInventoryAlerts(contractDeterminationId);

        logger.info('Consumption registered for contract %s: %d units', contractDeterminationId, quantity);

        return {
            consumed: newConsumed,
            remaining: newRemaining,
            percentage_remaining: ((newRemaining / contract.annual_negotiated_quantity) * 100).toFixed(2)
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

exports.getInventoryByBusinessCase = async (businessCaseId) => {
    const { rows } = await db.query(
        'SELECT * FROM v_client_inventory WHERE business_case_id = $1',
        [businessCaseId]
    );
    return rows;
};

exports.getInventoryByClient = async (clientId) => {
    const { rows } = await db.query(
        `SELECT * FROM v_client_inventory 
     WHERE business_case_id IN (
       SELECT id FROM equipment_purchase_requests WHERE client_id = $1
     )`,
        [clientId]
    );
    return rows;
};

exports.updateAlertThresholds = async (contractDeterminationId, thresholds) => {
    const { alert_threshold_yellow, alert_threshold_red } = thresholds;

    const { rows } = await db.query(
        `UPDATE contract_determinations 
     SET alert_threshold_yellow = $1, alert_threshold_red = $2, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $3 
     RETURNING *`,
        [alert_threshold_yellow, alert_threshold_red, contractDeterminationId]
    );

    if (rows.length === 0) {
        throw new Error('Contrato de determinación no encontrado');
    }

    logger.info('Alert thresholds updated for contract %s', contractDeterminationId);
    return rows[0];
};
