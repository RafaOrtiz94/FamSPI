const { pool } = require('./backend/src/config/db');

async function checkSchema() {
    try {
        const res = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND data_type LIKE '%timestamp%'
      ORDER BY table_name, ordinal_position
    `);

        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkSchema();