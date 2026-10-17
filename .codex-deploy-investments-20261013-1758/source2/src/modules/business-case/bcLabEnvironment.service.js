const db = require('../../config/db');
const logger = require('../../config/logger');

/**
 * Lab Environment Service
 * Manages laboratory environment data for Business Cases
 */

async function createLabEnvironment(businessCaseId, data) {
    const {
        work_days_per_week,
        shifts_per_day,
        hours_per_shift,
        quality_controls_per_shift,
        control_levels,
        routine_qc_frequency,
        special_tests,
        special_qc_frequency
    } = data;

    const query = `
    INSERT INTO bc_lab_environment (
      business_case_id,
      work_days_per_week,
      shifts_per_day,
      hours_per_shift,
      quality_controls_per_shift,
      control_levels,
      routine_qc_frequency,
      special_tests,
      special_qc_frequency
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (business_case_id) 
    DO UPDATE SET
      work_days_per_week = EXCLUDED.work_days_per_week,
      shifts_per_day = EXCLUDED.shifts_per_day,
      hours_per_shift = EXCLUDED.hours_per_shift,
      quality_controls_per_shift = EXCLUDED.quality_controls_per_shift,
      control_levels = EXCLUDED.control_levels,
      routine_qc_frequency = EXCLUDED.routine_qc_frequency,
      special_tests = EXCLUDED.special_tests,
      special_qc_frequency = EXCLUDED.special_qc_frequency,
      updated_at = now()
    RETURNING *;
  `;

    const { rows } = await db.query(query, [
        businessCaseId,
        work_days_per_week,
        shifts_per_day,
        hours_per_shift,
        quality_controls_per_shift,
        control_levels,
        routine_qc_frequency,
        special_tests,
        special_qc_frequency
    ]);

    return rows[0];
}

async function getLabEnvironment(businessCaseId) {
    const { rows } = await db.query(
        'SELECT * FROM bc_lab_environment WHERE business_case_id = $1',
        [businessCaseId]
    );
    return rows[0] || null;
}

async function updateLabEnvironment(businessCaseId, data) {
    return createLabEnvironment(businessCaseId, data); // Uses UPSERT
}

async function deleteLabEnvironment(businessCaseId) {
    const { rowCount } = await db.query(
        'DELETE FROM bc_lab_environment WHERE business_case_id = $1',
        [businessCaseId]
    );
    return rowCount > 0;
}

module.exports = {
    createLabEnvironment,
    getLabEnvironment,
    updateLabEnvironment,
    deleteLabEnvironment
};
