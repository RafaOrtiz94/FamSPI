const path = require("path");
const logger = require("../config/logger");

const DEFAULT_KEY_FILE = "dashboard-spi-3d9bca86a1bb.json";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function extractEmail(value = "") {
  if (!value) return "";
  const trimmed = String(value).trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match ? match[1] : trimmed).trim();
}

const rawSubject = process.env.GOOGLE_SUBJECT
  ? process.env.GOOGLE_SUBJECT.trim()
  : "";

let googleDelegatedUser = null;

if (!rawSubject) {
  logger.info(
    "GOOGLE_SUBJECT no definido; se usará la service account directamente para Google APIs."
  );
} else if (!emailRegex.test(rawSubject)) {
  logger.warn(
    `GOOGLE_SUBJECT inválido ("${rawSubject}"), se ignorará la delegación de dominio.`
  );
} else {
  googleDelegatedUser = rawSubject;
  logger.info(`GOOGLE_SUBJECT configurado → ${googleDelegatedUser}`);
}

const googleKeyPath = process.env.GSA_KEY_PATH
  ? path.resolve(process.env.GSA_KEY_PATH)
  : path.join(__dirname, "../data", DEFAULT_KEY_FILE);

function resolveDelegatedUser(candidateEmail) {
  const email = extractEmail(candidateEmail);
  if (email && emailRegex.test(email)) {
    return email;
  }
  return googleDelegatedUser;
}

module.exports = {
  googleDelegatedUser,
  googleKeyPath,
  hasGoogleDelegation: Boolean(googleDelegatedUser),
  resolveDelegatedUser,
  extractEmail,
  isValidDelegatedEmail: (value) => emailRegex.test(extractEmail(value)),
};
