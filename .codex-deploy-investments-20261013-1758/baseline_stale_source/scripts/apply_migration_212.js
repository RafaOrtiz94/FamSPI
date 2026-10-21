/**
 * apply_migration_212.js — signature_placement column
 * Bypasses dotenv/getDbConfig — reads credentials from process.env directly.
 * Run via run_migrations.ps1 or set env vars manually before calling.
 */
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const SQL = fs.readFileSync(path.join(__dirname, "../migrations/212_signature_placement.sql"), "utf8");

const DB_HOST = process.env.DB_HOST || "ep-wispy-moon-aqszgsal-pooler.c-8.us-east-1.aws.neon.tech";
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_USER = process.env.DB_USER || "neondb_owner";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "FamSPI";

console.log(`[MIGRACIÓN 212] Host: ${DB_HOST}`);

const client = new Client({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  ssl: { rejectUnauthorized: false },
});

client
  .connect()
  .then(() => client.query(SQL))
  .then(() => {
    console.log("✅ MIGRACIÓN 212 APLICADA EXITOSAMENTE!");
    return client.end();
  })
  .catch((err) => {
    console.error("[MIGRACIÓN 212] ERROR:", err.message);
    client.end().catch(() => {});
    process.exit(1);
  });
