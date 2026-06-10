#!/usr/bin/env node
/**
 * Script para limpiar datos de prueba del usuario rafael.ortiz@fam-project.com
 * Borra: actas, asignaciones y eventos relacionados
 * Mantiene: los equipos (son reales)
 */

const { Pool } = require('pg');
require('dotenv').config();

// Use correct DATABASE_URL from Neon
const DATABASE_URL = 'postgresql://neondb_owner:npg_W12CVSvHJEsA@ep-wispy-moon-aqszgsal-pooler.c-8.us-east-1.aws.neon.tech/FamSPI?sslmode=require&channel_binding=require';

console.log('📡 Conectando a base de datos FamSPI...');

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function cleanupRafaelData() {
  const client = await pool.connect();
  try {
    console.log('🔍 Buscando usuario rafael.ortiz@fam-project.com...');

    // 1. Encontrar el user_id
    const userResult = await client.query(
      `SELECT id, email, fullname FROM public.users WHERE email = $1`,
      ['rafael.ortiz@fam-project.com']
    );

    if (!userResult.rows.length) {
      console.log('❌ Usuario no encontrado');
      return;
    }

    const userId = userResult.rows[0].id;
    const userName = userResult.rows[0].fullname || userResult.rows[0].email;
    console.log(`✓ Usuario encontrado: ${userName} (ID: ${userId})`);

    // 2. Contar actas creadas por este usuario
    const actasResult = await client.query(
      `SELECT COUNT(*) as count FROM public.ti_asset_actas WHERE generated_by = $1`,
      [userId]
    );
    const actasCount = parseInt(actasResult.rows[0].count);
    console.log(`\n📋 Actas creadas por ${userName}: ${actasCount}`);

    // 3. Contar asignaciones hechas por este usuario
    const assignResult = await client.query(
      `SELECT COUNT(*) as count FROM public.ti_asset_assignments WHERE created_by = $1`,
      [userId]
    );
    const assignCount = parseInt(assignResult.rows[0].count);
    console.log(`📌 Asignaciones hechas por ${userName}: ${assignCount}`);

    // 4. Contar eventos creados
    const eventsResult = await client.query(
      `SELECT COUNT(*) as count FROM public.ti_asset_events WHERE created_by = $1`,
      [userId]
    );
    const eventsCount = parseInt(eventsResult.rows[0].count);
    console.log(`📊 Eventos creados por ${userName}: ${eventsCount}`);

    console.log('\n⚠️  Se procederá a ELIMINAR estos registros...\n');

    // Iniciar transacción
    await client.query('BEGIN');

    // 5. Obtener IDs de actas a eliminar
    const actasToDelete = await client.query(
      `SELECT id FROM public.ti_asset_actas WHERE generated_by = $1`,
      [userId]
    );
    const actaIds = actasToDelete.rows.map(r => r.id);

    // 6. Eliminar items de actas
    let itemsCount = 0;
    if (actaIds.length) {
      const deleteItems = await client.query(
        `DELETE FROM public.ti_asset_actas_items WHERE acta_id = ANY($1)`,
        [actaIds]
      );
      itemsCount = deleteItems.rowCount;
      console.log(`🗑️  Eliminadas ${deleteItems.rowCount} filas de ti_asset_actas_items`);
    }

    // 7. Eliminar actas
    const deleteActas = await client.query(
      `DELETE FROM public.ti_asset_actas WHERE generated_by = $1`,
      [userId]
    );
    console.log(`🗑️  Eliminadas ${deleteActas.rowCount} actas`);

    // 8. Eliminar asignaciones
    const deleteAssign = await client.query(
      `DELETE FROM public.ti_asset_assignments WHERE created_by = $1`,
      [userId]
    );
    console.log(`🗑️  Eliminadas ${deleteAssign.rowCount} asignaciones`);

    // 9. Eliminar eventos
    const deleteEvents = await client.query(
      `DELETE FROM public.ti_asset_events WHERE created_by = $1`,
      [userId]
    );
    console.log(`🗑️  Eliminados ${deleteEvents.rowCount} eventos`);

    // Confirmar transacción
    await client.query('COMMIT');

    console.log('\n✅ Limpieza completada exitosamente');
    console.log(`\n📊 Resumen:`);
    console.log(`   - Actas eliminadas: ${deleteActas.rowCount}`);
    console.log(`   - Items de actas eliminados: ${itemsCount}`);
    console.log(`   - Asignaciones eliminadas: ${deleteAssign.rowCount}`);
    console.log(`   - Eventos eliminados: ${deleteEvents.rowCount}`);
    console.log(`\n✓ Los equipos se mantuvieron intactos (son datos reales)`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la limpieza:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar
cleanupRafaelData().then(() => {
  console.log('\n🎉 Script finalizado');
  process.exit(0);
}).catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
