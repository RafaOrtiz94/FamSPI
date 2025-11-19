/**
 * Configuración de PostgreSQL para SPI Fam
 * ----------------------------------------
 * - Pool de conexiones con validación y logs
 * - Variables tomadas de .env
 * - Maneja reconexión y errores de idle
 */

const { Pool } = require("pg");
const logger = require("./logger");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "spi_fam",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl:
    process.env.DB_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});

pool.on("connect", () => logger.info("✅ PostgreSQL conectado correctamente"));
pool.on("remove", () => logger.info("🧹 Conexión PostgreSQL liberada"));
pool.on("error", (err) => {
  logger.error({ err }, "❌ Error en conexión PostgreSQL");
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
