const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_IvXRb0pLAku5@ep-muddy-sun-ah5um48r-pooler.c-3.us-east-1.aws.neon.tech/FamSPI?sslmode=require&channel_binding=require'
  });
  try {
    console.log('[MIGRACIÓN 186] Connecting...');
    await client.connect();
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/186_module_global_status.sql'), 'utf8');
    await client.query(sql);
    console.log('✅ MIGRACIÓN 186 APLICADA EXITOSAMENTE!');
  } catch (error) {
    console.error('[MIGRACIÓN 186] ERROR:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}
applyMigration();
