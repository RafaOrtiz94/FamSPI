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

// Crear carpeta logs si no existe
const logDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

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

const appRotateTransport = createRotateTransport("app");
const errorRotateTransport = createRotateTransport("errors", "error");
const httpRotateTransport = createRotateTransport("access");
const auditRotateTransport = createRotateTransport("audit");

const httpFileLogger = createLogger({
  level: "info",
  format: fileFormat,
  transports: [httpRotateTransport],
});

const auditFileLogger = createLogger({
  level: "info",
  format: fileFormat,
  transports: [auditRotateTransport],
});

const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: fileFormat,
  transports: [consoleTransport, appRotateTransport, errorRotateTransport],
  exitOnError: false,
});

// ==========================================================
// ⚙️ Manejadores globales (solo loguea, no cierra servidor)
// ==========================================================
process.on("unhandledRejection", (err) => {
  logger.error("💥 Promesa no manejada", { message: err.message, stack: err.stack });
});
process.on("uncaughtException", (err) => {
  logger.error("💥 Excepción no capturada", { message: err.message, stack: err.stack });
});

// ==========================================================
// 🧱 Atajos personalizados
// ==========================================================
logger.http = (msg, meta = {}) => {
  const payload = { ...meta, channel: "http" };
  httpFileLogger.info(msg, payload);
  logger.info(`[HTTP] ${msg}`, payload);
};
logger.db = (msg, meta = {}) => logger.info(`[DB] ${msg}`, meta);
logger.event = (msg, meta = {}) => logger.info(`[EVENT] ${msg}`, meta);
logger.audit = (msg, meta = {}) => {
  const payload = { ...meta, channel: "audit" };
  auditFileLogger.info(msg, payload);
  logger.info(`[AUDIT] ${msg}`, payload);
};

// ==========================================================
// 🚀 Exportar
// ==========================================================
module.exports = logger;
