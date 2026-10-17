const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, "../migrations/214_ti_acta_sequence.sql"), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);

    // Verify
    const { rows } = await client.query("SELECT last_value FROM public.ti_acta_seq");
    console.log("ti_acta_seq current value:", rows[0].last_value);
    console.log("Next acta will be:", Number(rows[0].last_value) + 1);

    await client.query("COMMIT");
    console.log("Migration 214 applied OK");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("ERROR:", e.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

run();
