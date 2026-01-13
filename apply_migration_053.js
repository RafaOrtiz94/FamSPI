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
    console.log('=== APLICANDO MIGRACIÓN 053 ===');

    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, 'backend', 'migrations', '053_private_purchase_flow_enhancements.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Ejecutando migración...');
    await pool.query(sql);

    console.log('✅ Migración 053 aplicada exitosamente');

    // Verificar que se aplicó correctamente
    console.log('\n=== VERIFICACIÓN ===');

    // Verificar enum
    const enumResult = await pool.query(`
      select t.typname, e.enumlabel
      from pg_type t join pg_enum e on t.oid=e.enumtypid
      where t.typname = 'private_purchase_status_enum'
      order by e.enumsortorder
    `);
    console.log('Estados del enum:', enumResult.rows.map(r => r.enumlabel));

    // Verificar tabla nueva
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'purchase_delivery_schedules'
      );
    `);
    console.log('Tabla purchase_delivery_schedules existe:', tableExists.rows[0].exists);

  } catch (err) {
    console.error('❌ Error aplicando migración:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();