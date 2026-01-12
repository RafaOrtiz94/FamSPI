const db = require("../../config/db");
const logger = require("../../config/logger");

const ensureTable = async () => {
  await db.query("CREATE SCHEMA IF NOT EXISTS servicio;");
  await db.query(`
    CREATE TABLE IF NOT EXISTS servicio.aplicaciones_tecnicas (
      id SERIAL PRIMARY KEY,
      client TEXT,
      location TEXT,
      type TEXT,
      url TEXT,
      status TEXT DEFAULT 'Disponible',
      assignee TEXT,
      archived BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
};

const normalizeRow = (row) => ({
  id: row.id,
  client: row.client,
  location: row.location,
  type: row.type,
  url: row.url,
  status: row.status,
  assignee: row.assignee,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const listAvailable = async (_req, res) => {
  try {
    await ensureTable();

    const { rows } = await db.query(
      `SELECT * FROM servicio.aplicaciones_tecnicas WHERE COALESCE(archived, false) = false ORDER BY created_at DESC;`
    );

    return res.json({ ok: true, rows: rows.map(normalizeRow) });
  } catch (err) {
    logger.error({ err }, "Error listing technical applications");
    return res.status(500).json({ ok: false, error: "No se pudieron obtener las aplicaciones" });
  }
};

module.exports = {
  listAvailable,
};
