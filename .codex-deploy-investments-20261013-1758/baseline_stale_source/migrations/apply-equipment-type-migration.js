/**
 * Script para aplicar la migración de equipment_type
 * Ejecutar con: node backend/migrations/apply-equipment-type-migration.js
 */

const db = require('../src/config/db');

async function applyMigration() {
    try {
        console.log('🔄 Aplicando migración: agregar columna equipment_type...');

        // Verificar si la columna ya existe
        const checkColumn = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'equipment_purchase_requests' 
      AND column_name = 'equipment_type'
    `);

        if (checkColumn.rows.length > 0) {
            console.log('✅ La columna equipment_type ya existe. No se requiere migración.');
            process.exit(0);
        }

        // Agregar la columna
        await db.query(`
      ALTER TABLE equipment_purchase_requests 
      ADD COLUMN equipment_type TEXT DEFAULT 'new'
    `);
        console.log('✅ Columna equipment_type agregada exitosamente');

        // Actualizar registros existentes
        const updateResult = await db.query(`
      UPDATE equipment_purchase_requests 
      SET equipment_type = 'new' 
      WHERE equipment_type IS NULL
    `);
        console.log(`✅ ${updateResult.rowCount} registros actualizados con valor por defecto`);

        // Agregar comentario
        await db.query(`
      COMMENT ON COLUMN equipment_purchase_requests.equipment_type 
      IS 'Tipo de equipo solicitado: new (nuevo) o cu (usado/reacondicionado)'
    `);
        console.log('✅ Comentario agregado a la columna');

        console.log('\n🎉 Migración completada exitosamente!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error al aplicar la migración:', error);
        process.exit(1);
    }
}

applyMigration();
