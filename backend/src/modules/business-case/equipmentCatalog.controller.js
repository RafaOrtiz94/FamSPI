const Joi = require("joi");
const db = require("../../config/db");
const logger = require("../../config/logger");

const equipmentSchema = Joi.object({
  code: Joi.string().required(),
  nombre: Joi.string().required(),
  fabricante: Joi.string().required(),
  modelo: Joi.string().allow(null, ""),
  category_type: Joi.string().allow(null, ""),
  capacity_per_hour: Joi.number().integer().allow(null),
  max_daily_capacity: Joi.number().integer().allow(null),
  base_price: Joi.number().allow(null),
  estado: Joi.string().default("operativo"),
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
      `INSERT INTO servicio.equipos (code, nombre, fabricante, modelo, category_type, capacity_per_hour, max_daily_capacity, base_price, estado)
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

    res.status(201).json({ ok: true, data: insert.rows[0] });
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
      UPDATE servicio.equipos
      SET code=$1, nombre=$2, fabricante=$3, modelo=$4, category_type=$5, capacity_per_hour=$6,
          max_daily_capacity=$7, base_price=$8, estado=$9, updated_at = now()
      WHERE id_equipo=$10 RETURNING *
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
    res.json({ ok: true, data: rows[0] });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error actualizando equipo" });
  }
}

module.exports = {
  list,
  getDetails,
  getDeterminations,
  create,
  update,
};
