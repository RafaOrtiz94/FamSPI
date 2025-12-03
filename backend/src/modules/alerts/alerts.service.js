const db = require('../../config/db');
const logger = require('../../config/logger');

exports.checkInventoryAlerts = async (contractDeterminationId) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM contract_determinations WHERE id = $1',
            [contractDeterminationId]
        );

        if (rows.length === 0) return;

        const contract = rows[0];
        const percentageRemaining = (contract.remaining_quantity / contract.annual_negotiated_quantity) * 100;

        // Alerta amarilla (30%)
        if (percentageRemaining <= contract.alert_threshold_yellow && percentageRemaining > contract.alert_threshold_red) {
            await db.query(
                `INSERT INTO bc_alerts (business_case_id, contract_determination_id, alert_type, severity, message)
         VALUES ($1, $2, 'low_inventory', 'yellow', $3)
         ON CONFLICT DO NOTHING`,
                [
                    contract.business_case_id,
                    contractDeterminationId,
                    `Inventario bajo: ${percentageRemaining.toFixed(1)}% restante (${contract.remaining_quantity} de ${contract.annual_negotiated_quantity})`
                ]
            );

            logger.warn('Yellow alert created for contract %s', contractDeterminationId);
        }

        // Alerta roja (10%)
        if (percentageRemaining <= contract.alert_threshold_red) {
            await db.query(
                `INSERT INTO bc_alerts (business_case_id, contract_determination_id, alert_type, severity, message)
         VALUES ($1, $2, 'low_inventory', 'red', $3)
         ON CONFLICT DO NOTHING`,
                [
                    contract.business_case_id,
                    contractDeterminationId,
                    `CRÍTICO: Determinación casi agotada. Solo ${contract.remaining_quantity} determinaciones restantes (${percentageRemaining.toFixed(1)}%)`
                ]
            );

            logger.error('Red alert created for contract %s', contractDeterminationId);
        }
    } catch (error) {
        logger.error('Error checking inventory alerts: %s', error.message);
    }
};

exports.detectUnusualConsumption = async (contractDeterminationId) => {
    try {
        // Obtener consumo de últimos 3 meses
        const { rows } = await db.query(
            `SELECT 
         DATE_TRUNC('month', consumption_date) as month,
         SUM(consumed_quantity) as total
       FROM determination_consumption_log
       WHERE contract_determination_id = $1
         AND consumption_date >= CURRENT_DATE - INTERVAL '3 months'
       GROUP BY DATE_TRUNC('month', consumption_date)
       ORDER BY month DESC`,
            [contractDeterminationId]
        );

        if (rows.length < 2) return false; // Necesitamos al menos 2 meses para comparar

        const consumptions = rows.map(r => parseInt(r.total));
        const lastMonth = consumptions[0];
        const avgMonthly = consumptions.slice(1).reduce((acc, val) => acc + val, 0) / (consumptions.length - 1);

        // Si el último mes supera el promedio en más del 50%
        if (lastMonth > avgMonthly * 1.5) {
            const contractResult = await db.query(
                'SELECT business_case_id FROM contract_determinations WHERE id = $1',
                [contractDeterminationId]
            );

            if (contractResult.rows.length > 0) {
                await db.query(
                    `INSERT INTO bc_alerts (business_case_id, contract_determination_id, alert_type, severity, message)
           VALUES ($1, $2, 'unusual_consumption', 'yellow', $3)`,
                    [
                        contractResult.rows[0].business_case_id,
                        contractDeterminationId,
                        `Consumo inusual detectado. Promedio mensual: ${Math.round(avgMonthly)}, Último mes: ${lastMonth} (+${((lastMonth - avgMonthly) / avgMonthly * 100).toFixed(0)}%)`
                    ]
                );

                logger.warn('Unusual consumption alert created for contract %s', contractDeterminationId);
                return true;
            }
        }

        return false;
    } catch (error) {
        logger.error('Error detecting unusual consumption: %s', error.message);
        return false;
    }
};

exports.detectUnusualConsumptionForAll = async () => {
    const { rows } = await db.query(
        'SELECT id FROM contract_determinations WHERE status = $1',
        ['active']
    );

    const results = [];

    for (const row of rows) {
        const detected = await exports.detectUnusualConsumption(row.id);
        if (detected) {
            results.push({ contractDeterminationId: row.id, alertCreated: true });
        }
    }

    return results;
};

exports.getAlertsByBusinessCase = async (businessCaseId) => {
    const { rows } = await db.query(
        `SELECT a.*, 
            cd.id as contract_id,
            d.name as determination_name
     FROM bc_alerts a
     LEFT JOIN contract_determinations cd ON a.contract_determination_id = cd.id
     LEFT JOIN catalog_determinations d ON cd.determination_id = d.id
     WHERE a.business_case_id = $1
     ORDER BY a.created_at DESC`,
        [businessCaseId]
    );
    return rows;
};

exports.getActiveAlerts = async () => {
    const { rows } = await db.query(
        `SELECT a.*,
            ep.client_name,
            cd.id as contract_id,
            d.name as determination_name
     FROM bc_alerts a
     JOIN equipment_purchase_requests ep ON a.business_case_id = ep.id
     LEFT JOIN contract_determinations cd ON a.contract_determination_id = cd.id
     LEFT JOIN catalog_determinations d ON cd.determination_id = d.id
     WHERE a.acknowledged = false
     ORDER BY 
       CASE a.severity 
         WHEN 'critical' THEN 1
         WHEN 'red' THEN 2
         WHEN 'yellow' THEN 3
         ELSE 4
       END,
       a.created_at DESC`
    );
    return rows;
};

exports.acknowledgeAlert = async (alertId, userId) => {
    const { rows } = await db.query(
        `UPDATE bc_alerts 
     SET acknowledged = true, acknowledged_at = CURRENT_TIMESTAMP, acknowledged_by_user_id = $1 
     WHERE id = $2 
     RETURNING *`,
        [userId, alertId]
    );

    if (rows.length === 0) {
        throw new Error('Alerta no encontrada');
    }

    logger.info('Alert %s acknowledged by user %s', alertId, userId);
    return rows[0];
};
