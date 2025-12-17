const path = require("path");
const Pool = require(path.join(__dirname, "backend/node_modules/pg")).Pool;

const pool = new Pool({
  connectionString: "postgres://postgres:FamDb@localhost:5432/FamSPI",
});

async function main() {
  try {
    const id = process.argv[2];
    const queryText = id
      ? "SELECT id, uses_modern_system, bc_system_type FROM equipment_purchase_requests WHERE id = $1"
      : "SELECT id, uses_modern_system, bc_system_type FROM equipment_purchase_requests ORDER BY created_at DESC LIMIT 5";
    const params = id ? [id] : [];
    const { rows } = await pool.query(queryText, params);
    console.log(rows);
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();
