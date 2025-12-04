const db = require("./src/config/db");
const fs = require('fs');

async function inspect() {
    try {
        const res = await db.query(`
      SELECT conname, pg_get_constraintdef(oid)
      FROM pg_constraint
      WHERE conrelid = 'client_visit_logs'::regclass;
    `);
        const output = res.rows.map(row => `${row.conname}: ${row.pg_get_constraintdef}`).join('\n');
        fs.writeFileSync('constraints.txt', output);
        console.log("Wrote constraints to constraints.txt");
    } catch (err) {
        console.error("Error inspecting table:", err);
    } finally {
        process.exit(0);
    }
}

inspect();
