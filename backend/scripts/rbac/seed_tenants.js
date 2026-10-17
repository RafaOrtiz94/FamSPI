/**
 * Empresa por defecto y empresa de prueba (plan RBAC, enfoque SaaS, paso 2). Solo la base LOCAL de staging.
 *
 * - Crea la empresa por defecto y hace miembros a todos los usuarios. No cambia ninguna otra fila: las asignaciones,
 *   grants y roles existentes conservan tenant_id NULL (visibles para todas las empresas), asi que encender
 *   RBAC_TENANT_MODE con una sola empresa no cambia ningun resultado.
 * - Con --test-tenant crea una segunda empresa con dos cuentas de prueba para verificar el aislamiento:
 *   prueba.admin_b (rol admin_ti, administra su empresa) y prueba.vendedor_b (rol comercial).
 *
 * Idempotente. Uso (desde backend/):
 *   STAGING_DATABASE_URL=postgresql://... STAGING_TEST_PASSWORD=... node scripts/rbac/seed_tenants.js [--test-tenant]
 * El nombre de la empresa por defecto sale de RBAC_DEFAULT_TENANT_NAME (por defecto "Empresa principal").
 */
const { Client } = require("pg");
const bcrypt = require("bcryptjs");
const { assertStagingTarget } = require("../staging/sanitize_staging_db");

const DEFAULT_SLUG = "principal";
const TEST_SLUG = "empresa-b";

async function upsertTenant(client, slug, name) {
  const { rows } = await client.query(
    `INSERT INTO public.tenants (slug, name) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW() RETURNING id`, [slug, name]);
  return rows[0].id;
}

async function upsertTestUser(client, { username, role, templateUsername, passwordHash }) {
  const template = (await client.query(
    "SELECT department_id, lopdp_internal_status FROM public.users WHERE LOWER(username) = LOWER($1)", [templateUsername])).rows[0];
  if (!template) throw new Error(`Falta la cuenta plantilla ${templateUsername}: corre antes seed_staging_test_users.js.`);
  const values = [username, `${username}@staging.invalid`, `Prueba ${username.replace("prueba.", "").replace(/_/g, " ")}`, role, template.department_id, template.lopdp_internal_status, passwordHash];
  const existing = await client.query("SELECT id FROM public.users WHERE LOWER(username) = LOWER($1)", [username]);
  if (existing.rows[0]) {
    await client.query(
      `UPDATE public.users SET username = $1, email = $2, fullname = $3, name = $3, role = $4, department_id = $5, lopdp_internal_status = $6,
              password_hash = $7, auth_provider = 'local', must_change_password = false, account_expires_at = NULL, active = true, updated_at = NOW()
        WHERE id = $8`, [...values, existing.rows[0].id]);
    return existing.rows[0].id;
  }
  const inserted = await client.query(
    `INSERT INTO public.users (username, email, fullname, name, role, department_id, lopdp_internal_status, password_hash, auth_provider, must_change_password, active)
     VALUES ($1, $2, $3, $3, $4, $5, $6, $7, 'local', false, true) RETURNING id`, values);
  return inserted.rows[0].id;
}

async function main() {
  const url = process.env.STAGING_DATABASE_URL;
  const hostname = assertStagingTarget(url);
  if (!/^(localhost|127\.0\.0\.1)$/.test(hostname)) throw new Error("Solo siembra la base local de staging.");
  const withTest = process.argv.includes("--test-tenant");
  const target = new URL(url);
  const client = new Client({
    host: target.hostname, port: Number(target.port || 5432), user: decodeURIComponent(target.username),
    password: decodeURIComponent(target.password), database: target.pathname.slice(1), ssl: false,
  });
  await client.connect();
  try {
    await client.query("BEGIN");
    const defaultId = await upsertTenant(client, DEFAULT_SLUG, process.env.RBAC_DEFAULT_TENANT_NAME || "Empresa principal");
    // Todos los usuarios que aun no son miembros de ninguna empresa pasan a la empresa por defecto.
    const members = await client.query(
      `INSERT INTO public.tenant_memberships (tenant_id, user_id, is_default)
       SELECT $1, u.id, TRUE FROM public.users u
        WHERE NOT EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.user_id = u.id)
       ON CONFLICT DO NOTHING`, [defaultId]);

    let testInfo = null;
    if (withTest) {
      const password = String(process.env.STAGING_TEST_PASSWORD || "");
      if (password.length < 12) throw new Error("STAGING_TEST_PASSWORD debe tener al menos 12 caracteres.");
      const passwordHash = await bcrypt.hash(password, 11);
      const testId = await upsertTenant(client, TEST_SLUG, "Empresa B (pruebas)");
      const admin = await upsertTestUser(client, { username: "prueba.admin_b", role: "admin_ti", templateUsername: "prueba.jefe_ti", passwordHash });
      const seller = await upsertTestUser(client, { username: "prueba.vendedor_b", role: "comercial", templateUsername: "prueba.comercial", passwordHash });
      for (const userId of [admin, seller]) {
        await client.query("DELETE FROM public.tenant_memberships WHERE user_id = $1 AND tenant_id <> $2", [userId, testId]);
        await client.query(
          `INSERT INTO public.tenant_memberships (tenant_id, user_id, is_default) VALUES ($1, $2, TRUE)
           ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'active', is_default = TRUE, updated_at = NOW()`, [testId, userId]);
      }
      testInfo = { tenantId: testId, admin, seller };
    }
    await client.query("COMMIT");

    const counts = (await client.query(
      `SELECT t.slug, COUNT(m.*)::int AS members FROM public.tenants t LEFT JOIN public.tenant_memberships m ON m.tenant_id = t.id AND m.status = 'active' GROUP BY t.slug ORDER BY t.slug`)).rows;
    console.log(JSON.stringify({ defaultTenantId: defaultId, newMemberships: members.rowCount, tenants: counts, testTenant: testInfo }));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error.message); process.exit(1); });
