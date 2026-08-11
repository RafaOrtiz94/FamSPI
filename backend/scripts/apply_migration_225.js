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
    path.join(__dirname, "../migrations/225_trainings_absent_acta_url.sql"),
    "utf8"
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Migración 225 aplicada correctamente.");

    const { rows } = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='trainings' AND column_name='absent_acta_drive_url'"
    );
    if (rows.length > 0) {
      console.log("✓ Columna absent_acta_drive_url presente en tabla trainings.");
    } else {
      console.warn("⚠ La columna absent_acta_drive_url NO fue creada — revisar el SQL.");
    }
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("ERROR aplicando migración 225:", e.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

run();
