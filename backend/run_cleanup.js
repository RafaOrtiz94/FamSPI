/**
 * Run equipment purchase requests cleanup for sandbox
 * Execute the SQL script to delete all purchase request records
 */

const { Pool } = require('pg');

// Create direct connection with provided password
const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "FamDb",
    database: "FamSPI",
});

const query = (text, params) => pool.query(text, params);
const fs = require('fs');
const path = require('path');

async function runCleanup() {
    try {
        console.log('🧹 Starting equipment purchase requests cleanup...');

        // Read the SQL file
        const sqlFile = path.join(__dirname, 'clean_equipment_purchase_requests.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');

        // Split SQL commands (basic approach - assumes ; separates statements)
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

        console.log(`📄 Found ${statements.length} SQL statements to execute`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();
            if (!statement) continue;

            console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);

            try {
                await query(statement);
                console.log(`✅ Statement ${i + 1} executed successfully`);
            } catch (error) {
                // Skip comments and empty statements
                if (statement.startsWith('--') || statement.startsWith('/*')) {
                    continue;
                }
                console.warn(`⚠️  Statement ${i + 1} failed (might be expected):`, error.message);
            }
        }

        console.log('🎉 Cleanup completed!');
        console.log('📊 Results:');

        // Show remaining records
        const result = await query(`
      SELECT
        'requests table' as table_name,
        COUNT(*) as remaining_records
      FROM requests
      WHERE request_type_id = (SELECT id FROM request_types WHERE code = 'F.ST-19')

      UNION ALL

      SELECT
        'equipment_purchase_requests table' as table_name,
        COUNT(*) as remaining_records
      FROM equipment_purchase_requests
    `);

        console.table(result.rows);

        process.exit(0);

    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
}

// Run the cleanup
runCleanup();