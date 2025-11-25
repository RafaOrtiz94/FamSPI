/**
 * src/server.js
 * ------------------------------------------------------------
 * 🚀 Entry point SPI Fam Backend
 * - Manejo de errores globales
 * - Logs estructurados
 * - Cierre limpio en SIGINT / SIGTERM
 */

require("dotenv").config();

const app = require("./app");
const logger = require("./config/logger");
const { checkDbSchema } = require("./utils/dbHealth");
const { startReminderScheduler } = require("./modules/mantenimientos/mantenimiento.scheduler");
const startExpiredReservationsJob = require("./jobs/checkExpiredReservations");

const PORT = process.env.PORT || 4000;
const ENV = process.env.NODE_ENV || "development";

const server = app.listen(PORT, () => {
  logger.info(`✅ Server iniciado en puerto ${PORT} [${ENV}]`);
  checkDbSchema().catch((err) => {
    logger.error({ err }, "❌ Falló la verificación de tablas críticas");
  });
  startReminderScheduler();
  startExpiredReservationsJob();
});

// ======================================================
// 🧹 Helper de cierre limpio
// ======================================================
const shutDown = (reason, exitCode = 0) => {
  logger.info(`🧹 Apagando servidor por: ${reason}`);
  if (server && server.close) {
    server.close(() => {
      logger.info("✅ Servidor cerrado correctamente");
      process.exit(exitCode);
    });
  } else {
    process.exit(exitCode);
  }
};

// ======================================================
// ⚠️ Manejo de errores no controlados
// ======================================================
process.on("unhandledRejection", (err) => {
  logger.error("💥 Promesa no manejada:", err);
  console.error(err);
  shutDown("unhandledRejection", 1);
});

process.on("uncaughtException", (err) => {
  logger.error("💥 Excepción no capturada:", err);
  console.error(err);
  shutDown("uncaughtException", 1);
});

// ======================================================
// 🧹 Cierre limpio (Docker / PM2 / Ctrl+C)
// ======================================================
process.on("SIGINT", () => {
  logger.info("🧹 Señal recibida: SIGINT");
  shutDown("SIGINT", 0);
});

process.on("SIGTERM", () => {
  logger.info("🧹 Señal recibida: SIGTERM");
  shutDown("SIGTERM", 0);
});
