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
    console.log('=== COLUMNAS DE bc_master ===');
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'bc_master'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    result.rows.forEach(row => {
      console.log(' ', row.column_name + ':', row.data_type);
    });

    console.log('\n=== PRIMEROS 5 REGISTROS ===');
    const dataResult = await pool.query('SELECT id, bc_number, client_name, created_at, updated_at FROM bc_master LIMIT 5');
    dataResult.rows.forEach((row, i) => {
      console.log('  Registro', i+1 + ': ID=' + row.id + ', bc_number=' + (row.bc_number || 'NULL') + ', client_name=' + (row.client_name || 'NULL') + ', created=' + row.created_at + ', updated=' + row.updated_at);
    });

    console.log('\n=== QUERY CON ORDER BY ===');
    const orderedResult = await pool.query('SELECT id, bc_number, client_name, created_at, updated_at FROM bc_master ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 20');
    console.log('Encontrados:', orderedResult.rows.length, 'registros');
    orderedResult.rows.forEach((row, i) => {
      if (i < 5) { // Solo mostrar primeros 5
        console.log(' ', i+1 + '. ID=' + row.id + ', bc_number=' + (row.bc_number || 'NULL') + ', client_name=' + (row.client_name || 'NULL') + ', created=' + row.created_at?.toISOString().split('T')[0] + ', updated=' + row.updated_at?.toISOString().split('T')[0]);
      }
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkTable();