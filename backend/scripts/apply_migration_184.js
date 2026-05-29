const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_IvXRb0pLAku5@ep-muddy-sun-ah5um48r-pooler.c-3.us-east-1.aws.neon.tech/FamSPI?sslmode=require&channel_binding=require'
  });

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
