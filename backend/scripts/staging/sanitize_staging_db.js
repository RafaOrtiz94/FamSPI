/**
 * Saneamiento de la base de STAGING despues de restaurarla desde produccion (plan RBAC, Fase 1A).
 *
 * Deja la copia sin forma de alcanzar a personas reales:
 *   - reemplaza todo correo por una direccion ficticia y estable (misma entrada => misma salida,
 *     asi las uniones por correo entre tablas siguen funcionando);
 *   - borra sesiones, tokens de Gmail y de atajos, suscripciones push y tokens de consentimiento;
 *   - borra de la cola de envio lo que quedo pendiente o fallido.
 *
 * Se niega a correr contra produccion o sus relevos. Sin --apply solo cuenta lo que cambiaria.
 *
 * Uso (desde backend/):
 *   STAGING_DATABASE_URL=... node scripts/staging/sanitize_staging_db.js            # simulacion
 *   STAGING_DATABASE_URL=... node scripts/staging/sanitize_staging_db.js --apply
 * Opcional: STAGING_KEEP_EMAILS="a@x.com,b@x.com" conserva esos correos (acceso de TI con Google).
 */
const { Client } = require("pg");

// Misma lista de proyectos de produccion y relevos que usa la guarda de arranque. Nunca son staging.
const { PRODUCTION_DB_HOSTS: FORBIDDEN_HOSTS } = require("../../src/config/stagingGuard");
const EMAIL_COLUMN = "(e_?mail|correo)";
const TABLES_TO_EMPTY = [
  "public.user_sessions",
  "public.user_gmail_tokens",
  "public.attendance_shortcut_tokens",
  "public.notification_push_subscriptions",
  "public.client_request_consent_tokens",
];
const FAKE_EMAIL = (col) => `'u' || substr(md5(lower(${col})), 1, 16) || '@staging.invalid'`;

function assertStagingTarget(url) {
  if (!url) throw new Error("Falta STAGING_DATABASE_URL.");
  const { hostname } = new URL(url);
  if (FORBIDDEN_HOSTS.test(hostname)) {
    throw new Error(`Host ${hostname} pertenece a produccion o a un relevo. Abortado.`);
  }
  if (process.env.DB_HOST && hostname.replace("-pooler", "") === String(process.env.DB_HOST).replace("-pooler", "")) {
    throw new Error("STAGING_DATABASE_URL apunta al mismo host que DB_HOST. Abortado.");
  }
  return hostname;
}

const ident = (name) => `"${String(name).replace(/"/g, '""')}"`;

async function main() {
  const url = process.env.STAGING_DATABASE_URL;
  const hostname = assertStagingTarget(url);
  const apply = process.argv.includes("--apply");
  const keep = String(process.env.STAGING_KEEP_EMAILS || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  const target = new URL(url);
  const client = new Client({
    host: target.hostname,
    port: Number(target.port || 5432),
    user: decodeURIComponent(target.username),
    password: decodeURIComponent(target.password),
    database: target.pathname.slice(1),
    // La instancia local de staging no usa SSL; Neon si.
    ssl: /^(localhost|127.0.0.1)$/.test(target.hostname) ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`Destino: ${hostname} | modo: ${apply ? "APLICAR" : "simulacion"} | correos conservados: ${keep.length}`);

  const { rows: columns } = await client.query(
    `SELECT c.table_schema, c.table_name, c.column_name
       FROM information_schema.columns c
       JOIN information_schema.tables t USING (table_schema, table_name)
      WHERE t.table_type = 'BASE TABLE'
        AND c.table_schema NOT IN ('pg_catalog', 'information_schema')
        AND c.data_type IN ('text', 'character varying')
        AND c.is_generated = 'NEVER'
        AND c.column_name ~* $1
      ORDER BY 1, 2, 3`,
    [EMAIL_COLUMN],
  );

  const report = { emailColumns: columns.length, emailsRewritten: 0, tablesEmptied: {}, queueDeleted: 0, failures: [] };

  await client.query("BEGIN");
  for (const col of columns) {
    const table = `${ident(col.table_schema)}.${ident(col.table_name)}`;
    const column = ident(col.column_name);
    const where = `${column} LIKE '%@%' AND ${column} NOT LIKE '%@staging.invalid' AND NOT (lower(${column}) = ANY($1::text[]))`;
    try {
      await client.query("SAVEPOINT col");
      const result = apply
        ? await client.query(`UPDATE ${table} SET ${column} = ${FAKE_EMAIL(column)} WHERE ${where}`, [keep])
        : await client.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE ${where}`, [keep]);
      report.emailsRewritten += apply ? result.rowCount : result.rows[0].n;
      await client.query("RELEASE SAVEPOINT col");
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT col");
      report.failures.push(`${col.table_schema}.${col.table_name}.${col.column_name}: ${error.message}`);
    }
  }

  for (const table of TABLES_TO_EMPTY) {
    try {
      await client.query("SAVEPOINT tbl");
      const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
      report.tablesEmptied[table] = rows[0].n;
      if (apply) await client.query(`DELETE FROM ${table}`);
      await client.query("RELEASE SAVEPOINT tbl");
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT tbl");
      report.failures.push(`${table}: ${error.message}`);
    }
  }

  try {
    await client.query("SAVEPOINT queue");
    const queueWhere = "status IN ('pending', 'failed')";
    const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM public.notification_dispatch_queue WHERE ${queueWhere}`);
    report.queueDeleted = rows[0].n;
    if (apply) await client.query(`DELETE FROM public.notification_dispatch_queue WHERE ${queueWhere}`);
    await client.query("RELEASE SAVEPOINT queue");
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT queue");
    report.failures.push(`notification_dispatch_queue: ${error.message}`);
  }

  // Las cuentas locales reales (pasantes) llegan con su contrasena de produccion: se invalida.
  // Las cuentas de prueba (username "prueba.*") las crea seed_staging_test_users.js y se respetan.
  try {
    await client.query("SAVEPOINT pwd");
    const pwdWhere = "password_hash IS NOT NULL AND COALESCE(username, '') NOT LIKE 'prueba.%'";
    const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM public.users WHERE ${pwdWhere}`);
    report.passwordsCleared = rows[0].n;
    if (apply) await client.query(`UPDATE public.users SET password_hash = NULL WHERE ${pwdWhere}`);
    await client.query("RELEASE SAVEPOINT pwd");
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT pwd");
    report.failures.push(`users.password_hash: ${error.message}`);
  }

  // Un fallo deja datos reales sin sanear: no se confirma nada a medias.
  if (apply && report.failures.length) {
    await client.query("ROLLBACK");
    console.log(JSON.stringify(report, null, 2));
    throw new Error(`Saneamiento NO aplicado: ${report.failures.length} paso(s) fallaron.`);
  }
  await client.query(apply ? "COMMIT" : "ROLLBACK");

  if (apply) {
    const { rows } = await client.query(
      "SELECT COUNT(*)::int AS n FROM public.users WHERE email NOT LIKE '%@staging.invalid' AND NOT (lower(email) = ANY($1::text[]))",
      [keep],
    );
    report.usersWithRealEmail = rows[0].n;
  }
  await client.end();
  console.log(JSON.stringify(report, null, 2));
  if (apply && report.usersWithRealEmail) throw new Error("Quedaron usuarios con correo real.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error("ERROR:", error.message);
    process.exit(1);
  });
}

module.exports = { assertStagingTarget, FAKE_EMAIL };
