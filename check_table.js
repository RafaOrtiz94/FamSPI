const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'FamDb',
  database: 'FamSPI'
});

async function checkTable() {
  try {
    // Verificar estructura de private_purchase_requests
    const columns = await pool.query(`
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_name='private_purchase_requests'
      and table_schema='public'
      order by ordinal_position
    `);
    console.log('Columnas:', columns.rows);

    // Verificar constraints
    const constraints = await pool.query(`
      select conname, contype, pg_get_constraintdef(oid)
      from pg_constraint
      where conrelid = 'private_purchase_requests'::regclass
    `);
    console.log('Constraints:', constraints.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkTable();