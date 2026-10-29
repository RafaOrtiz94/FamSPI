/**
 * Siembra el catalogo central de RBAC (plan RBAC, Fase 3) en la base local de STAGING.
 *
 * Todo se deriva del codigo y de los datos existentes, no se inventa:
 *  - modules: el catalogo de modulos del backend.
 *  - roles / permissions / role_permissions / rbac_endpoint_permissions: de las guardas actuales (buildCatalog).
 *  - user_role_assignments: de users.role, del scope que el login deriva de ese rol y de users.extra_roles.
 * Los usuarios con rol invalido (`pending`, `"null"`, vacio) NO se convierten: se listan en el informe.
 *
 * Solo toca lo generado desde el codigo (roles de sistema, permisos "[generado]", asignaciones heredadas):
 * los roles personalizados del constructor de roles, sus permisos y las asignaciones manuales se conservan.
 *
 * Es idempotente. Sin --apply solo calcula y muestra el resultado. Se niega a correr fuera de localhost.
 *
 * Uso (desde backend/):
 *   STAGING_DATABASE_URL=postgresql://... node scripts/rbac/seed_rbac_catalog.js [--apply]
 * Salida: docs/plans/rbac-inventory/catalogo-central-informe.md
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { assertStagingTarget } = require("../staging/sanitize_staging_db");
const { buildCatalog, GENERATED_PREFIX } = require("../../src/security/authorization/centralModel");
const { PERMISSION_ROLE_MAP } = require("../../src/security/authorization/authorization");
const { deriveInheritedRoles } = require("../../src/security/authorization/inheritedAssignments");

const DOCS = path.join(__dirname, "..", "..", "..", "docs", "plans", "rbac-inventory");

const moduleCatalog = () => {
  const text = fs.readFileSync(path.join(__dirname, "..", "..", "src", "modules", "module-access", "moduleAccess.service.js"), "utf8");
  return [...text.matchAll(/\{\s*key:\s*"([^"]+)",\s*label:\s*"([^"]*)"/g)].map((match) => ({ key: match[1], label: match[2] }));
};

async function main() {
  const url = process.env.STAGING_DATABASE_URL;
  const hostname = assertStagingTarget(url);
  if (!/^(localhost|127\.0\.0\.1)$/.test(hostname)) throw new Error("Esta version solo siembra la base local de staging.");
  const apply = process.argv.includes("--apply");
  // Se carga despues de validar el destino: auth.controller trae dotenv, que define DB_HOST.
  const { deriveScope } = require("./roleScope");

  const inventory = JSON.parse(fs.readFileSync(path.join(DOCS, "backend-endpoints.json"), "utf8")).endpoints;
  const registry = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "src", "security", "authorization", "apiModuleRegistry.data.json"), "utf8"));
  const modules = moduleCatalog();
  const catalog = buildCatalog(inventory, { registry, moduleKeys: modules.map((m) => m.key), namedPermissions: PERMISSION_ROLE_MAP });

  const target = new URL(url);
  const client = new Client({
    host: target.hostname, port: Number(target.port || 5432), user: decodeURIComponent(target.username),
    password: decodeURIComponent(target.password), database: target.pathname.slice(1), ssl: false,
  });
  await client.connect();
  try {
    const { rows: users } = await client.query("SELECT id, role, extra_roles, active FROM public.users ORDER BY id");

    // Asignaciones derivadas de los datos; lo no convertible va al informe.
    const assignments = [];
    const unconvertible = [];
    const extraRoleNames = new Set();
    users.forEach((user) => {
      const derived = deriveInheritedRoles(user, deriveScope);
      derived.assignments.forEach((item) => {
        assignments.push({ userId: user.id, ...item });
        if (item.source === "legacy_extra_role") extraRoleNames.add(item.role);
      });
      derived.unconvertible.forEach((item) => unconvertible.push({ userId: user.id, active: user.active !== false, ...item }));
    });
    const allRoleNames = [...new Set([...catalog.roleNames, ...assignments.map((a) => a.role)])].sort();

    if (apply) {
      await client.query("BEGIN");
      for (const module of modules) {
        await client.query(
          `INSERT INTO public.modules (key, label) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, updated_at = NOW()`, [module.key, module.label]);
      }
      for (const role of allRoleNames) {
        await client.query(
          `INSERT INTO public.roles (tenant_id, key, label, is_system) VALUES (NULL, $1, $1, TRUE)
           ON CONFLICT (key) WHERE tenant_id IS NULL DO NOTHING`, [role]);
      }
      // Lo generado se reemplaza completo para que no queden permisos de guardas que ya no existen.
      // Solo los vinculos de roles de SISTEMA: los de los roles personalizados no se tocan.
      await client.query("DELETE FROM public.rbac_endpoint_permissions");
      await client.query(
        `DELETE FROM public.role_permissions rp
          USING public.roles r, public.permissions p
          WHERE r.id = rp.role_id AND r.is_system AND p.key = rp.permission_key AND p.description LIKE $1`, [`${GENERATED_PREFIX}%`]);
      for (const permission of catalog.permissions) {
        await client.query(
          `INSERT INTO public.permissions (key, module_key, resource, action, description) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (key) DO UPDATE SET module_key = EXCLUDED.module_key, resource = EXCLUDED.resource,
             action = EXCLUDED.action, description = EXCLUDED.description`,
          [permission.key, permission.module_key, permission.resource, permission.action, permission.description]);
      }
      await client.query(
        `DELETE FROM public.permissions WHERE description LIKE $1 AND NOT (key = ANY($2::text[]))`,
        [`${GENERATED_PREFIX}%`, catalog.permissions.map((p) => p.key)]);
      for (const link of catalog.rolePermissions) {
        await client.query(
          `INSERT INTO public.role_permissions (role_id, permission_key)
           SELECT id, $2 FROM public.roles WHERE key = $1 AND tenant_id IS NULL ON CONFLICT DO NOTHING`, [link.role, link.permission]);
      }
      for (const item of catalog.endpointMap) {
        await client.query(
          `INSERT INTO public.rbac_endpoint_permissions (method, route_pattern, permission_key) VALUES ($1, $2, $3)
           ON CONFLICT (method, route_pattern) DO UPDATE SET permission_key = EXCLUDED.permission_key`, [item.method, item.route_pattern, item.permission_key]);
      }
      // Las asignaciones heredadas se recalculan desde users; las manuales no se tocan.
      await client.query("DELETE FROM public.user_role_assignments WHERE source <> 'manual'");
      for (const item of assignments) {
        await client.query(
          `INSERT INTO public.user_role_assignments (user_id, role_id, source)
           SELECT $1, id, $3 FROM public.roles WHERE key = $2 AND tenant_id IS NULL
           ON CONFLICT DO NOTHING`, [item.userId, item.role, item.source]);
      }
      await client.query("COMMIT");
    }

    const counts = {};
    for (const table of ["modules", "roles", "permissions", "role_permissions", "rbac_endpoint_permissions", "user_role_assignments"]) {
      counts[table] = Number((await client.query(`SELECT COUNT(*)::int AS n FROM public.${table}`)).rows[0].n);
    }
    const byRole = unconvertible.reduce((acc, item) => { const k = `${item.where}: ${item.value}`; acc[k] = acc[k] || { total: 0, active: 0 }; acc[k].total += 1; acc[k].active += item.active ? 1 : 0; return acc; }, {});
    const report = [
      "# Informe del catalogo central (Fase 3)",
      "",
      `Generado el ${new Date().toISOString().slice(0, 10)} por \`backend/scripts/rbac/seed_rbac_catalog.js\`${apply ? " (aplicado en la base local de staging)" : " (simulacion, sin escribir)"}. No editar a mano.`,
      "",
      "Todo sale de las guardas vigentes y de los datos de usuarios. Los nombres de permiso son provisionales y requieren aprobacion de cada responsable de area.",
      "",
      "## Catalogo calculado",
      "",
      `- Modulos: ${modules.length}`,
      `- Roles globales: ${allRoleNames.length} (${extraRoleNames.size} aparecen solo por \`extra_roles\`)`,
      `- Permisos: ${catalog.permissions.length}, de ellos ${catalog.permissions.filter((p) => p.module_key).length} con modulo unico y ${catalog.permissions.filter((p) => !p.module_key).length} sin modulo (transversales o con varios modulos)`,
      `- Relaciones rol-permiso: ${catalog.rolePermissions.length}`,
      `- Endpoints mapeados a un permiso: ${catalog.endpointMap.length}`,
      `- Asignaciones heredadas de usuarios: ${assignments.length} (${assignments.filter((a) => a.source === "legacy_role").length} por rol, ${assignments.filter((a) => a.source === "legacy_scope").length} por scope, ${assignments.filter((a) => a.source === "legacy_extra_role").length} por extra_roles)`,
      ...(apply ? ["", "Filas en la base tras aplicar:", "", ...Object.entries(counts).map(([table, n]) => `- \`${table}\`: ${n}`)] : []),
      "",
      `## Permisos con mas de un conjunto de roles (${catalog.variantReport.length})`,
      "",
      "Un mismo nombre agrupa endpoints con roles distintos; se separaron con `-v2`, `-v3`. El responsable decide si son realmente permisos distintos o una inconsistencia a corregir.",
      "",
      ...catalog.variantReport.map((item) => `- \`${item.base}\`: ${item.variants} variantes`),
      "",
      `## Usuarios no convertidos (${unconvertible.length})`,
      "",
      "No se convierten automaticamente (restriccion de la Fase 3). Sin asignacion central quedan sin roles, que es lo mismo que hoy: ninguna guarda los reconoce.",
      "",
      ...Object.entries(byRole).sort().map(([key, v]) => `- ${key}: ${v.total} usuario(s), ${v.active} activo(s)`),
      "",
    ].join("\n");
    fs.writeFileSync(path.join(DOCS, "catalogo-central-informe.md"), report);
    console.log(JSON.stringify({ apply, modules: modules.length, roles: allRoleNames.length, permissions: catalog.permissions.length, rolePermissions: catalog.rolePermissions.length, endpoints: catalog.endpointMap.length, assignments: assignments.length, unconvertible: unconvertible.length, counts }));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error.message); process.exit(1); });
