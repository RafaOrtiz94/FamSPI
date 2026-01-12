const Joi = require("joi");
const db = require("../../config/db");
const logger = require("../../config/logger");
const calculationEngine = require("./calculationEngine.service");

const equipmentSchema = Joi.object({
  code: Joi.string().trim().required(),
  nombre: Joi.string().trim().required(),
  fabricante: Joi.string().trim().required(),
  modelo: Joi.string().allow(null, "").trim(),
  category_type: Joi.string().allow(null, "").trim(),
  capacity_per_hour: Joi.number().integer().min(0).allow(null),
  max_daily_capacity: Joi.number().integer().min(0).allow(null),
  base_price: Joi.number().min(0).allow(null),
  estado: Joi.string().valid("operativo", "inactivo", "mantenimiento").default("operativo"),
});

const equipmentFormulaSchema = Joi.object({
  calculationType: Joi.string().valid("consumption", "cost").required(),
  formula: Joi.object().required(),
  exampleContext: Joi.object().default({}),
});

const mapEquipmentModelRecord = (row) => ({
  equipment_id: row.id,
  equipment_code: row.code,
  equipment_name: row.name,
  manufacturer: row.manufacturer,
  model: row.model,
  category: row.category,
  category_type: row.category_type,
  capacity_per_hour: row.capacity_per_hour,
  max_daily_capacity: row.max_daily_capacity,
  base_price: row.base_price,
  status: row.status,
  technical_specs: row.technical_specs,
  default_calculation_formula: row.default_calculation_formula,
  metadata: row.metadata,
});

async function list(req, res) {
  try {
    const { category, q } = req.query;
    const params = [];
    const clauses = [];

    if (category) {
      params.push(category.toLowerCase());
      clauses.push(`LOWER(category) = $${params.length}`);
    }

    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      clauses.push(`(LOWER(equipment_name) LIKE $${params.length} OR LOWER(equipment_code) LIKE $${params.length})`);
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const { rows } = await db.query(`SELECT * FROM v_equipment_full_catalog ${whereClause} ORDER BY equipment_name`, params);
    res.json({ ok: true, data: rows });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error listando catálogo de equipos" });
  }
}

async function getDetails(req, res) {
  try {
    const { rows } = await db.query(`SELECT * FROM v_equipment_full_catalog WHERE equipment_id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, message: "Equipo no encontrado" });
    res.json({ ok: true, data: rows[0] });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error obteniendo equipo" });
  }
}

async function getDeterminations(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT id, name, category, roche_code, volume_per_test, reagent_consumption
       FROM catalog_determinations WHERE equipment_id = $1 ORDER BY name`,
      [req.params.id],
    );
    res.json({ ok: true, data: rows });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error obteniendo determinaciones" });
  }
}

async function create(req, res) {
  try {
    const { error, value } = equipmentSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const insert = await db.query(
      `INSERT INTO public.equipment_models
       (code, name, manufacturer, model, category_type, capacity_per_hour, max_daily_capacity, base_price, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        value.code,
        value.nombre,
        value.fabricante,
        value.modelo,
        value.category_type,
        value.capacity_per_hour,
        value.max_daily_capacity,
        value.base_price,
        value.estado,
      ],
    );

    res.status(201).json({ ok: true, data: mapEquipmentModelRecord(insert.rows[0]) });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error creando equipo" });
  }
}

async function update(req, res) {
  try {
    const { error, value } = equipmentSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const updateQuery = `
      UPDATE public.equipment_models
      SET code=$1, name=$2, manufacturer=$3, model=$4, category_type=$5, capacity_per_hour=$6,
          max_daily_capacity=$7, base_price=$8, status=$9, updated_at = now()
      WHERE id=$10 RETURNING *
    `;

    const { rows } = await db.query(updateQuery, [
      value.code,
      value.nombre,
      value.fabricante,
      value.modelo,
      value.category_type,
      value.capacity_per_hour,
      value.max_daily_capacity,
      value.base_price,
      value.estado,
      req.params.id,
    ]);

    if (!rows.length) return res.status(404).json({ ok: false, message: "Equipo no encontrado" });
    res.json({ ok: true, data: mapEquipmentModelRecord(rows[0]) });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error actualizando equipo" });
  }
}

async function updateFormula(req, res) {
  try {
    const { error, value } = equipmentFormulaSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const validation = await calculationEngine.validateFormula(value.formula, value.exampleContext);
    if (!validation.isValid) {
      return res.status(400).json({ ok: false, message: `Fórmula inválida: ${validation.error}` });
    }

    const existing = await db.query(
      `SELECT id, default_calculation_formula FROM public.equipment_models WHERE id = $1`,
      [req.params.id],
    );
    if (!existing.rows.length) return res.status(404).json({ ok: false, message: "Equipo no encontrado" });

    const currentFormula = existing.rows[0].default_calculation_formula || {};
    const updatedFormula = { ...currentFormula, [value.calculationType]: value.formula };

    const { rows } = await db.query(
      `UPDATE public.equipment_models SET default_calculation_formula = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [JSON.stringify(updatedFormula), req.params.id],
    );

    res.json({ ok: true, data: mapEquipmentModelRecord(rows[0]), validation });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error actualizando fórmula del equipo" });
  }
}

module.exports = {
  list,
  getDetails,
  getDeterminations,
  create,
  update,
  updateFormula,
};
