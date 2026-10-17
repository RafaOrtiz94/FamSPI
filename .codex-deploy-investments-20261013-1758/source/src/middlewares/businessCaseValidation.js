const db = require("../config/db");
const businessCaseCalculator = require("../modules/business-case/businessCaseCalculator.service");

async function getPrimaryEquipmentId(businessCaseId) {
  const { rows } = await db.query(
    `SELECT equipment_id FROM bc_equipment_selection WHERE business_case_id = $1 AND is_primary = true`,
    [businessCaseId],
  );

  return rows[0]?.equipment_id || null;
}

async function validateDeterminationEquipment(req, res, next) {
  try {
    const businessCaseId = req.params.id;
    const determinationId = req.params.detId || req.body.determinationId;

    if (!businessCaseId || !determinationId) return next();

    const equipmentId = await getPrimaryEquipmentId(businessCaseId);
    if (!equipmentId) {
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar un equipo principal antes de gestionar determinaciones",
      });
    }

    const { rows } = await db.query(`SELECT id, equipment_id FROM catalog_determinations WHERE id = $1`, [determinationId]);
    if (!rows.length) return res.status(404).json({ ok: false, message: "Determinación no encontrada" });

    if (rows[0].equipment_id && Number(rows[0].equipment_id) !== Number(equipmentId)) {
      return res.status(400).json({
        ok: false,
        message: "La determinación seleccionada no pertenece al equipo configurado en el Business Case",
      });
    }

    res.locals.equipmentId = equipmentId;
    res.locals.determination = rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

async function validateEquipmentCapacity(req, res, next) {
  try {
    const businessCaseId = req.params.id;
    const monthlyQty = req.body.monthlyQty;

    if (!businessCaseId || !monthlyQty) return next();

    const equipmentId = res.locals.equipmentId || (await getPrimaryEquipmentId(businessCaseId));
    if (!equipmentId) return next();

    const params = [businessCaseId];
    let sumQuery = `SELECT COALESCE(SUM(monthly_quantity),0) AS total FROM bc_determinations WHERE business_case_id = $1`;

    if (req.params.detId) {
      params.push(req.params.detId);
      sumQuery += ` AND determination_id <> $2`;
    }

    const { rows } = await db.query(sumQuery, params);
    const currentTotal = Number(rows[0]?.total || 0);
    const projectedTotal = currentTotal + Number(monthlyQty);

    const utilization = await businessCaseCalculator.calculateEquipmentUtilization({
      equipmentId,
      totalMonthlyTests: projectedTotal,
    });

    if (utilization.capacity_exceeded) {
      return res.status(400).json({
        ok: false,
        message: "Capacidad del equipo excedida (>100%). Ajusta las cantidades o selecciona otro equipo.",
        details: utilization,
      });
    }

    if (utilization.utilization_percentage > 90) {
      res.locals.warnings = res.locals.warnings || [];
      res.locals.warnings.push({
        type: "capacity",
        message: "El equipo superará el 90% de capacidad con esta configuración.",
        utilization: utilization.utilization_percentage,
        available_capacity: utilization.available_capacity,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  validateDeterminationEquipment,
  validateEquipmentCapacity,
};
