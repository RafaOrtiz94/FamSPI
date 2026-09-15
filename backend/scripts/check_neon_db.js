const { Client } = require("pg");
const { getDbConfig } = require("./dbConnection");

async function checkNeonDatabase() {
  const client = new Client(getDbConfig());

  try {
    console.log('[NEON] Connecting...');
    await client.connect();
    console.log('[NEON] Connected successfully');

    // Get columns for equipment_purchase_requests
    console.log('\n=== equipment_purchase_requests ===');
    const eprCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'equipment_purchase_requests'
      ORDER BY ordinal_position
    `);
    console.log('Columns:', eprCols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));

    // Get columns for private_purchase_requests
    console.log('\n=== private_purchase_requests ===');
    const pprCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'private_purchase_requests'
      ORDER BY ordinal_position
    `);
    console.log('Columns:', pprCols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));

    console.log('\n=== VERIFICACIÓN COMPLETADA ===');

    return {
      equipment_purchase_requests: eprCols.rows,
      private_purchase_requests: pprCols.rows
    };

  } catch (error) {
    console.error('[NEON] ERROR:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

checkNeonDatabase();
