const db = require("../../config/db");
const logger = require("../../config/logger");
const { assertModernBusinessCase, recalculateBusinessCase } = require("./businessCase.service");

async function getCurrentSelection(businessCaseId) {
  const { rows } = await db.query(
    `SELECT * FROM bc_equipment_selection WHERE business_case_id = $1 AND is_primary = true`,
    [businessCaseId],
  );
  return rows[0] || null;
}

async function selectEquipment(businessCaseId, equipmentId, isPrimary = true, user) {
  await assertModernBusinessCase(businessCaseId);

  const previous = await getCurrentSelection(businessCaseId);
  const changed = previous && previous.equipment_id !== Number(equipmentId);

  const query = `
    INSERT INTO bc_equipment_selection (business_case_id, equipment_id, is_primary, selected_by)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (business_case_id, is_primary) DO UPDATE
    SET equipment_id = EXCLUDED.equipment_id,
        selected_by = EXCLUDED.selected_by,
        selected_at = now()
    RETURNING *;
  `;

  const { rows } = await db.query(query, [businessCaseId, equipmentId, isPrimary, user?.id || null]);

  if (changed) {
    await db.query(`DELETE FROM bc_determinations WHERE business_case_id = $1`, [businessCaseId]);
    logger.info({ businessCaseId, equipmentId }, "Determinaciones limpiadas por cambio de equipo");
  }

  try {
    await recalculateBusinessCase(businessCaseId);
  } catch (error) {
    logger.warn({ businessCaseId, error: error.message }, "No se pudo recalcular tras selección de equipo");
  }

  return rows[0];
}

async function getSelectedEquipment(businessCaseId) {
  await assertModernBusinessCase(businessCaseId);
  const query = `
    SELECT bes.*, eq.nombre AS equipment_name, eq.code AS equipment_code, eq.fabricante AS manufacturer,
           eq.modelo AS model, eq.capacity_per_hour, eq.max_daily_capacity, eq.base_price
    FROM bc_equipment_selection bes
    JOIN servicio.equipos eq ON eq.id_equipo = bes.equipment_id
    WHERE bes.business_case_id = $1 AND bes.is_primary = true;
  `;

  const { rows } = await db.query(query, [businessCaseId]);
  return rows[0] || null;
}

module.exports = {
  selectEquipment,
  getSelectedEquipment,
};
