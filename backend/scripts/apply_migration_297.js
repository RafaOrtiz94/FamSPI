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
    host: "ep-lucky-bar-aw5wr0cn.c-12.us-east-1.aws.neon.tech",
    port: 5432,
    user: "neondb_owner",
    password,
    database: "neondb",
    ssl: { rejectUnauthorized: false },
  });

  const sql = fs.readFileSync(
    path.join(__dirname, "../migrations/297_support_tickets_kpi_reports.sql"),
    "utf8"
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Migración 297 aplicada correctamente: support_ticket_kpi_definitions y support_ticket_report_exports creadas.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("ERROR aplicando migración 297:", e.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

run();
