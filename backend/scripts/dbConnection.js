"use strict";

require("dotenv").config();

const DEFAULT_DB_HOST = "ep-wispy-moon-aqszgsal-pooler.c-8.us-east-1.aws.neon.tech";

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
    database: process.env.DB_NAME || "FamSPI",
    ssl: getSslConfig(),
  };
}

module.exports = {
  DEFAULT_DB_HOST,
  getDbConfig,
};
