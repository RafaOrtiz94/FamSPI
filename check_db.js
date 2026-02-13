
const db = require('./backend/src/config/db');

async function checkTable() {
    try {
        const res = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'personnel_requests'
        `);
        console.log('Columns in personnel_requests:');
        res.rows.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type})`);
        });
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkTable();
