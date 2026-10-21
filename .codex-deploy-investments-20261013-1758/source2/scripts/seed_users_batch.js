/**
 * seed_users_batch.js
 * Inserta usuarios nuevos en la BD. Omite duplicados por email (ON CONFLICT DO NOTHING).
 * Rol queda como "pendiente" para que admin los configure en la UI.
 *
 * Uso:
 *   $env:DB_PASSWORD="..."; node backend/scripts/seed_users_batch.js
 */
const { Client } = require("pg");

const USERS = [
  { fullname: "Aura Jiménez",         email: "aura.jimenez@fam-project.com" },
  { fullname: "Daniel Fiallos",       email: "daniel.fiallos@fam-project.com" },
  { fullname: "Ilsy Ramirez",         email: "ilsy.ramirez@fam-project.com" },
  { fullname: "Kevin Loor",           email: "kevin.loor@fam-project.com" },
  { fullname: "Lizbeth Rivadeneira",  email: "lizbeth.rivadeneira@fam-project.com" },
  { fullname: "Luisao Escobar",       email: "luisao.escobar@fam-project.com" },
];

const DB_HOST     = process.env.DB_HOST     || "ep-wispy-moon-aqszgsal-pooler.c-8.us-east-1.aws.neon.tech";
const DB_PORT     = Number(process.env.DB_PORT || 5432);
const DB_USER     = process.env.DB_USER     || "neondb_owner";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME     = process.env.DB_NAME     || "FamSPI";

const client = new Client({
  host: DB_HOST, port: DB_PORT, user: DB_USER,
  password: DB_PASSWORD, database: DB_NAME,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log(`[seed_users] Conectado a ${DB_HOST}/${DB_NAME}`);

  let inserted = 0;
  let skipped  = 0;

  for (const u of USERS) {
    const { rowCount } = await client.query(
      `INSERT INTO users (email, fullname, role, active, created_at)
       VALUES ($1, $2, 'pendiente', true, NOW())
       ON CONFLICT (email) DO NOTHING`,
      [u.email.toLowerCase().trim(), u.fullname.trim()]
    );
    if (rowCount > 0) {
      console.log(`  ✅ Insertado: ${u.fullname} <${u.email}>`);
      inserted++;
    } else {
      console.log(`  ⚠️  Ya existe: ${u.email} (omitido)`);
      skipped++;
    }
  }

  console.log(`\n[seed_users] Listo — ${inserted} insertados, ${skipped} ya existían.`);
  await client.end();
}

run().catch((err) => {
  console.error("[seed_users] ERROR:", err.message);
  client.end().catch(() => {});
  process.exit(1);
});
