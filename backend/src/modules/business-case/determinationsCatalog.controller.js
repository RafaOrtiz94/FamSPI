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

module.exports = {
  list,
  getDetails,
  updateFormula,
  validateFormula,
};
