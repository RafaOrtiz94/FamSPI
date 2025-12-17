const db = require('../../config/db');
const logger = require('../../config/logger');

/**
 * BC Requirements Service
 * Manages Business Case requirements and deadlines
 */

async function createRequirements(businessCaseId, data) {
    const { deadline_months, projected_deadline_months } = data;

    const query = `
    INSERT INTO bc_requirements (
      business_case_id,
      deadline_months,
      projected_deadline_months
    ) VALUES ($1, $2, $3)
    ON CONFLICT (business_case_id)
    DO UPDATE SET
      deadline_months = EXCLUDED.deadline_months,
      projected_deadline_months = EXCLUDED.projected_deadline_months,
      updated_at = now()
    RETURNING *;
  `;

    const { rows } = await db.query(query, [
        businessCaseId,
        deadline_months,
        projected_deadline_months
    ]);

    return rows[0];
}

async function getRequirements(businessCaseId) {
    const { rows } = await db.query(
        'SELECT * FROM bc_requirements WHERE business_case_id = $1',
        [businessCaseId]
    );
    return rows[0] || null;
}

async function updateRequirements(businessCaseId, data) {
    return createRequirements(businessCaseId, data); // Uses UPSERT
}

async function deleteRequirements(businessCaseId) {
    const { rowCount } = await db.query(
        'DELETE FROM bc_requirements WHERE business_case_id = $1',
        [businessCaseId]
    );
    return rowCount > 0;
}

module.exports = {
    createRequirements,
    getRequirements,
    updateRequirements,
    deleteRequirements
};
