const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const { getDbConfig } = require("./dbConnection");

async function applyMigration() {
  const client = new Client(getDbConfig());

  try {
    console.log('[MIGRACIÓN 184] Connecting...');
    await client.connect();
    console.log('[MIGRACIÓN 184] Connected successfully');

    const migrationPath = path.join(__dirname, '../migrations/184_kickoff_aportes.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('[MIGRACIÓN 184] Ejecutando migración...');
    await client.query(migrationSql);
    console.log('[MIGRACIÓN 184] MIGRACIÓN COMPLETADA EXITOSAMENTE!');

    console.log('\n=== CAMBIOS APLICADOS ===');
    console.log('- ALTER TABLE kickoff_questions ADD COLUMN type (question | aporte)');
    console.log('- CREATE TABLE kickoff_aporte_ratings');
    console.log('- CREATE INDEX idx_kar_aporte');

    console.log('\n✅ MIGRACIÓN 184 APLICADA EXITOSAMENTE!');
  } catch (error) {
    console.error('[MIGRACIÓN 184] ERROR:', error.message);
    console.error('[MIGRACIÓN 184] Stack:', error.stack);
    throw error;
  } finally {
    await client.end();
  }
}

applyMigration();
