const Joi = require("joi");
const db = require("../../config/db");
const logger = require("../../config/logger");
const calculationEngine = require("./calculationEngine.service");

const applySchema = Joi.object({
  determinationId: Joi.number().integer().required(),
});

const templateSchema = Joi.object({
  name: Joi.string().trim().required(),
  description: Joi.string().allow(null, "").trim(),
  type: Joi.string().valid("expression", "conditional", "pipeline").default("expression"),
  version: Joi.string().allow(null, "").default("1.0"),
  formula: Joi.object().required(),
  is_active: Joi.boolean().default(true),
});

async function list(req, res) {
  try {
    const { rows } = await db.query(`SELECT * FROM calculation_templates WHERE is_active = true ORDER BY name`);
    res.json({ ok: true, data: rows });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error listando plantillas" });
  }
}

async function create(req, res) {
  try {
    const { error, value } = templateSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const validation = await calculationEngine.validateFormula(value.formula, req.body.exampleContext || {});
    if (!validation.isValid) return res.status(400).json({ ok: false, message: `Fórmula inválida: ${validation.error}` });

    const { rows } = await db.query(
      `INSERT INTO calculation_templates (name, description, type, version, formula, is_active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [value.name, value.description, value.type, value.version, JSON.stringify(value.formula), value.is_active],
    );

    res.status(201).json({ ok: true, data: rows[0], validation });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error creando plantilla" });
  }
}

async function update(req, res) {
  try {
    const { error, value } = templateSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const validation = await calculationEngine.validateFormula(value.formula, req.body.exampleContext || {});
    if (!validation.isValid) return res.status(400).json({ ok: false, message: `Fórmula inválida: ${validation.error}` });

    const { rows } = await db.query(
      `UPDATE calculation_templates
       SET name=$1, description=$2, type=$3, version=$4, formula=$5, is_active=$6, updated_at = now()
       WHERE id=$7 RETURNING *`,
      [value.name, value.description, value.type, value.version, JSON.stringify(value.formula), value.is_active, req.params.id],
    );

    if (!rows.length) return res.status(404).json({ ok: false, message: "Plantilla no encontrada" });
    res.json({ ok: true, data: rows[0], validation });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error actualizando plantilla" });
  }
}

async function remove(req, res) {
  try {
    const { rowCount } = await db.query(
      `UPDATE calculation_templates SET is_active = false, updated_at = now() WHERE id = $1`,
      [req.params.id],
    );
    if (!rowCount) return res.status(404).json({ ok: false, message: "Plantilla no encontrada" });
    res.status(204).send();
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error eliminando plantilla" });
  }
}

async function applyToItem(req, res) {
  try {
    const { error, value } = applySchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const templateResult = await db.query(`SELECT * FROM calculation_templates WHERE id = $1 AND is_active = true`, [
      req.params.id,
    ]);
    if (!templateResult.rows.length) return res.status(404).json({ ok: false, message: "Plantilla no encontrada" });

    const determinationResult = await db.query(`SELECT id, status FROM catalog_determinations WHERE id = $1`, [
      value.determinationId,
    ]);
    if (!determinationResult.rows.length)
      return res.status(404).json({ ok: false, message: "Determinación no encontrada" });
    if (determinationResult.rows[0].status && determinationResult.rows[0].status !== "active") {
      return res.status(400).json({ ok: false, message: "La determinación no está activa" });
    }

    const template = templateResult.rows[0];
    const validation = await calculationEngine.validateFormula(template.formula, req.body.exampleContext || {});
    if (!validation.isValid) {
      return res.status(400).json({ ok: false, message: `Plantilla inválida: ${validation.error}` });
    }
    const { rows } = await db.query(
      `UPDATE catalog_determinations
       SET calculation_formula = $1, formula_type = 'template', formula_version = $2, updated_at = now()
       WHERE id = $3 RETURNING *`,
      [JSON.stringify(template.formula), template.version || "1.0", value.determinationId],
    );

    if (!rows.length) return res.status(404).json({ ok: false, message: "Determinación no encontrada" });
    res.json({ ok: true, data: rows[0], validation });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error aplicando plantilla" });
  }
}

module.exports = {
  list,
  create,
  update,
  remove,
  applyToItem,
};
