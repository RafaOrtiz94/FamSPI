// src/config/google.js

const { google } = require("googleapis");
const logger = require("./logger");
const {
  googleDelegatedUser,
  googleKeyPath,
} = require("../utils/googleCredentials");

// ===============================================================
// 🔐 Cargar clave JSON de la Service Account
// ===============================================================
let key;
try {
  key = require(googleKeyPath);
} catch (err) {
  logger.error("❌ No se pudo cargar la clave de la Service Account:", err.message);
  throw err;
}

// ===============================================================
// 📌 Scopes permitidos en tu dominio Workspace (actualizado)
// ===============================================================
const scopes = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.metadata",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar", // 👈 agregado correctamente
];

// ===============================================================
// 👤 Impersonación obligatoria (Domain-wide Delegation)
// ===============================================================
if (!googleDelegatedUser) {
  logger.error(`
❌ ERROR FATAL: No se definió GOOGLE_SUBJECT en el archivo .env

Debes agregar por ejemplo:

GOOGLE_SUBJECT=automatizaciones@famproject.com.ec

`);
  process.exit(1);
}

const jwtClient = new google.auth.JWT({
  email: key.client_email,
  key: key.private_key.replace(/\\n/g, "\n"), // versión correcta
  scopes,
  subject: googleDelegatedUser,
});

// ===============================================================
// 🔧 Clientes Google API
// ===============================================================

function createDelegatedJwtClient(subject) {
  return new google.auth.JWT({
    email: key.client_email,
    key: key.private_key.replace(/\\n/g, "\n"),
    scopes,
    subject,
  });
}

const drive = google.drive({ version: "v3", auth: jwtClient });
const docs = google.docs({ version: "v1", auth: jwtClient });
const gmail = google.gmail({ version: "v1", auth: jwtClient });
const calendar = google.calendar({ version: "v3", auth: jwtClient });

// ===============================================================
// 🧪 Test opcional
// ===============================================================
async function testGoogleAuth() {
  try {
    const res = await drive.files.list({ pageSize: 1 });
    logger.info(`✅ Google Drive OK → ${res.data.files?.[0]?.name || "sin archivos"}`);
  } catch (error) {
    logger.error("❌ Error autenticando Google:", error.response?.data || error.message);
  }
}

if (process.env.ENABLE_GOOGLE_SELF_TEST === "true") {
  testGoogleAuth();
} else {
  logger.info("🔕 testGoogleAuth deshabilitado");
}

module.exports = { drive, docs, gmail, calendar, jwtClient, createDelegatedJwtClient };
