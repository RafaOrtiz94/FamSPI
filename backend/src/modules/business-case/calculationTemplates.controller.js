const Joi = require("joi");
const db = require("../../config/db");
const logger = require("../../config/logger");

const applySchema = Joi.object({
  determinationId: Joi.number().integer().required(),
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

async function applyToItem(req, res) {
  try {
    const { error, value } = applySchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    const templateResult = await db.query(`SELECT * FROM calculation_templates WHERE id = $1 AND is_active = true`, [
      req.params.id,
    ]);
    if (!templateResult.rows.length) return res.status(404).json({ ok: false, message: "Plantilla no encontrada" });

    const template = templateResult.rows[0];
    const { rows } = await db.query(
      `UPDATE catalog_determinations
       SET calculation_formula = $1, formula_type = 'template', formula_version = $2, updated_at = now()
       WHERE id = $3 RETURNING *`,
      [JSON.stringify(template.formula), template.version || "1.0", value.determinationId],
    );

    if (!rows.length) return res.status(404).json({ ok: false, message: "Determinación no encontrada" });
    res.json({ ok: true, data: rows[0] });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ ok: false, message: "Error aplicando plantilla" });
  }
}

module.exports = {
  list,
  applyToItem,
};
