const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const { getDbConfig } = require("./dbConnection");

async function applyMigration() {
  const client = new Client(getDbConfig());

  try {
    console.log('[MIGRACIÓN 183] Connecting...');
    await client.connect();
    console.log('[MIGRACIÓN 183] Connected successfully');

    const migrationPath = path.join(__dirname, '../migrations/183_kickoff_ratings.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('[MIGRACIÓN 183] Ejecutando migración...');
    await client.query(migrationSql);
    console.log('[MIGRACIÓN 183] MIGRACIÓN COMPLETADA EXITOSAMENTE!');

    console.log('\n=== TABLAS CREADAS ===');
    console.log('- kickoff_question_ratings');
    console.log('- kickoff_presentation_ratings');
    console.log('- idx_kqr_question');
    console.log('- idx_kpr_presentation');

    console.log('\n✅ MIGRACIÓN 183 APLICADA EXITOSAMENTE!');
  } catch (error) {
    console.error('[MIGRACIÓN 183] ERROR:', error.message);
    console.error('[MIGRACIÓN 183] Stack:', error.stack);
    throw error;
  } finally {
    await client.end();
  }
}

applyMigration();
