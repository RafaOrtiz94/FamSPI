const fs = require("fs");
const { google } = require("googleapis");
const logger = require("./logger");
const { googleDelegatedUser, googleKeyPath } = require("../utils/googleCredentials");

let key = null;
try {
  if (process.env.GSA_KEY_JSON) {
    key = JSON.parse(process.env.GSA_KEY_JSON);
    logger.info("Credencial de Service Account cargada desde GSA_KEY_JSON");
  } else if (process.env.GSA_KEY_JSON_BASE64) {
    key = JSON.parse(Buffer.from(process.env.GSA_KEY_JSON_BASE64, "base64").toString("utf8"));
    logger.info("Credencial de Service Account cargada desde GSA_KEY_JSON_BASE64");
  } else if (googleKeyPath && fs.existsSync(googleKeyPath)) {
    key = require(googleKeyPath);
    logger.info("Credencial de Service Account cargada desde archivo", { path: googleKeyPath });
  } else {
    logger.warn(
      "No se encontro credencial de Service Account. Las funcionalidades de Google quedaran deshabilitadas.",
      { path: googleKeyPath || null }
    );
  }
} catch (err) {
  logger.warn(
    "No se pudo cargar la credencial de Service Account. Las funcionalidades de Google quedaran deshabilitadas.",
    { path: googleKeyPath || null, error: err.message }
  );
}

const scopes = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.metadata",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar",
];

if (!googleDelegatedUser) {
  logger.warn("GOOGLE_SUBJECT no definido. La delegacion de dominio para Google APIs no funcionara.");
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
    logger.info("Google JWT Client inicializado correctamente");
  } catch (err) {
    logger.error("Error inicializando Google JWT Client:", err.message);
  }
} else {
  logger.warn("Google JWT Client no inicializado; faltan credenciales o subject");
}

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

async function testGoogleAuth() {
  try {
    const res = await drive.files.list({ pageSize: 1 });
    logger.info(`Google Drive OK -> ${res.data.files?.[0]?.name || "sin archivos"}`);
  } catch (error) {
    logger.error("Error autenticando Google:", error.response?.data || error.message);
  }
}

if (process.env.ENABLE_GOOGLE_SELF_TEST === "true") {
  testGoogleAuth();
} else {
  logger.info("testGoogleAuth deshabilitado");
}

module.exports = { drive, docs, gmail, calendar, sheets, jwtClient, createDelegatedJwtClient };
