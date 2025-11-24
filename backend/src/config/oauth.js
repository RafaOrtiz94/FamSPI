const { google } = require("googleapis");
require("dotenv").config();

// Cliente OAuth2 compartido para login Y Gmail
// IMPORTANTE: La redirect_uri debe estar registrada en Google Cloud Console
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/v1/auth/google/callback"
);

module.exports = { google, oauth2Client };
