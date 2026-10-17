const { Pool } = require('pg');

// Database connection configuration
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'FamDb',
    database: 'FamSPI'
});

async function checkDatabaseFase2() {
    try {
        console.log('🔍 [FASE2] DB Smoke Check - Verificando tablas de compras...\n');

        // Test 1: Basic connectivity
        console.log('1️⃣ Conectividad básica...');
        const nowResult = await pool.query('SELECT now()');
        console.log('✅ Conectado:', nowResult.rows[0].now);

        // Test 2: Count records in purchase tables
        console.log('\n2️⃣ Conteo de registros en tablas de compras...');
        const privateCount = await pool.query('SELECT COUNT(*) as count FROM private_purchase_requests');
        const publicCount = await pool.query('SELECT COUNT(*) as count FROM equipment_purchase_requests');

        console.log(`📊 private_purchase_requests: ${privateCount.rows[0].count} registros`);
        console.log(`📊 equipment_purchase_requests: ${publicCount.rows[0].count} registros`);

        // Test 3: Verify table structures exist (basic check)
        console.log('\n3️⃣ Verificación de estructura de tablas...');
        const tablesExist = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('private_purchase_requests', 'equipment_purchase_requests')
        `);

        const existingTables = tablesExist.rows.map(row => row.table_name);
        console.log('✅ Tablas existentes:', existingTables.join(', '));

        if (existingTables.length !== 2) {
            throw new Error('Faltan tablas críticas de compras');
        }

        console.log('\n✅ [FASE2] DB Check completado - Backend intacto para unificación UI');

    } catch (error) {
        console.error('❌ [FASE2] DB Check failed:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkDatabaseFase2();