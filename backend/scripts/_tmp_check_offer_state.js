process.env.DB_HOST = "ep-lucky-bar-aw5wr0cn.c-12.us-east-1.aws.neon.tech";
process.env.DB_USER = "neondb_owner";
process.env.DB_PASSWORD = "npg_rExYDGS14fPO";
process.env.DB_NAME = "neondb";
process.env.DB_SSL = "true";
const db = require("../src/config/db");
(async () => {
  const { rows } = await db.query(
    `SELECT id, offer_key, offer_label, target_equipment_id, target_equipment_name, version_number, status, sheet_file_id, pdf_file_id, created_at
       FROM bc_offer_versions
      WHERE business_case_id=$1
      ORDER BY version_number`,
    ["c8b574d0-18b6-43a2-acd1-8151988f36c9"]
  );
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
