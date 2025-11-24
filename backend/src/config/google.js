// src/config/google.js
const { google } = require("googleapis");
const logger = require("./logger");
const {
  googleDelegatedUser,
  googleKeyPath,
  hasGoogleDelegation,
} = require("../utils/googleCredentials");

// ===============================================================
// 🔐 Autenticación con cuenta de servicio + delegación de dominio
// ===============================================================
let key;
try {
  key = require(googleKeyPath);
} catch (err) {
  logger.error("❌ No se pudo cargar la clave de la Service Account:", err.message);
  throw err;
}

const scopes = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.send",
];

const jwtOptions = {
  email: process.env.GMAIL_SERVICE_ACCOUNT_CLIENT_EMAIL || key.client_email,
  key: key.private_key,
  scopes,
};

if (hasGoogleDelegation) {
  jwtOptions.subject = googleDelegatedUser; // Impersonación dominio
} else {
  logger.info(
    "Google APIs sin delegación: asegúrate de compartir los recursos con la Service Account."
  );
}

const jwtClient = new google.auth.JWT(jwtOptions);

/**
 * Crea un cliente JWT clonado con el mismo key + scopes pero sujeto dinámico.
 * Útil para delegar a distintos remitentes en Gmail API sin reinstanciar todo
 * el módulo de configuración.
 */
function createDelegatedJwtClient(subject) {
  return new google.auth.JWT({ ...jwtOptions, subject });
}

const drive = google.drive({ version: "v3", auth: jwtClient });
const docs = google.docs({ version: "v1", auth: jwtClient });
const calendar = google.calendar({ version: "v3", auth: jwtClient });
const gmail = google.gmail({ version: "v1", auth: jwtClient });

// ===============================================================
// 🧪 Función de prueba rápida de autenticación
// ===============================================================
async function testGoogleAuth() {
  try {
    const res = await drive.files.list({ pageSize: 1, supportsAllDrives: true });
    logger.info("✅ Conexión Drive OK →", res.data.files?.[0]?.name || "sin archivos");
  } catch (error) {
    logger.error("❌ Error autenticando con Google APIs:", error.message);
    const detail =
      error.response?.data?.error_description ||
      error.response?.data?.error?.message ||
      error.message;
    if (detail) {
      logger.error("ℹ️ Detalle:", detail);
    }
  }
}

if (process.env.ENABLE_GOOGLE_SELF_TEST === "true") {
  testGoogleAuth().catch((error) =>
    logger.warn("⚠️ testGoogleAuth falló:", error.message)
  );
} else {
  logger.info(
    "🔕 testGoogleAuth deshabilitado (define ENABLE_GOOGLE_SELF_TEST=true para ejecutarlo en el arranque)"
  );
}

module.exports = { drive, docs, calendar, gmail, jwtClient, createDelegatedJwtClient };
