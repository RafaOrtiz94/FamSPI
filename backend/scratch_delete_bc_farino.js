"use strict";
const { Client } = require("pg");

const BC_ID = "4d7bec80-4d25-4e62-83e3-6b5004768bb1";

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

  try {
    await client.query("BEGIN");
    const del = await client.query(
      `DELETE FROM equipment_purchase_requests WHERE id = $1 RETURNING id, client_name, canonical_state`,
      [BC_ID],
    );
    console.log("Borrado:", JSON.stringify(del.rows, null, 2));

    const remaining = await client.query(
      `SELECT COUNT(*)::int AS n FROM equipment_purchase_requests WHERE id = $1`,
      [BC_ID],
    );
    console.log("Filas remanentes con ese id (debe ser 0):", remaining.rows[0].n);

    if (del.rowCount !== 1 || remaining.rows[0].n !== 0) {
      throw new Error("Verificacion post-borrado fallida, haciendo ROLLBACK");
    }

    await client.query("COMMIT");
    console.log("COMMIT ok.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ROLLBACK:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
