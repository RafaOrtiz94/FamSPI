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

const isTransientDbError = (err) => {
  const message = String(err?.message || "").toLowerCase();
  const code = String(err?.code || "").toUpperCase();

  if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ECONNREFUSED") return true;
  if (code === "57P01" || code === "57P03" || code === "53300") return true;

  return (
    message.includes("timeout exceeded when trying to connect") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("could not connect")
  );
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  maxUses: intFromEnv("DB_POOL_MAX_USES", 7500),
  keepAlive: process.env.DB_KEEPALIVE === "false" ? false : true,
  keepAliveInitialDelayMillis: intFromEnv("DB_KEEPALIVE_INITIAL_DELAY_MS", 10000),
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

pool.on("connect", () => logger.info("PostgreSQL conectado correctamente"));
pool.on("remove", () => logger.info("Conexión PostgreSQL liberada"));
pool.on("error", (err) => {
  logger.error({ err }, "Error en conexión PostgreSQL");
});

const setupGracefulShutdown = () => {
  const shutdown = async (signal) => {
    logger.info({ signal }, "Cerrando pool PostgreSQL");
    try {
      await pool.end();
      logger.info("Pool PostgreSQL cerrado");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error al cerrar pool PostgreSQL");
      process.exit(1);
    }
  };

  ["SIGINT", "SIGTERM"].forEach((sig) => {
    process.on(sig, () => shutdown(sig));
  });
};

const query = async (text, params) => {
  const maxAttempts = Math.max(1, intFromEnv("DB_QUERY_RETRY_ATTEMPTS", 2));
  const retryDelayMs = Math.max(50, intFromEnv("DB_QUERY_RETRY_DELAY_MS", 250));
  let attempt = 0;

   
  while (true) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      attempt += 1;
      const canRetry = attempt < maxAttempts && isTransientDbError(err);
      if (!canRetry) throw err;

      logger.warn(
        {
          attempt,
          maxAttempts,
          code: err?.code || null,
          message: err?.message || null,
        },
        "Retrying PostgreSQL query after transient failure"
      );

      await sleep(retryDelayMs * attempt);
    }
  }
};

module.exports = {
  query,
  getClient: () => pool.connect(),
  setupGracefulShutdown,
  pool,
};
