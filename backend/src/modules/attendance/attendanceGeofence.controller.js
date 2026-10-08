const db = require("../../config/db");

const getReference = async (req, res) => {
  try {
    const scopeType = String(req.query?.scopeType || "office").trim();
    const scopeId = String(req.query?.scopeId || "main_office").trim();

    const result = await db.query(
      `SELECT * FROM attendance_geofence_reference_points WHERE scope_type = $1 AND scope_id = $2 LIMIT 1`,
      [scopeType, scopeId],
    );

    return res.status(200).json({ ok: true, data: result.rows[0] || null });
  } catch (err) {
    return res.status(500).json({ ok: false, message: "Error consultando geocerca" });
  }
};

module.exports = {
  getReference,
};
