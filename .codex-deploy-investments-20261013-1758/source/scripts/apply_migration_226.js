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
    path.join(__dirname, "../migrations/226_rename_tecnico_roles.sql"),
    "utf8"
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(sql);
    await client.query("COMMIT");
    console.log("Migración 226 aplicada correctamente.");
    const verifyResult = result.find((r) => r.rows && r.rows.length > 0);
    if (verifyResult) {
      console.log("Distribución de roles técnicos después de la migración:");
      console.table(verifyResult.rows);
    } else {
      console.log("No hay usuarios con roles técnicos (tabla vacía o ya migrados).");
    }
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("ERROR aplicando migración 226:", e.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

run();
