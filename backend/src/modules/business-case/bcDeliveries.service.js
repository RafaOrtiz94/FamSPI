const db = require('../../config/db');
const logger = require('../../config/logger');

/**
 * BC Deliveries Service
 * Manages Business Case delivery information
 */

async function createDeliveries(businessCaseId, data) {
    const { delivery_type, effective_determination } = data;
    // Solo cuenta con entrega parcial por tiempo; en otro tipo se limpia.
    const partialCount = Number.parseInt(data.partial_deliveries, 10);
    const partial_deliveries = delivery_type === 'partial_time' && partialCount >= 1 ? partialCount : null;

    const query = `
    INSERT INTO bc_deliveries (
      business_case_id,
      delivery_type,
      effective_determination,
      partial_deliveries
    ) VALUES ($1, $2, $3, $4)
    ON CONFLICT (business_case_id)
    DO UPDATE SET
      delivery_type = EXCLUDED.delivery_type,
      effective_determination = EXCLUDED.effective_determination,
      partial_deliveries = EXCLUDED.partial_deliveries,
      updated_at = now()
    RETURNING *;
  `;

    const { rows } = await db.query(query, [
        businessCaseId,
        delivery_type,
        effective_determination,
        partial_deliveries
    ]);

    return rows[0];
}

async function getDeliveries(businessCaseId) {
    const { rows } = await db.query(
        'SELECT * FROM bc_deliveries WHERE business_case_id = $1',
        [businessCaseId]
    );
    return rows[0] || null;
}

async function updateDeliveries(businessCaseId, data) {
    return createDeliveries(businessCaseId, data); // Uses UPSERT
}

async function deleteDeliveries(businessCaseId) {
    const { rowCount } = await db.query(
        'DELETE FROM bc_deliveries WHERE business_case_id = $1',
        [businessCaseId]
    );
    return rowCount > 0;
}

module.exports = {
    createDeliveries,
    getDeliveries,
    updateDeliveries,
    deleteDeliveries
};
