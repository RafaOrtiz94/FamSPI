const path = require("path");
const { Pool } = require(path.join(__dirname, "backend/node_modules/pg"));

const pool = new Pool({
  connectionString: "postgres://postgres:FamDb@localhost:5432/FamSPI",
});

const TARGET_ID = process.argv[2];
const TABLES_TO_CHECK = [
  "equipment_purchase_requests",
  "private_purchase_requests",
  "business_cases",
  "bc_investments",
  "equipment_purchase_bc_items",
  "equipment_purchase_requests",
  "business_case_master",
  "equipment_purchase_requests_bc_items",
];

async function main() {
  if (!TARGET_ID) {
    console.error("Usage: node find_business_case_by_id.js <uuid>");
    process.exit(1);
  }
  try {
    for (const table of TABLES_TO_CHECK) {
      try {
        const { rows } = await pool.query(
          `SELECT id, * FROM ${table} WHERE id = $1 LIMIT 1`,
          [TARGET_ID]
        );
        if (rows.length) {
          console.log(`Found in ${table}:`, rows);
          await pool.end();
          return;
        }
      } catch (err) {
        // ignore missing table or column errors
      }
    }
    console.log("No record found for id", TARGET_ID);
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();
