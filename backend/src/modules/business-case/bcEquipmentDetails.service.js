const db = require('../../config/db');
const logger = require('../../config/logger');

/**
 * Equipment Details Service
 * Manages detailed equipment information for Business Cases
 */

async function createEquipmentDetails(businessCaseId, data) {
    const {
        equipment_status,
        ownership_status,
        reservation_image_url,
        backup_equipment_name,
        backup_status,
        backup_manufacture_year,
        install_with_primary,
        installation_location,
        allows_provisional,
        requires_complementary,
        complementary_test_purpose
    } = data;

    const query = `
    INSERT INTO bc_equipment_details (
      business_case_id,
      equipment_status,
      ownership_status,
      reservation_image_url,
      backup_equipment_name,
      backup_status,
      backup_manufacture_year,
      install_with_primary,
      installation_location,
      allows_provisional,
      requires_complementary,
      complementary_test_purpose
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (business_case_id)
    DO UPDATE SET
      equipment_status = EXCLUDED.equipment_status,
      ownership_status = EXCLUDED.ownership_status,
      reservation_image_url = EXCLUDED.reservation_image_url,
      backup_equipment_name = EXCLUDED.backup_equipment_name,
      backup_status = EXCLUDED.backup_status,
      backup_manufacture_year = EXCLUDED.backup_manufacture_year,
      install_with_primary = EXCLUDED.install_with_primary,
      installation_location = EXCLUDED.installation_location,
      allows_provisional = EXCLUDED.allows_provisional,
      requires_complementary = EXCLUDED.requires_complementary,
      complementary_test_purpose = EXCLUDED.complementary_test_purpose,
      updated_at = now()
    RETURNING *;
  `;

    const { rows } = await db.query(query, [
        businessCaseId,
        equipment_status,
        ownership_status,
        reservation_image_url,
        backup_equipment_name,
        backup_status,
        backup_manufacture_year,
        install_with_primary,
        installation_location,
        allows_provisional,
        requires_complementary,
        complementary_test_purpose
    ]);

    return rows[0];
}

async function getEquipmentDetails(businessCaseId) {
    const { rows } = await db.query(
        'SELECT * FROM bc_equipment_details WHERE business_case_id = $1',
        [businessCaseId]
    );
    return rows[0] || null;
}

async function updateEquipmentDetails(businessCaseId, data) {
    return createEquipmentDetails(businessCaseId, data); // Uses UPSERT
}

async function deleteEquipmentDetails(businessCaseId) {
    const { rowCount } = await db.query(
        'DELETE FROM bc_equipment_details WHERE business_case_id = $1',
        [businessCaseId]
    );
    return rowCount > 0;
}

module.exports = {
    createEquipmentDetails,
    getEquipmentDetails,
    updateEquipmentDetails,
    deleteEquipmentDetails
};
