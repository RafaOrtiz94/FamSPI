const db = require('../../config/db');
const logger = require('../../config/logger');

/**
 * LIS Integration Service
 * Manages LIS (Laboratory Information System) integration data
 */

async function createLisIntegration(businessCaseId, data) {
    const {
        includes_lis,
        lis_provider,
        includes_hardware,
        monthly_patients,
        current_system_name,
        current_system_provider,
        current_system_hardware
    } = data;

    const query = `
    INSERT INTO bc_lis_integration (
      business_case_id,
      includes_lis,
      lis_provider,
      includes_hardware,
      monthly_patients,
      current_system_name,
      current_system_provider,
      current_system_hardware
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (business_case_id)
    DO UPDATE SET
      includes_lis = EXCLUDED.includes_lis,
      lis_provider = EXCLUDED.lis_provider,
      includes_hardware = EXCLUDED.includes_hardware,
      monthly_patients = EXCLUDED.monthly_patients,
      current_system_name = EXCLUDED.current_system_name,
      current_system_provider = EXCLUDED.current_system_provider,
      current_system_hardware = EXCLUDED.current_system_hardware,
      updated_at = now()
    RETURNING *;
  `;

    const { rows } = await db.query(query, [
        businessCaseId,
        includes_lis,
        lis_provider,
        includes_hardware,
        monthly_patients,
        current_system_name,
        current_system_provider,
        current_system_hardware
    ]);

    return rows[0];
}

async function getLisIntegration(businessCaseId) {
    const { rows } = await db.query(
        'SELECT * FROM bc_lis_integration WHERE business_case_id = $1',
        [businessCaseId]
    );
    return rows[0] || null;
}

async function updateLisIntegration(businessCaseId, data) {
    return createLisIntegration(businessCaseId, data); // Uses UPSERT
}

async function deleteLisIntegration(businessCaseId) {
    const { rowCount } = await db.query(
        'DELETE FROM bc_lis_integration WHERE business_case_id = $1',
        [businessCaseId]
    );
    return rowCount > 0;
}

// Equipment Interfaces
async function addEquipmentInterface(lisIntegrationId, data) {
    const { model, provider } = data;

    const { rows } = await db.query(
        `INSERT INTO bc_lis_equipment_interfaces (lis_integration_id, model, provider)
     VALUES ($1, $2, $3) RETURNING *`,
        [lisIntegrationId, model, provider]
    );

    return rows[0];
}

async function getEquipmentInterfaces(lisIntegrationId) {
    const { rows } = await db.query(
        'SELECT * FROM bc_lis_equipment_interfaces WHERE lis_integration_id = $1 ORDER BY created_at',
        [lisIntegrationId]
    );
    return rows;
}

async function deleteEquipmentInterface(interfaceId) {
    const { rowCount } = await db.query(
        'DELETE FROM bc_lis_equipment_interfaces WHERE id = $1',
        [interfaceId]
    );
    return rowCount > 0;
}

module.exports = {
    createLisIntegration,
    getLisIntegration,
    updateLisIntegration,
    deleteLisIntegration,
    addEquipmentInterface,
    getEquipmentInterfaces,
    deleteEquipmentInterface
};
