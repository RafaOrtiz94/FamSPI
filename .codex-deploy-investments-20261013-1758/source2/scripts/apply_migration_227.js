const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

async function getDbPassword() {
  try {
    const pwd = execSync(
      'gcloud secrets versions access latest --secret="DB_PASSWORD" --project="famspi-sbox"',
      { encoding: "utf8" }
    ).trim();
    return pwd;
  } catch {
    return process.env.DB_PASSWORD || "";
  }
}

async function run() {
  const password = await getDbPassword();

  const pool = new Pool({
    host: "ep-wispy-moon-aqszgsal-pooler.c-8.us-east-1.aws.neon.tech",
    port: 5432,
    user: "neondb_owner",
    password,
    database: "FamSPI",
    ssl: { rejectUnauthorized: false },
  });

  const sql = fs.readFileSync(
    path.join(__dirname, "../migrations/227_viatico_anticipos.sql"),
    "utf8"
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Migración 227 aplicada correctamente: tabla viatico_anticipos creada.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("ERROR aplicando migración 227:", e.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

run();
