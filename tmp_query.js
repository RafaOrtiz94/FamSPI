const db = require("./backend/src/config/db");

async function main() {
  const text =
    process.env.QUERY ||
    "SELECT id, uses_modern_system, bc_system_type FROM equipment_purchase_requests WHERE id = $1";
  const params = process.env.PARAMS ? process.env.PARAMS.split(",") : process.argv.slice(3);
  try {
    const { rows } = await db.query(text, params);
    console.log(rows);
  } catch (error) {
    console.error(error);
  } finally {
    process.exit();
  }
}

main();
