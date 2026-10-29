/**
 * sync_google_ids.js
 * Consulta Google Workspace Admin SDK para obtener el google_id (sub)
 * de cada usuario por email y lo actualiza en la tabla users.
 *
 * Requiere que la Service Account tenga delegación de dominio con el scope:
 *   https://www.googleapis.com/auth/admin.directory.user.readonly
 *
 * Uso:
 *   $env:DB_PASSWORD="..."; $env:GSA_KEY_JSON='...'; $env:GOOGLE_SUBJECT="admin@fam-project.com"
 *   node backend/scripts/sync_google_ids.js
 */

const { Client } = require("pg");
const { google } = require("googleapis");

const EMAILS = [
  "aura.jimenez@fam-project.com",
  "daniel.fiallos@fam-project.com",
  "ilsy.ramirez@fam-project.com",
  "kevin.loor@fam-project.com",
  "lizbeth.rivadeneira@fam-project.com",
  "luisao.escobar@fam-project.com",
];

// ─── Google Admin SDK client ─────────────────────────────────────────────────
function buildAdminClient() {
  let key = null;
  if (process.env.GSA_KEY_JSON) {
    key = JSON.parse(process.env.GSA_KEY_JSON);
  } else if (process.env.GSA_KEY_JSON_BASE64) {
    key = JSON.parse(Buffer.from(process.env.GSA_KEY_JSON_BASE64, "base64").toString("utf8"));
  } else {
    throw new Error("GSA_KEY_JSON o GSA_KEY_JSON_BASE64 no definidos");
  }

  const subject = process.env.GOOGLE_SUBJECT || process.env.GOOGLE_DELEGATED_USER;
  if (!subject) throw new Error("GOOGLE_SUBJECT no definido (debe ser un admin del workspace)");

  const jwtClient = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/admin.directory.user.readonly"],
    subject,
  });

  return google.admin({ version: "directory_v1", auth: jwtClient });
}

// ─── DB client ───────────────────────────────────────────────────────────────
const dbClient = new Client({
  host:     process.env.DB_HOST     || "ep-wispy-moon-aqszgsal-pooler.c-8.us-east-1.aws.neon.tech",
  port:     Number(process.env.DB_PORT || 5432),
  user:     process.env.DB_USER     || "neondb_owner",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "FamSPI",
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await dbClient.connect();
  console.log("[sync_google_ids] DB conectada");

  const admin = buildAdminClient();
  console.log("[sync_google_ids] Admin SDK inicializado\n");

  let updated = 0;
  let notFound = 0;

  for (const email of EMAILS) {
    try {
      const { data } = await admin.users.get({
        userKey: email,
        fields: "id,primaryEmail,name",
      });

      const googleId = data.id;
      const displayName = data.name?.fullName || email;

      const { rowCount } = await dbClient.query(
        `UPDATE users SET google_id = $1 WHERE LOWER(email) = LOWER($2) AND (google_id IS NULL OR google_id <> $1)`,
        [googleId, email]
      );

      if (rowCount > 0) {
        console.log(`  ✅ ${displayName} <${email}> → google_id: ${googleId}`);
        updated++;
      } else {
        console.log(`  ℹ️  ${email} — ya tenía google_id correcto, sin cambios`);
      }
    } catch (err) {
      const status = err?.response?.status || err?.code;
      if (status === 404) {
        console.log(`  ⚠️  ${email} — NO encontrado en Google Workspace`);
        notFound++;
      } else {
        console.error(`  ❌ ${email} — Error ${status}: ${err?.response?.data?.error?.message || err.message}`);
        notFound++;
      }
    }
  }

  console.log(`\n[sync_google_ids] Listo — ${updated} actualizados, ${notFound} no encontrados/errores`);
  await dbClient.end();
}

run().catch((err) => {
  console.error("[sync_google_ids] FATAL:", err.message);
  dbClient.end().catch(() => {});
  process.exit(1);
});
