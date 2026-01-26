// Script temporal para analizar datos de notificaciones existentes
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'FamDb',
    database: 'FamSPI'
});

async function analyzeNotifications() {
    const client = await pool.connect();

    try {
        console.log('📊 ANÁLISIS DE NOTIFICACIONES EXISTENTES\n');

        // 1. Contar total de notificaciones
        const countResult = await client.query('SELECT COUNT(*) as total FROM notifications');
        console.log(`Total de notificaciones: ${countResult.rows[0].total}\n`);

        if (countResult.rows[0].total > 0) {
            // 2. Agrupar por tipo
            const byType = await client.query(`
        SELECT type, COUNT(*) as count
        FROM notifications
        GROUP BY type
        ORDER BY count DESC
      `);

            console.log('Notificaciones por tipo:');
            byType.rows.forEach(row => {
                console.log(`  - ${row.type}: ${row.count}`);
            });
            console.log('');

            // 3. Agrupar por source
            const bySource = await client.query(`
        SELECT source, COUNT(*) as count
        FROM notifications
        WHERE source IS NOT NULL
        GROUP BY source
        ORDER BY count DESC
      `);

            console.log('Notificaciones por origen (source):');
            bySource.rows.forEach(row => {
                console.log(`  - ${row.source}: ${row.count}`);
            });
            console.log('');

            // 4. Agrupar por status
            const byStatus = await client.query(`
        SELECT status, COUNT(*) as count
        FROM notifications
        GROUP BY status
        ORDER BY count DESC
      `);

            console.log('Notificaciones por estado:');
            byStatus.rows.forEach(row => {
                console.log(`  - ${row.status}: ${row.count}`);
            });
            console.log('');

            // 5. Muestra de notificaciones recientes
            const samples = await client.query(`
        SELECT id, user_id, title, type, source, status, priority, created_at
        FROM notifications
        ORDER BY created_at DESC
        LIMIT 5
      `);

            console.log('Últimas 5 notificaciones:');
            samples.rows.forEach(row => {
                console.log(`  [${row.id}] ${row.title}`);
                console.log(`      Tipo: ${row.type}, Source: ${row.source || 'N/A'}, Status: ${row.status}`);
                console.log(`      Usuario: ${row.user_id}, Prioridad: ${row.priority}, Fecha: ${row.created_at}`);
                console.log('');
            });
        }

        // 6. Verificar relaciones con otras tablas
        console.log('🔗 VERIFICANDO RELACIONES CON PROCESOS\n');

        // Verificar si hay tablas relacionadas con solicitudes
        const requestsCheck = await client.query(`
      SELECT COUNT(*) as total FROM requests
    `);
        console.log(`Total de solicitudes (requests): ${requestsCheck.rows[0].total}`);

        // Verificar business cases
        const bcCheck = await client.query(`
      SELECT COUNT(*) as total FROM equipment_purchase_requests
      WHERE is_modern_bc = true
    `);
        console.log(`Total de Business Cases modernos: ${bcCheck.rows[0].total}`);

        // Verificar estados de business cases
        const bcStates = await client.query(`
      SELECT state, COUNT(*) as count
      FROM equipment_purchase_requests
      WHERE is_modern_bc = true
      GROUP BY state
      ORDER BY count DESC
    `);

        if (bcStates.rows.length > 0) {
            console.log('\nBusiness Cases por estado:');
            bcStates.rows.forEach(row => {
                console.log(`  - ${row.state || 'NULL'}: ${row.count}`);
            });
        }

        console.log('\n✅ Análisis completado');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

analyzeNotifications();
