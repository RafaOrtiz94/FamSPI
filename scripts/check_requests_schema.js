const db = require("./backend/config/db");

async function checkSchema() {
    try {
        const { rows } = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'requests'
    `);
        console.log("Columns of 'requests' table:");
        rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));

        const { rows: types } = await db.query("SELECT * FROM request_types");
        console.log("\nRequest Types:");
        types.forEach(t => console.log(`- ${t.code}: ${t.title}`));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkSchema();
