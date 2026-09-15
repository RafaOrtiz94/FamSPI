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

const consumableSchema = Joi.object({
  name: Joi.string().trim().required(),
  type: Joi.string().valid("reactivo", "control", "calibrador", "consumible", "material").required(),
  supplier_code: Joi.string().allow(null, "").trim(),
  determination_id: Joi.number().integer().allow(null),
  metadata: Joi.object().default({}),
});

const determinationCreateSchema = Joi.object({
  name: Joi.string().trim().required(),
  roche_code: Joi.string().allow(null, "").trim(),
  category: Joi.string().allow(null, "").trim(),
  version: Joi.string().allow(null, "").default("1.0"),
  status: Joi.string().valid("active", "discontinuado").default("active"),
  valid_from: Joi.date().optional(),
  valid_to: Joi.date().allow(null),
  metadata: Joi.object().default({}),
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
    const equipmentId = req.params.id;
    const { rows } = await db.query(
      `SELECT
         id,
         name,
         category,
         roche_code,
         status
       FROM catalog_determinations
       WHERE equipment_id = $1
         AND COALESCE(lower(status), 'active') IN ('active', 'activo')
         AND NOT EXISTS (
           SELECT 1
           FROM catalog_equipment_consumables ec
           JOIN catalog_consumables c ON c.id = ec.consumable_id
           WHERE ec.equipment_id = catalog_determinations.equipment_id
             AND COALESCE(lower(c.status), 'active') IN ('active', 'activo')
             AND (
               (catalog_determinations.roche_code IS NOT NULL AND c.supplier_code = catalog_determinations.roche_code)
               OR lower(trim(c.name)) = lower(trim(catalog_determinations.name))
             )
         )
       ORDER BY name`,
      [equipmentId],
    );
    res.json({ ok: true, data: rows });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error obteniendo determinaciones" });
  }
}

async function getConsumables(req, res) {
  try {
    const { type } = req.query;
    const params = [req.params.id];
    const typeClause = type ? "AND c.type = $2" : "";
    if (type) params.push(type);
    const { rows } = await db.query(
      `SELECT
         c.id AS id,
         c.name,
         c.type,
         c.supplier_code,
         c.metadata,
         ec.determination_id,
         d.name AS determination_name,
         ec.consumption_rate
       FROM catalog_equipment_consumables ec
       JOIN catalog_consumables c ON c.id = ec.consumable_id
       LEFT JOIN catalog_determinations d ON d.id = ec.determination_id
       WHERE ec.equipment_id = $1
       AND COALESCE(lower(c.status), 'active') IN ('active', 'activo')
       ${typeClause}
       ORDER BY c.name`,
      params,
    );
    res.json({ ok: true, data: rows });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error obteniendo consumibles" });
  }
}

async function createConsumable(req, res) {
  try {
    const { error, value } = consumableSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const equipmentId = req.params.id;
    const normalizedSupplier = value.supplier_code || null;
    const normalizedName = value.name.trim();
    const existing = await db.query(
      `SELECT id FROM catalog_consumables
       WHERE lower(name) = lower($1)
         AND COALESCE(supplier_code, '') = COALESCE($2, '')
         AND type = $3
       LIMIT 1`,
      [normalizedName, normalizedSupplier, value.type],
    );

    let consumableId = existing.rows[0]?.id;
    if (!consumableId) {
      const insert = await db.query(
        `INSERT INTO catalog_consumables (name, type, status, metadata, supplier_code, valid_from)
         VALUES ($1, $2, 'active', $3, $4, CURRENT_DATE)
         RETURNING id`,
        [
          normalizedName,
          value.type,
          JSON.stringify(value.metadata || {}),
          normalizedSupplier,
        ],
      );
      consumableId = insert.rows[0].id;
    }

    const linkExists = await db.query(
      `SELECT id FROM catalog_equipment_consumables
       WHERE equipment_id = $1 AND consumable_id = $2
         AND COALESCE(determination_id, 0) = COALESCE($3, 0)
       LIMIT 1`,
      [equipmentId, consumableId, value.determination_id || null],
    );

    if (!linkExists.rows.length) {
      await db.query(
        `INSERT INTO catalog_equipment_consumables
         (equipment_id, consumable_id, determination_id, consumption_rate, created_at)
         VALUES ($1, $2, $3, 1, now())`,
        [equipmentId, consumableId, value.determination_id || null],
      );
    }

    res.status(201).json({ ok: true, data: { id: consumableId } });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error creando consumible" });
  }
}

async function updateConsumable(req, res) {
  try {
    const { error, value } = consumableSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const equipmentId = req.params.id;
    const consumableId = req.params.consumableId;

    const { rows } = await db.query(
      `UPDATE catalog_consumables
       SET name=$1, type=$2, supplier_code=$3, metadata=$4, updated_at = now()
       WHERE id=$5 RETURNING id`,
      [
        value.name.trim(),
        value.type,
        value.supplier_code || null,
        JSON.stringify(value.metadata || {}),
        consumableId,
      ],
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: "Consumible no encontrado" });

    await db.query(
      `UPDATE catalog_equipment_consumables
       SET determination_id = $1, updated_at = now()
       WHERE equipment_id = $2 AND consumable_id = $3`,
      [value.determination_id || null, equipmentId, consumableId],
    );

    res.json({ ok: true, data: { id: consumableId } });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error actualizando consumible" });
  }
}

async function createDetermination(req, res) {
  try {
    const { error, value } = determinationCreateSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const equipmentId = req.params.id;
    const { rows } = await db.query(
      `INSERT INTO catalog_determinations
       (name, roche_code, category, equipment_id, version, status, valid_from, valid_to, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, CURRENT_DATE),$8,$9)
       RETURNING *`,
      [
        value.name,
        value.roche_code,
        value.category,
        equipmentId,
        value.version,
        value.status,
        value.valid_from,
        value.valid_to,
        JSON.stringify(value.metadata || {}),
      ],
    );

    res.status(201).json({ ok: true, data: rows[0] });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error creando determinación" });
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
  getConsumables,
  createConsumable,
  updateConsumable,
  createDetermination,
  create,
  update,
  updateFormula,
};
