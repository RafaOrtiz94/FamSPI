const { Pool } = require('pg');

// Database connection configuration
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'FamDb',
    database: 'FamSPI'
});

async function checkDatabase() {
    try {
        console.log('🔍 Checking database connectivity and purchase-related tables...\n');

        // Test 1: Basic connectivity
        console.log('1️⃣ Testing database connectivity...');
        const nowResult = await pool.query('SELECT now()');
        console.log('✅ Connected successfully at:', nowResult.rows[0].now);

        // Test 2: List all tables in public schema
        console.log('\n2️⃣ Listing all tables in public schema...');
        const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

        const allTables = tablesResult.rows.map(row => row.table_name);
        console.log('📋 Total tables found:', allTables.length);

        // Test 3: Focus on purchase-related tables
        console.log('\n3️⃣ Purchase-related tables found:');
        const purchaseTables = allTables.filter(name =>
            name.includes('purchase') ||
            name.includes('compra') ||
            name.includes('request') ||
            name.includes('solicitud') ||
            name.includes('equipment') ||
            name.includes('private') ||
            name.includes('public') ||
            name.includes('bc_')
        );

        purchaseTables.forEach(table => console.log(`  - ${table}`));

        // Test 4: Check structure of key tables
        const keyTables = ['private_purchase_requests', 'equipment_purchase_requests'];

        for (const tableName of keyTables) {
            if (allTables.includes(tableName)) {
                console.log(`\n4️⃣ Structure of ${tableName}:`);
                const columnsResult = await pool.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position
        `, [tableName]);

                columnsResult.rows.forEach(col => {
                    console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
                });

                // Check record count
                const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
                console.log(`  📊 Records in ${tableName}: ${countResult.rows[0].count}`);
            }
        }

        console.log('\n✅ Database check completed successfully!');

    } catch (error) {
        console.error('❌ Database check failed:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkDatabase();