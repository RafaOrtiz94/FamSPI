/**
 * src/config/security.js
 * ------------------------------------------------------------
 * Seguridad global SPI Fam
 * - Sin cookies (solo headers con JWT)
 * - Configuración adaptable a entorno
 * - Incluye políticas CORS y Helmet seguras
 */

const isProd = process.env.NODE_ENV === "production";

/* ============================================================
   🧱 Configuración Helmet (cabeceras HTTP seguras)
============================================================ */
const helmetConfig = {
  contentSecurityPolicy: false, // 🔧 Desactivado por compatibilidad con OAuth y React
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  referrerPolicy: { policy: "no-referrer" },
};

/* ============================================================
   🌐 Configuración CORS (cross-origin)
============================================================ */
const corsConfig = {
  origin: [
    process.env.FRONTEND_URL,     // dominio del front (React)
    "http://localhost:3001",      // entorno local de desarrollo
  ],
  credentials: true,              // permite enviar encabezados como Authorization
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-refresh-token",
    "X-Requested-With",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};

/* ============================================================
   🧩 Exportación
============================================================ */
module.exports = {
  isProd,
  helmetConfig,
  corsConfig,
};
