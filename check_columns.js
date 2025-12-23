const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'FamDb',
    database: process.env.DB_NAME || 'FamSPI',
});

(async () => {
    try {
        const { rows } = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'document_signature_logs'
            ORDER BY ordinal_position
        `);
        console.log('Current columns in document_signature_logs:');
        rows.forEach(col => {
            console.log(`- ${col.column_name}: ${col.data_type} (${col.is_nullable}) default: ${col.column_default}`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
})();
