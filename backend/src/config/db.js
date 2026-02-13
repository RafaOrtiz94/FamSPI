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

const intFromEnv = (key, fallback) => {
  const value = parseInt(process.env[key], 10);
  return Number.isFinite(value) ? value : fallback;
};

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "spi_fam",
  application_name:
    process.env.DB_APPLICATION_NAME || process.env.PGAPPNAME || "spi_fam_api",
  max: intFromEnv("DB_POOL_MAX", 10),
  min: intFromEnv("DB_POOL_MIN", 0),
  idleTimeoutMillis: intFromEnv("DB_IDLE_TIMEOUT_MS", 30000),
  connectionTimeoutMillis: intFromEnv("DB_CONN_TIMEOUT_MS", 5000),
  statement_timeout: intFromEnv("DB_STATEMENT_TIMEOUT_MS", 0) || undefined,
  idle_in_transaction_session_timeout:
    intFromEnv("DB_IDLE_IN_TX_TIMEOUT_MS", 0) || undefined,
  ssl:
    process.env.DB_SSL === "true"
      ? {
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" ? true : false,
        }
      : undefined,
});

pool.on("connect", () => logger.info("✅ PostgreSQL conectado correctamente"));
pool.on("remove", () => logger.info("🧹 Conexión PostgreSQL liberada"));
pool.on("error", (err) => {
  logger.error({ err }, "❌ Error en conexión PostgreSQL");
});

const setupGracefulShutdown = () => {
  const shutdown = async (signal) => {
    logger.info({ signal }, "🚦 Cerrando pool PostgreSQL");
    try {
      await pool.end();
      logger.info("✅ Pool PostgreSQL cerrado");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "❌ Error al cerrar pool PostgreSQL");
      process.exit(1);
    }
  };

  ["SIGINT", "SIGTERM"].forEach((sig) => {
    process.on(sig, () => shutdown(sig));
  });
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  setupGracefulShutdown,
  pool,
};
