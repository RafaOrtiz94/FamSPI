const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'FamDb',
  database: 'FamSPI'
});

async function checkConstraints() {
  try {
    console.log('=== CONSTRAINTS DE private_purchase_requests ===');

    // Verificar constraints
    const constraints = await pool.query(`
      SELECT
        conname as constraint_name,
        conrelid::regclass as table_name,
        pg_get_constraintdef(oid) as constraint_definition,
        contype as constraint_type
      FROM pg_constraint
      WHERE conrelid = 'public.private_purchase_requests'::regclass
      ORDER BY conname;
    `);
    console.log('Constraints encontrados:', constraints.rows);

    // Verificar índices
    const indexes = await pool.query(`
      SELECT
        indexname as index_name,
        tablename as table_name,
        indexdef as index_definition
      FROM pg_indexes
      WHERE tablename = 'private_purchase_requests'
      AND schemaname = 'public'
      ORDER BY indexname;
    `);
    console.log('\nÍndices encontrados:', indexes.rows);

    // Verificar estructura de la tabla
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'private_purchase_requests'
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    console.log('\nColumnas:', columns.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkConstraints();