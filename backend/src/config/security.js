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

const FRONTEND_URL = (process.env.FRONTEND_URL || "https://fam-spi-front.web.app").replace(/\/$/, "");

const ORIGIN_WHITELIST = new Set([
  FRONTEND_URL,
  "https://fam-spi-front.web.app",
  "https://fam-spi-front.firebaseapp.com",
  "https://spi-dev.famproject.com.ec",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
]);

/* ============================================================
   🌐 Configuración CORS (cross-origin)
============================================================ */
const corsConfig = {
  origin: (origin, callback) => {
    // ✅ Permitir si no hay origin (peticiones no-browser o herramientas)
    if (!origin) return callback(null, true);

    if (ORIGIN_WHITELIST.has(origin)) {
      return callback(null, true);
    } else {
      console.warn(`❌ CORS bloqueado en security.js: Dominio "${origin}" no está en el Set.`);
      return callback(new Error(`CORS: Origen [${origin}] no autorizado`));
    }
  },
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-refresh-token",
    "X-Requested-With",
    "Accept",
    "x-flow-id",
    "Idempotency-Key",
    "idempotency-key",
    "x-idempotency-key",
    "If-Match",
    "if-match",
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
