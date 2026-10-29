const db = require("../config/db");
const logger = require("../config/logger");

const columnCache = new Map();

async function columnExists(schema, table, column) {
  const key = `${schema}.${table}.${column}`.toLowerCase();
  if (columnCache.has(key)) return columnCache.get(key);

  try {
    const { rows } = await db.query(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND column_name = $3
        LIMIT 1
      `,
      [schema, table, column]
    );
    const exists = rows.length > 0;
    columnCache.set(key, exists);
    return exists;
  } catch (err) {
    logger.warn(
      { err, schema, table, column },
      "⚠️ No se pudo verificar columna en information_schema"
    );
    columnCache.set(key, false);
    return false;
  }
}

module.exports = { columnExists };
