const { Client } = require('pg');
require('dotenv').config();

async function checkNeonDatabase() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_IvXRb0pLAku5@ep-muddy-sun-ah5um48r-pooler.c-3.us-east-1.aws.neon.tech/FamSPI?sslmode=require&channel_binding=require'
  });

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
