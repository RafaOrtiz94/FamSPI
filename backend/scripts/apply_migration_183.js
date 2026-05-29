const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_IvXRb0pLAku5@ep-muddy-sun-ah5um48r-pooler.c-3.us-east-1.aws.neon.tech/FamSPI?sslmode=require&channel_binding=require'
  });

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
