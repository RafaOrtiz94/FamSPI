const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'FamDb',
  database: process.env.DB_NAME || 'FamSPI'
});

async function applyMigration() {
  try {
    console.log('=== APLICANDO MIGRACIÓN 055 ===');

    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, 'backend', 'migrations', '055_add_primary_key_private_purchase_requests.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Ejecutando migración...');
    await pool.query(sql);

    console.log('✅ Migración 055 aplicada exitosamente');

    // Verificar que se aplicó correctamente
    console.log('\n=== VERIFICACIÓN ===');

    // Verificar constraints actualizados
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'private_purchase_requests'
      AND table_schema = 'public'
      ORDER BY constraint_name;
    `);
    console.log('Constraints después de migración:', constraints.rows);

  } catch (err) {
    console.error('❌ Error aplicando migración:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();