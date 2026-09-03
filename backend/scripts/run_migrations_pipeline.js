/**
 * Aplica las migraciones 220 y 221 del pipeline de contratación en Neon.
 * Uso: node scripts/run_migrations_pipeline.js
 * Requiere: DATABASE_URL en env
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL no definido');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  console.log('Conectado a Neon');

  const migrations = [
    path.join(__dirname, '../migrations/220_applicant_pipeline.sql'),
    path.join(__dirname, '../migrations/221_salary_proposals.sql'),
  ];

  for (const file of migrations) {
    const name = path.basename(file);
    const sql = fs.readFileSync(file, 'utf8');
    try {
      await client.query(sql);
      console.log(`✓ ${name} aplicada`);
    } catch (e) {
      console.error(`✗ ${name}: ${e.message}`);
    }
  }

  await client.end();
  console.log('Listo.');
}

run().catch(e => { console.error(e); process.exit(1); });
