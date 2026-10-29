"use strict";

const { Client } = require("pg");
const { getDbConfig } = require("./dbConnection");

async function main() {
  const client = new Client(getDbConfig());
  await client.connect();

  try {
    const { rows } = await client.query(`
      WITH request_pool AS (
        SELECT
          pr.id,
          pr.request_number,
          pr.position_title,
          pr.status,
          pr.applicant_id AS linked_applicant_id,
          COUNT(a.id)::int AS applicants_by_position,
          ARRAY_REMOVE(
            ARRAY_AGG(a.id ORDER BY a.updated_at DESC),
            NULL
          ) AS applicant_ids_by_position
        FROM personnel_requests pr
        LEFT JOIN applicants a
          ON LOWER(COALESCE(a.profile->'laboral'->>'cargo', '')) LIKE '%' || LOWER(COALESCE(pr.position_title, '')) || '%'
        GROUP BY pr.id, pr.request_number, pr.position_title, pr.status, pr.applicant_id
      )
      SELECT
        rp.id,
        rp.request_number,
        rp.position_title,
        rp.status,
        rp.linked_applicant_id,
        rp.applicants_by_position,
        COALESCE(
          CASE
            WHEN rp.linked_applicant_id IS NULL THEN false
            ELSE rp.linked_applicant_id = ANY(COALESCE(rp.applicant_ids_by_position, ARRAY[]::integer[]))
          END,
          false
        ) AS linked_is_in_position_pool
      FROM request_pool rp
      ORDER BY rp.id ASC
    `);

    console.log(JSON.stringify({ ok: true, total: rows.length, rows }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    message: error.message,
    stack: error.stack,
  }, null, 2));
  process.exit(1);
});
