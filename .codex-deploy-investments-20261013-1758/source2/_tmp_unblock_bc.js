const { Pool } = require("pg");

const pool = new Pool({
  host: "ep-wispy-moon-aqszgsal.c-8.us-east-1.aws.neon.tech",
  user: "neondb_owner",
  password: process.env.NEON_DB_PASSWORD,
  database: "neondb",
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

const BC_ID = "54762e41-74c9-45fb-80e0-454b9bf040a8";

(async () => {
  try {
    const newDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { rows } = await pool.query(
      `UPDATE equipment_purchase_requests
          SET modern_bc_metadata = jsonb_set(
                modern_bc_metadata,
                '{preflow_review_deadline_at}',
                to_jsonb($2::text),
                true
              ),
              updated_at = NOW()
        WHERE id = $1
        RETURNING id,
                  modern_bc_metadata->>'preflow_review_deadline_at' AS preflow_review_deadline_at,
                  modern_bc_metadata->'determinations_gate'->'section_locks' AS section_locks`,
      [BC_ID, newDeadline],
    );

    console.log(JSON.stringify(rows[0], null, 2));
  } catch (e) {
    console.error("ERR", e.message);
  } finally {
    await pool.end();
  }
})();
