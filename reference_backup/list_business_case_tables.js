const path = require("path");
const db = require(path.join(__dirname, "backend/src/config/db"));

async function main() {
  try {
    const { rows } = await db.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%business_case%' ORDER BY table_name"
    );
    console.log("🎯 Tablas relacionadas con business_case:");
    rows.forEach((row) => console.log(" - " + row.table_name));
  } catch (error) {
    console.error(error);
  } finally {
    process.exit();
  }
}

main();
