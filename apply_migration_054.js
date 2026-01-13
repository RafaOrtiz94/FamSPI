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
    console.log('=== APLICANDO MIGRACIÓN 054 ===');

    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, 'backend', 'migrations', '054_create_purchase_delivery_schedules.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Ejecutando migración...');
    await pool.query(sql);

    console.log('✅ Migración 054 aplicada exitosamente');

    // Verificar que se aplicó correctamente
    console.log('\n=== VERIFICACIÓN ===');

    // Verificar tabla nueva
    const tableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'purchase_delivery_schedules'
      );
    `);
    console.log('Tabla purchase_delivery_schedules existe:', tableResult.rows[0].exists);

  } catch (err) {
    console.error('❌ Error aplicando migración:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();