const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const SQL = fs.readFileSync(path.join(__dirname, "../migrations/213_signer_cedula_snapshot.sql"), "utf8");

const client = new Client({
  host:     process.env.DB_HOST     || "ep-wispy-moon-aqszgsal-pooler.c-8.us-east-1.aws.neon.tech",
  port:     Number(process.env.DB_PORT || 5432),
  user:     process.env.DB_USER     || "neondb_owner",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "FamSPI",
  ssl: { rejectUnauthorized: false },
});

client.connect()
  .then(() => client.query(SQL))
  .then(() => { console.log("✅ MIGRACIÓN 213 APLICADA"); return client.end(); })
  .catch((err) => { console.error("ERROR:", err.message); client.end(); process.exit(1); });
