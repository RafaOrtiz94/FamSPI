const db = require("../../config/db");
const logger = require("../../config/logger");
const businessCaseCalculator = require("./businessCaseCalculator.service");
const { assertModernBusinessCase, recalculateBusinessCase } = require("./businessCase.service");

async function getPrimaryEquipmentId(businessCaseId) {
  const { rows } = await db.query(
    `SELECT equipment_id FROM bc_equipment_selection WHERE business_case_id = $1 AND is_primary = true`,
    [businessCaseId],
  );
  return rows[0]?.equipment_id || null;
}

function normalizeQuantities(monthlyQty, annualQty) {
  const parsedMonthly = Number.isFinite(Number(monthlyQty)) ? Number(monthlyQty) : null;
  const parsedAnnual = Number.isFinite(Number(annualQty)) ? Number(annualQty) : null;
  const monthly = parsedMonthly ?? (parsedAnnual ? Math.ceil(parsedAnnual / 12) : 0);
  const annual = parsedAnnual ?? (parsedMonthly ? parsedMonthly * 12 : 0);
  return { monthly, annual };
}

async function addDetermination(businessCaseId, determinationId, { monthlyQty, annualQty }, user) {
  await assertModernBusinessCase(businessCaseId);
  const equipmentId = await getPrimaryEquipmentId(businessCaseId);

  if (!equipmentId) {
    const error = new Error("Debe seleccionar un equipo antes de agregar determinaciones");
    error.status = 400;
    throw error;
  }

  const { monthly, annual } = normalizeQuantities(monthlyQty, annualQty);

  const consumption = await businessCaseCalculator.calculateDeterminationConsumption({
    determinationId,
    equipmentId,
    monthlyQuantity: monthly,
  });

  const cost = await businessCaseCalculator.calculateDeterminationCost({
    determinationId,
    equipmentId,
    monthlyQuantity: monthly,
  });

  const insertQuery = `
    INSERT INTO bc_determinations (
      business_case_id, determination_id, monthly_quantity, annual_quantity, calculated_consumption, calculated_cost, calculation_details, added_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (business_case_id, determination_id) DO UPDATE
    SET monthly_quantity = EXCLUDED.monthly_quantity,
        annual_quantity = EXCLUDED.annual_quantity,
        calculated_consumption = EXCLUDED.calculated_consumption,
        calculated_cost = EXCLUDED.calculated_cost,
        calculation_details = EXCLUDED.calculation_details,
        updated_at = now()
    RETURNING *;
  `;

  const { rows } = await db.query(insertQuery, [
    businessCaseId,
    determinationId,
    monthly,
    annual,
    consumption.value,
    cost.value,
    JSON.stringify({ consumption, cost }),
    user?.id || null,
  ]);

  try {
    await recalculateBusinessCase(businessCaseId);
  } catch (error) {
    logger.warn({ businessCaseId, error: error.message }, "No se pudo recalcular BC tras agregar determinación");
  }

  return rows[0];
}

async function updateDeterminationQuantity(businessCaseId, determinationId, { monthlyQty, annualQty }) {
  await assertModernBusinessCase(businessCaseId);
  const equipmentId = await getPrimaryEquipmentId(businessCaseId);

  if (!equipmentId) {
    const error = new Error("Debe seleccionar un equipo antes de actualizar determinaciones");
    error.status = 400;
    throw error;
  }

  const { monthly, annual } = normalizeQuantities(monthlyQty, annualQty);

  const consumption = await businessCaseCalculator.calculateDeterminationConsumption({
    determinationId,
    equipmentId,
    monthlyQuantity: monthly,
  });

  const cost = await businessCaseCalculator.calculateDeterminationCost({
    determinationId,
    equipmentId,
    monthlyQuantity: monthly,
  });

  const { rows } = await db.query(
    `UPDATE bc_determinations
     SET monthly_quantity = $1,
         annual_quantity = $2,
         calculated_consumption = $3,
         calculated_cost = $4,
         calculation_details = $5,
         updated_at = now()
     WHERE business_case_id = $6 AND determination_id = $7
     RETURNING *`,
    [
      monthly,
      annual,
      consumption.value,
      cost.value,
      JSON.stringify({ consumption, cost }),
      businessCaseId,
      determinationId,
    ],
  );

  try {
    await recalculateBusinessCase(businessCaseId);
  } catch (error) {
    logger.warn({ businessCaseId, error: error.message }, "No se pudo recalcular BC tras actualizar determinación");
  }

  return rows[0] || null;
}

async function removeDetermination(businessCaseId, determinationId) {
  await assertModernBusinessCase(businessCaseId);
  const { rowCount } = await db.query(
    `DELETE FROM bc_determinations WHERE business_case_id = $1 AND determination_id = $2`,
    [businessCaseId, determinationId],
  );

  if (rowCount) {
    try {
      await recalculateBusinessCase(businessCaseId);
    } catch (error) {
      logger.warn({ businessCaseId, error: error.message }, "No se pudo recalcular BC tras eliminar determinación");
    }
  }

  return rowCount > 0;
}

async function getDeterminations(businessCaseId) {
  await assertModernBusinessCase(businessCaseId);
  const { rows } = await db.query(
    `SELECT bd.*, cd.name, cd.category, cd.roche_code
     FROM bc_determinations bd
     JOIN catalog_determinations cd ON cd.id = bd.determination_id
     WHERE bd.business_case_id = $1
     ORDER BY cd.name`,
    [businessCaseId],
  );
  return rows;
}

module.exports = {
  addDetermination,
  updateDeterminationQuantity,
  removeDetermination,
  getDeterminations,
};
