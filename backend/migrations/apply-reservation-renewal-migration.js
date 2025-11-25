/**
 * Script para aplicar la migración de campos de renovación de reserva
 * Ejecutar con: node backend/migrations/apply-reservation-renewal-migration.js
 */

const db = require('../src/config/db');

async function applyMigration() {
    try {
        console.log('🔄 Aplicando migración: agregar campos de renovación de reserva...');

        const columns = [
            { name: 'reservation_expires_at', type: 'TIMESTAMPTZ' },
            { name: 'reservation_renewed_at', type: 'TIMESTAMPTZ' },
            { name: 'reservation_renewal_count', type: 'INTEGER DEFAULT 0' },
            { name: 'cancelled_at', type: 'TIMESTAMPTZ' },
            { name: 'cancellation_reason', type: 'TEXT' }
        ];

        for (const column of columns) {
            const checkColumn = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'equipment_purchase_requests' 
        AND column_name = $1
      `, [column.name]);

            if (checkColumn.rows.length === 0) {
                await db.query(`
          ALTER TABLE equipment_purchase_requests 
          ADD COLUMN ${column.name} ${column.type}
        `);
                console.log(`✅ Columna ${column.name} agregada`);
            } else {
                console.log(`✅ Columna ${column.name} ya existe`);
            }
        }

        // Agregar comentarios
        await db.query(`
      COMMENT ON COLUMN equipment_purchase_requests.reservation_expires_at 
      IS 'Fecha de expiración de la reserva (60 días después de la última reserva/renovación)'
    `);
        await db.query(`
      COMMENT ON COLUMN equipment_purchase_requests.reservation_renewed_at 
      IS 'Última fecha de renovación de la reserva'
    `);
        await db.query(`
      COMMENT ON COLUMN equipment_purchase_requests.reservation_renewal_count 
      IS 'Número de veces que se ha renovado la reserva'
    `);
        await db.query(`
      COMMENT ON COLUMN equipment_purchase_requests.cancelled_at 
      IS 'Fecha de cancelación de la orden'
    `);
        await db.query(`
      COMMENT ON COLUMN equipment_purchase_requests.cancellation_reason 
      IS 'Razón de la cancelación (manual, auto-expiración, etc)'
    `);

        console.log('✅ Comentarios agregados');

        console.log('\n🎉 Migración completada exitosamente!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error al aplicar la migración:', error);
        process.exit(1);
    }
}

applyMigration();
