const path = require("path");
const db = require(path.join(__dirname, "backend/src/config/db"));

const BUSINESS_CASE_ID = "054efa4a-e6b7-4a23-a9d5-f16818e3857b";

async function main() {
  try {
    const insertQuery = `
      INSERT INTO equipment_purchase_requests (
        id,
        client_name,
        status,
        bc_stage,
        bc_progress,
        assigned_to_email,
        assigned_to_name,
        extra,
        modern_bc_metadata,
        created_by,
        bc_created_at,
        uses_modern_system,
        bc_system_type,
        request_type,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, 'draft', 'pending_comercial', '{}'::jsonb,
        NULL, NULL, '{}'::jsonb, '{}'::jsonb,
        NULL, NOW(), true, 'modern', 'business_case',
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING *;
    `;

    const values = [
      BUSINESS_CASE_ID,
      "Cliente provisório",
    ];

    const { rows } = await db.query(insertQuery, values);
    console.log(rows.length ? "Inserted:" : "Already existed:", rows);
  } catch (error) {
    console.error(error);
  } finally {
    process.exit();
  }
}

main();
