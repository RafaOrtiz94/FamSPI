// apply_migration_056.js - Aplicar migración para agregar columna active a users
const fs = require('fs');
const path = require('path');
const db = require('./src/config/db');

async function applyMigration() {
  console.log('🚀 Aplicando migración 056: Agregar columna active a tabla users');

  try {
    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, 'migrations', '056_add_active_column_to_users.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Ejecutando migración...');

    // Ejecutar la migración
    await db.query(migrationSQL);

    console.log('✅ Migración 056 aplicada exitosamente');
    console.log('📝 Se agregó la columna active a la tabla users');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error aplicando migración 056:', error);
    process.exit(1);
  }
}

applyMigration();
