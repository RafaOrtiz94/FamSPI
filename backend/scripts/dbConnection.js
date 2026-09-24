"use strict";

require("dotenv").config();

// MIGRACION 2026-07-21: wispy-moon agoto cuota de compute, se migro a muddy-sun (sin pooler).
// MIGRACION 2026-09-18: confirmado contra el DB_HOST real de Cloud Run (spi-backend) -- muddy-sun
// tambien quedo obsoleto, el host vigente es lucky-bar.
const DEFAULT_DB_HOST = "ep-lucky-bar-aw5wr0cn.c-12.us-east-1.aws.neon.tech";

function getSslConfig() {
  const enabled = String(process.env.DB_SSL || "true") === "true";
  if (!enabled) return undefined;
  return {
    rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "false") === "true",
  };
}

function getDbConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: getSslConfig(),
    };
  }

  return {
    host: process.env.DB_HOST || DEFAULT_DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "neondb_owner",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "neondb",
    ssl: getSslConfig(),
  };
}

module.exports = {
  DEFAULT_DB_HOST,
  getDbConfig,
};
