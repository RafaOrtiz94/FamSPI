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
const fs = require("fs");
let key = null;
try {
  if (fs.existsSync(googleKeyPath)) {
    key = require(googleKeyPath);
  } else {
    logger.warn("⚠️ Archivo de clave de Service Account no encontrado. Las funcionalidades de Google (Drive, Gmail, etc.) estarán deshabilitadas.", { path: googleKeyPath });
  }
} catch (err) {
  logger.warn("⚠️ No se pudo cargar la clave de la Service Account. Las funcionalidades de Google (Drive, Gmail, etc.) estarán deshabilitadas.", { path: googleKeyPath, error: err.message });
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
  "https://www.googleapis.com/auth/calendar",
];

// ===============================================================
// 👤 Impersonación obligatoria (Domain-wide Delegation)
// ===============================================================
if (!googleDelegatedUser) {
  logger.warn("⚠️ GOOGLE_SUBJECT no definido. La delegación de dominio para Google APIs no funcionará.");
}

let jwtClient = null;
if (key && googleDelegatedUser) {
  try {
    jwtClient = new google.auth.JWT({
      email: key.client_email,
      key: key.private_key.replace(/\\n/g, "\n"),
      scopes,
      subject: googleDelegatedUser,
    });
    logger.info("✅ Google JWT Client inicializado correctamente");
  } catch (err) {
    logger.error("❌ Error inicializando Google JWT Client:", err.message);
  }
} else {
  logger.warn("⏸️ Google JWT Client NO inicializado (faltan credenciales o subject)");
}

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
const sheets = google.sheets({ version: "v4", auth: jwtClient });

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

module.exports = { drive, docs, gmail, calendar, sheets, jwtClient, createDelegatedJwtClient };
