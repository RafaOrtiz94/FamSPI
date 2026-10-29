/**
 * Crea en STAGING una cuenta de prueba por cada rol vigente (plan RBAC, Fase 1A).
 *
 * Entran por el mismo acceso local que usan los pasantes (usuario y contrasena, sin Google):
 * boton "Acceso pasantes" del login -> POST /api/v1/auth/local-login. No requiere cambios en
 * autenticacion: ese endpoint acepta cualquier rol con auth_provider='local'.
 *
 * Cada cuenta "prueba.<rol>" copia el departamento y el acceso a modulos del usuario activo mas
 * antiguo de ese rol, para comportarse como un usuario real de ese rol. No copia extra_roles.
 * Es idempotente: volver a ejecutarlo actualiza las cuentas y su contrasena.
 *
 * Uso (desde backend/):
 *   STAGING_DATABASE_URL=... STAGING_TEST_PASSWORD=... node scripts/staging/seed_staging_test_users.js
 */
const { Client } = require("pg");
const bcrypt = require("bcryptjs");
const { assertStagingTarget } = require("./sanitize_staging_db");

const NOT_REAL_ROLES = ["null", "pending", "pendiente"];
const MIN_PASSWORD_LENGTH = 12;

async function main() {
  const url = process.env.STAGING_DATABASE_URL;
  const hostname = assertStagingTarget(url);
  const password = String(process.env.STAGING_TEST_PASSWORD || "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`STAGING_TEST_PASSWORD debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

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
  const passwordHash = await bcrypt.hash(password, 11);

  // Plantilla por rol: el usuario activo mas antiguo que no sea una cuenta de prueba. Se exige
  // correo saneado porque las cuentas reales de TI conservadas en staging cambian de rol para
  // probar accesos y no representan a su rol.
  const { rows: templates } = await client.query(
    `SELECT DISTINCT ON (role) role, id, department_id, lopdp_internal_status
       FROM public.users
      WHERE COALESCE(active, true) AND role IS NOT NULL AND NOT (role = ANY($1::text[]))
        AND COALESCE(username, '') NOT LIKE 'prueba.%'
        AND email LIKE '%@staging.invalid'
      ORDER BY role, id`,
    [NOT_REAL_ROLES],
  );

  const { rows: accessColumns } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_module_access'
        AND column_name NOT IN ('id', 'user_id')
        AND column_default IS DISTINCT FROM 'now()' AND is_generated = 'NEVER'`,
  );
  const copied = accessColumns.map((row) => `"${row.column_name}"`).join(", ");

  const created = [];
  await client.query("BEGIN");
  try {
    for (const template of templates) {
      const username = `prueba.${template.role}`;
      const fullname = `Prueba ${template.role.replace(/_/g, " ")}`;
      const values = [
        username,
        `${username}@staging.invalid`,
        fullname,
        template.role,
        template.department_id,
        template.lopdp_internal_status,
        passwordHash,
      ];
      const existing = await client.query("SELECT id FROM public.users WHERE LOWER(username) = LOWER($1)", [username]);
      let userId = existing.rows[0]?.id;
      if (userId) {
        await client.query(
          `UPDATE public.users
              SET username = $1, email = $2, fullname = $3, name = $3, role = $4, department_id = $5, lopdp_internal_status = $6,
                  password_hash = $7, auth_provider = 'local', must_change_password = false,
                  account_expires_at = NULL, active = true, extra_roles = DEFAULT, updated_at = NOW()
            WHERE id = $8`,
          [...values, userId],
        );
      } else {
        const inserted = await client.query(
          `INSERT INTO public.users
             (username, email, fullname, name, role, department_id, lopdp_internal_status,
              password_hash, auth_provider, must_change_password, active)
           VALUES ($1, $2, $3, $3, $4, $5, $6, $7, 'local', false, true)
           RETURNING id`,
          values,
        );
        userId = inserted.rows[0].id;
      }

      await client.query("DELETE FROM public.user_module_access WHERE user_id = $1", [userId]);
      const access = await client.query(
        `INSERT INTO public.user_module_access (user_id, ${copied})
         SELECT $1, ${copied} FROM public.user_module_access WHERE user_id = $2`,
        [userId, template.id],
      );
      created.push({ username, role: template.role, templateUserId: template.id, moduleAccessRows: access.rowCount });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  console.log(`Destino: ${hostname} | cuentas de prueba: ${created.length}`);
  console.table(created);
}

main().catch((error) => {
  console.error("ERROR:", error.message);
  process.exit(1);
});
