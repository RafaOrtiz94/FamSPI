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
    `SELECT id, email, fullname FROM users WHERE email ILIKE '%alex.farino%' OR fullname ILIKE '%FARI%O%ALEX%'`,
  );
  console.log("Usuario:", JSON.stringify(user.rows, null, 2));

  if (!user.rows.length) {
    await client.end();
    return;
  }
  const userId = user.rows[0].id;

  const bcs = await client.query(
    `SELECT id, client_name, canonical_state, bc_purchase_type, created_by, created_at, updated_at, uses_modern_system, bc_system_type
       FROM equipment_purchase_requests
      WHERE created_by = $1
        AND (uses_modern_system = true OR bc_system_type = 'modern' OR request_type = 'business_case')
      ORDER BY created_at DESC`,
    [userId],
  );
  console.log(`\nBusiness Cases creados por ${user.rows[0].fullname} (id=${userId}):`, JSON.stringify(bcs.rows, null, 2));

  if (bcs.rows.length === 1) {
    const bcId = bcs.rows[0].id;

    // FKs reales que referencian equipment_purchase_requests(id), y su regla de borrado
    const fks = await client.query(`
      SELECT
        tc.table_schema, tc.table_name, kcu.column_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'equipment_purchase_requests'
        AND ccu.column_name = 'id'
      ORDER BY tc.table_name
    `);
    console.log(`\nFKs que referencian equipment_purchase_requests(id) (${fks.rows.length}):`, JSON.stringify(fks.rows, null, 2));

    // Contar filas reales en cada tabla hija para este BC puntual
    for (const row of fks.rows) {
      const t = `"${row.table_schema}"."${row.table_name}"`;
      const c = `"${row.column_name}"`;
      try {
        const cnt = await client.query(`SELECT COUNT(*)::int AS n FROM ${t} WHERE ${c} = $1`, [bcId]);
        console.log(`  ${row.table_schema}.${row.table_name}.${row.column_name} (delete_rule=${row.delete_rule}): ${cnt.rows[0].n} filas`);
      } catch (e) {
        console.log(`  ${row.table_schema}.${row.table_name}: ERROR ${e.message}`);
      }
    }
  }

  await client.end();
}
main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
