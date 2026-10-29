const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const { getDbConfig } = require("./dbConnection");

async function applyMigration() {
  const client = new Client(getDbConfig());

  try {
    console.log('[MIGRACIÓN 185] Connecting...');
    await client.connect();
    console.log('[MIGRACIÓN 185] Connected successfully');

    const migrationPath = path.join(__dirname, '../migrations/185_kickoff_open.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('[MIGRACIÓN 185] Ejecutando migración...');
    await client.query(migrationSql);
    console.log('[MIGRACIÓN 185] MIGRACIÓN COMPLETADA EXITOSAMENTE!');

    console.log('\n=== CAMBIOS APLICADOS ===');
    console.log('- ALTER TABLE kickoff_events ADD COLUMN is_open BOOLEAN DEFAULT FALSE');

    console.log('\n✅ MIGRACIÓN 185 APLICADA EXITOSAMENTE!');
  } catch (error) {
    console.error('[MIGRACIÓN 185] ERROR:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

applyMigration();
