const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const { getDbConfig } = require("./dbConnection");

async function applyMigration() {
  const client = new Client(getDbConfig());
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
