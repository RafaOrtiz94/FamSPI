const Joi = require("joi");
const db = require("../../config/db");
const logger = require("../../config/logger");
const calculationEngine = require("./calculationEngine.service");

const formulaSchema = Joi.object({
  formula: Joi.object().required(),
  formula_type: Joi.string().valid("custom", "template", "default").default("custom"),
});

const validateFormulaSchema = Joi.object({
  formula: Joi.object().required(),
  exampleContext: Joi.object().default({}),
});

const determinationSchema = Joi.object({
  name: Joi.string().trim().required(),
  roche_code: Joi.string().allow(null, "").trim(),
  category: Joi.string().allow(null, "").trim(),
  equipment_id: Joi.number().integer().allow(null),
  version: Joi.string().allow(null, "").default("1.0"),
  status: Joi.string().valid("active", "discontinuado").default("active"),
  valid_from: Joi.date().optional(),
  valid_to: Joi.date().allow(null),
  metadata: Joi.object().default({}),
});

async function list(req, res) {
  try {
    const { equipmentId, q } = req.query;
    const params = [];
    const clauses = [];

    if (equipmentId) {
      params.push(equipmentId);
      clauses.push(`equipment_id = $${params.length}`);
    }

    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      clauses.push(`(LOWER(name) LIKE $${params.length} OR LOWER(roche_code) LIKE $${params.length})`);
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const { rows } = await db.query(`SELECT * FROM catalog_determinations ${whereClause} ORDER BY name`, params);
    res.json({ ok: true, data: rows });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error listando determinaciones" });
  }
}

async function getDetails(req, res) {
  try {
    const { rows } = await db.query(`SELECT * FROM catalog_determinations WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, message: "Determinación no encontrada" });
    res.json({ ok: true, data: rows[0] });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error obteniendo determinación" });
  }
}

async function updateFormula(req, res) {
  try {
    const { error, value } = formulaSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const validation = await calculationEngine.validateFormula(value.formula, req.body.exampleContext || {});
    if (!validation.isValid) {
      return res.status(400).json({ ok: false, message: `Fórmula inválida: ${validation.error}` });
    }

    const { rows } = await db.query(
      `UPDATE catalog_determinations SET calculation_formula = $1, formula_type = $2, formula_version = '1.1', updated_at = now()
       WHERE id = $3 RETURNING *`,
      [JSON.stringify(value.formula), value.formula_type, req.params.id],
    );

    if (!rows.length) return res.status(404).json({ ok: false, message: "Determinación no encontrada" });
    res.json({ ok: true, data: rows[0], validation });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error actualizando fórmula" });
  }
}

async function validateFormula(req, res) {
  try {
    const { error, value } = validateFormulaSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const validation = await calculationEngine.validateFormula(value.formula, value.exampleContext);
    res.json({ ok: true, validation });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error validando fórmula" });
  }
}

async function create(req, res) {
  try {
    const { error, value } = determinationSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const { rows } = await db.query(
      `INSERT INTO catalog_determinations (name, roche_code, category, equipment_id, version, status, valid_from, valid_to, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, CURRENT_DATE),$8,$9)
       RETURNING *`,
      [
        value.name,
        value.roche_code,
        value.category,
        value.equipment_id,
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

async function update(req, res) {
  try {
    const { error, value } = determinationSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const { rows } = await db.query(
      `UPDATE catalog_determinations
       SET name=$1, roche_code=$2, category=$3, equipment_id=$4, version=$5, status=$6, valid_from=COALESCE($7, valid_from),
           valid_to=$8, metadata=$9, updated_at = now()
       WHERE id=$10 RETURNING *`,
      [
        value.name,
        value.roche_code,
        value.category,
        value.equipment_id,
        value.version,
        value.status,
        value.valid_from,
        value.valid_to,
        JSON.stringify(value.metadata || {}),
        req.params.id,
      ],
    );

    if (!rows.length) return res.status(404).json({ ok: false, message: "Determinación no encontrada" });
    res.json({ ok: true, data: rows[0] });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error actualizando determinación" });
  }
}

async function remove(req, res) {
  try {
    const { rows } = await db.query(
      `UPDATE catalog_determinations SET status = 'discontinuado', updated_at = now() WHERE id = $1 RETURNING id`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: "Determinación no encontrada" });
    res.status(204).send();
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error eliminando determinación" });
  }
}

module.exports = {
  list,
  getDetails,
  create,
  update,
  remove,
  updateFormula,
  validateFormula,
};
