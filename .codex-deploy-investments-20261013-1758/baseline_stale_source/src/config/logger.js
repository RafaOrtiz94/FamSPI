/**
 * src/config/logger.js
 * ---------------------------------------------------------
 * 🧠 Logger central del sistema SPI Fam
 * ---------------------------------------------------------
 * - Winston con formato elegante y rotación diaria
 * - Manejo de errores no capturados
 * - Compatible con PM2, Docker y entornos distribuidos
 */

const path = require("path");
const fs = require("fs");
const { createLogger, format, transports } = require("winston");
require("winston-daily-rotate-file");

// Crear carpeta logs si no existe (solo si no es producción para evitar problemas en Cloud Run)
const isProd = process.env.NODE_ENV === "production";
const logDir = path.join("/tmp", "logs");

if (!isProd && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaData =
      Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : "";
    return `${timestamp} ${level}: ${message}${metaData}`;
  })
);

const fileFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
);

const createRotateTransport = (name, level = "info") =>
  new transports.DailyRotateFile({
    filename: path.join(logDir, `${name}-%DATE%.log`),
    datePattern: "YYYY-MM-DD",
    maxFiles: "45d",
    maxSize: "20m",
    zippedArchive: true,
    level,
    format: fileFormat,
  });

const consoleTransport = new transports.Console({
  handleExceptions: true,
  handleRejections: true,
  format: consoleFormat,
});

// En producción para Cloud Run, solo usamos consola (stdout/stderr)
const transportsList = [consoleTransport];

if (!isProd) {
  transportsList.push(createRotateTransport("app"));
  transportsList.push(createRotateTransport("errors", "error"));
}

const logger = createLogger({
  level: isProd ? "info" : "debug",
  format: fileFormat,
  transports: transportsList,
  exitOnError: false,
});

// ==========================================================
// ⚙️ Manejadores globales (CRÍTICO: en producción deben salir para que Cloud Run reinicie)
// ==========================================================
process.on("unhandledRejection", (err) => {
  logger.error("💥 Promesa no manejada", { message: err.message, stack: err.stack });
  if (isProd) {
    logger.error("🛑 Saliendo por promesa no manejada en producción");
    setTimeout(() => process.exit(1), 500).unref();
  }
});

process.on("uncaughtException", (err) => {
  logger.error("💥 Excepción no capturada", { message: err.message, stack: err.stack });
  if (isProd) {
    logger.error("🛑 Saliendo por excepción no capturada en producción");
    setTimeout(() => process.exit(1), 500).unref();
  }
});

// ==========================================================
// 🧱 Atajos personalizados
// ==========================================================
logger.http = (msg, meta = {}) => {
  const payload = { ...meta, channel: "http" };
  logger.info(`[HTTP] ${msg}`, payload);
};
logger.db = (msg, meta = {}) => logger.info(`[DB] ${msg}`, meta);
logger.event = (msg, meta = {}) => logger.info(`[EVENT] ${msg}`, meta);
logger.audit = (msg, meta = {}) => {
  const payload = { ...meta, channel: "audit" };
  logger.info(`[AUDIT] ${msg}`, payload);
};

// ==========================================================
// 🚀 Exportar
// ==========================================================
module.exports = logger;
