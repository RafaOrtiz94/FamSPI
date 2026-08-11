"use strict";
const { Client } = require("pg");

async function main() {
  const client = new Client({
    host: "ep-wispy-moon-aqszgsal.c-8.us-east-1.aws.neon.tech",
    port: 5432,
    user: "neondb_owner",
    password: "npg_W12CVSvHJEsA",
    database: "neondb",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const user = await client.query(
    `SELECT id, email, fullname FROM users WHERE email ILIKE '%jose.morales%'`,
  );
  console.log("Usuario:", JSON.stringify(user.rows, null, 2));
  if (!user.rows.length) { await client.end(); return; }
  const userId = user.rows[0].id;

  const purchases = await client.query(
    `SELECT id, status, offer_kind, client_snapshot->>'name' AS client_name,
            client_snapshot->>'commercial_name' AS client_commercial_name,
            provider_email, created_at, updated_at
       FROM private_purchase_requests
      WHERE created_by = $1 AND offer_kind = 'alquiler'
      ORDER BY created_at DESC`,
    [userId],
  );
  console.log(`\nCompras privadas de alquiler creadas por ${user.rows[0].fullname} (id=${userId}):`, JSON.stringify(purchases.rows, null, 2));

  if (purchases.rows.length === 1) {
    const purchaseId = purchases.rows[0].id;

    const fks = await client.query(`
      SELECT tc.table_schema, tc.table_name, kcu.column_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'private_purchase_requests'
        AND ccu.column_name = 'id'
      ORDER BY tc.table_name
    `);
    console.log(`\nFKs que referencian private_purchase_requests(id) (${fks.rows.length}):`);

    for (const row of fks.rows) {
      const t = `"${row.table_schema}"."${row.table_name}"`;
      const c = `"${row.column_name}"`;
      try {
        const cnt = await client.query(`SELECT COUNT(*)::int AS n FROM ${t} WHERE ${c} = $1`, [purchaseId]);
        console.log(`  ${row.table_schema}.${row.table_name}.${row.column_name} (delete_rule=${row.delete_rule}): ${cnt.rows[0].n} filas`);
      } catch (e) {
        console.log(`  ${row.table_schema}.${row.table_name}: ERROR ${e.message}`);
      }
    }

    // business_case_id vinculado (si aplica)
    const bcCheck = await client.query(
      `SELECT business_case_id FROM private_purchase_requests WHERE id = $1`,
      [purchaseId],
    );
    console.log("\nbusiness_case_id vinculado:", bcCheck.rows[0]?.business_case_id || "ninguno");
  }

  await client.end();
}
main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
