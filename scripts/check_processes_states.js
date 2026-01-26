// Script temporal para analizar procesos y sus estados
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'FamDb',
    database: 'FamSPI'
});

async function analyzeProcesses() {
    const client = await pool.connect();

    try {
        console.log('📊 ANÁLISIS DE PROCESOS Y ESTADOS\n');

        // 1. Analizar solicitudes (requests)
        console.log('=== SOLICITUDES (REQUESTS) ===\n');

        const requestsTotal = await client.query('SELECT COUNT(*) as total FROM requests');
        console.log(`Total de solicitudes: ${requestsTotal.rows[0].total}`);

        // Estados de solicitudes
        const requestsByStatus = await client.query(`
      SELECT status, COUNT(*) as count
      FROM requests
      GROUP BY status
      ORDER BY count DESC
    `);

        console.log('\nSolicitudes por estado:');
        requestsByStatus.rows.forEach(row => {
            console.log(`  - ${row.status}: ${row.count}`);
        });

        // Tipos de solicitudes
        const requestsByType = await client.query(`
      SELECT rt.code, rt.title, COUNT(r.id) as count
      FROM requests r
      JOIN request_types rt ON r.request_type_id = rt.id
      GROUP BY rt.code, rt.title
      ORDER BY count DESC
    `);

        console.log('\nSolicitudes por tipo:');
        requestsByType.rows.forEach(row => {
            console.log(`  - ${row.code} (${row.title}): ${row.count}`);
        });

        // 2. Analizar Business Cases
        console.log('\n\n=== BUSINESS CASES ===\n');

        // Verificar estructura de equipment_purchase_requests
        const bcColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'equipment_purchase_requests'
      ORDER BY ordinal_position
    `);

        console.log('Columnas de equipment_purchase_requests:');
        const hasStateColumn = bcColumns.rows.some(col => col.column_name === 'state');
        const hasStatusColumn = bcColumns.rows.some(col => col.column_name === 'status');

        bcColumns.rows.forEach(col => {
            if (col.column_name.includes('state') || col.column_name.includes('status') || col.column_name.includes('modern')) {
                console.log(`  - ${col.column_name}: ${col.data_type}`);
            }
        });

        const bcTotal = await client.query('SELECT COUNT(*) as total FROM equipment_purchase_requests');
        console.log(`\nTotal de equipment_purchase_requests: ${bcTotal.rows[0].total}`);

        if (hasStateColumn) {
            const bcByState = await client.query(`
        SELECT state, COUNT(*) as count
        FROM equipment_purchase_requests
        GROUP BY state
        ORDER BY count DESC
      `);

            console.log('\nBusiness Cases por estado (state):');
            bcByState.rows.forEach(row => {
                console.log(`  - ${row.state || 'NULL'}: ${row.count}`);
            });
        }

        if (hasStatusColumn) {
            const bcByStatus = await client.query(`
        SELECT status, COUNT(*) as count
        FROM equipment_purchase_requests
        GROUP BY status
        ORDER BY count DESC
      `);

            console.log('\nBusiness Cases por estado (status):');
            bcByStatus.rows.forEach(row => {
                console.log(`  - ${row.status || 'NULL'}: ${row.count}`);
            });
        }

        // 3. Verificar aprobaciones
        console.log('\n\n=== SISTEMA DE APROBACIONES ===\n');

        const approvalsCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE '%approval%'
      ORDER BY table_name
    `);

        if (approvalsCheck.rows.length > 0) {
            console.log('Tablas de aprobaciones encontradas:');
            approvalsCheck.rows.forEach(row => {
                console.log(`  - ${row.table_name}`);
            });
        } else {
            console.log('⚠️  No se encontraron tablas de aprobaciones');
        }

        // 4. Verificar workflows
        console.log('\n\n=== WORKFLOWS ===\n');

        const workflowCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE '%workflow%' OR table_name LIKE '%flow%')
      ORDER BY table_name
    `);

        if (workflowCheck.rows.length > 0) {
            console.log('Tablas de workflow encontradas:');
            workflowCheck.rows.forEach(row => {
                console.log(`  - ${row.table_name}`);
            });
        } else {
            console.log('⚠️  No se encontraron tablas de workflow');
        }

        console.log('\n✅ Análisis completado');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

analyzeProcesses();
