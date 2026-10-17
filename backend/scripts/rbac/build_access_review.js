/**
 * Material de revision de la Fase 0 del plan RBAC, armado desde los inventarios generados.
 * No inventa permisos: solo resume lo que ya hacen el codigo y los datos, para que cada
 * responsable funcional lo apruebe por modulo.
 *
 * Entradas (docs/plans/rbac-inventory/):  backend-endpoints.json, frontend-routes.json
 * Salidas:  registro-de-roles.md, matriz-por-modulo.md y, si hay base de staging, datos-snapshot.json
 *
 * Uso (desde backend/):
 *   node scripts/rbac/build_access_review.js
 *   STAGING_DATABASE_URL=... node scripts/rbac/build_access_review.js   # agrega la foto de datos (solo conteos)
 */
const fs = require("fs");
const path = require("path");
const { ROLE_GROUPS, expandRoles } = require("../../src/middlewares/roles");
const { REAL_ROLES, INVALID_ROLE_VALUES, EXTRA_ROLE_CASES } = require("../../src/security/authorization/__fixtures__/legacyRoles.fixture");

const DIR = path.join(__dirname, "..", "..", "..", "docs", "plans", "rbac-inventory");
const read = (name) => JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8"));
const backend = read("backend-endpoints.json").endpoints;
const frontend = read("frontend-routes.json").routes;
const today = new Date().toISOString().slice(0, 10);
const moduleOf = (routePath) => routePath.replace(/^\/api\/v1\//, "").replace(/^\//, "").split("/")[0] || "(raiz)";
const SUPER = ["admin", "administrador"];

// Roles reales que pasan un endpoint: todas sus guardas de rol deben cumplirse.
function realRolesAllowed(endpoint) {
  if (!endpoint.roleGuards.length) return null;
  return REAL_ROLES.filter((role) => endpoint.roleGuards.every((guard) => expandRoles(guard).has(role)));
}

// ---------------------------------------------------------------- registro de roles
const extraRoleNames = [...new Set(EXTRA_ROLE_CASES.flatMap((item) => item.extra_roles))];
const names = new Set([
  ...REAL_ROLES, ...INVALID_ROLE_VALUES, ...extraRoleNames, ...SUPER,
  ...Object.keys(ROLE_GROUPS), ...Object.values(ROLE_GROUPS).flat(),
  ...backend.flatMap((e) => e.roleGuards.flat()),
  ...frontend.flatMap((r) => r.roleGuards.flatMap((g) => g.roles)),
]);
const count = (list, predicate) => list.filter(predicate).length;

const registry = [...names].sort().map((name) => {
  const isReal = REAL_ROLES.includes(name);
  const isGroup = Boolean(ROLE_GROUPS[name]);
  const isExtra = extraRoleNames.includes(name);
  let kind = "alias o rol sin usuarios";
  if (INVALID_ROLE_VALUES.includes(name)) kind = "valor invalido en users.role";
  else if (SUPER.includes(name)) kind = "superrol del backend (sin usuarios)";
  else if (isReal && isGroup) kind = "rol real y grupo";
  else if (isReal) kind = "rol real";
  else if (isExtra) kind = "capacidad (extra_roles)";
  else if (isGroup) kind = "grupo del backend";
  return {
    name,
    kind,
    inGroups: Object.keys(ROLE_GROUPS).filter((group) => group !== name && ROLE_GROUPS[group].includes(name)),
    backendGuards: count(backend, (e) => e.roleGuards.some((guard) => guard.includes(name))),
    frontendRoutes: count(frontend, (r) => r.roleGuards.some((guard) => guard.roles.includes(name))),
  };
});

const registryMd = [
  "# Registro de roles observados",
  "",
  `Generado el ${today} por \`backend/scripts/rbac/build_access_review.js\`. No editar a mano: se regenera.`,
  "",
  "Cada nombre que aparece como rol en la base, en los grupos del backend, en una guarda de endpoint o en una ruta del frontend.",
  "",
  "- **Guardas backend**: endpoints cuya guarda nombra este valor literalmente (antes de expandir grupos).",
  "- **Rutas frontend**: rutas cuya lista `allowedRoles` lo nombra.",
  "",
  "| Nombre | Tipo | Pertenece a los grupos | Guardas backend | Rutas frontend |",
  "|---|---|---|---|---|",
  ...registry.map((r) => `| \`${r.name}\` | ${r.kind} | ${r.inGroups.join(", ") || "-"} | ${r.backendGuards} | ${r.frontendRoutes} |`),
  "",
  "## Para decidir",
  "",
  `- Nombres sin usuarios que siguen en guardas o rutas (candidatos a alias obsoleto): ${registry.filter((r) => r.kind === "alias o rol sin usuarios" && (r.backendGuards || r.frontendRoutes)).map((r) => `\`${r.name}\``).join(", ") || "ninguno"}.`,
  `- Nombres que solo existen dentro de un grupo y nadie nombra directamente: ${registry.filter((r) => r.kind === "alias o rol sin usuarios" && !r.backendGuards && !r.frontendRoutes).map((r) => `\`${r.name}\``).join(", ") || "ninguno"}.`,
  `- Roles reales que ningun grupo del backend incluye: ${REAL_ROLES.filter((role) => !Object.values(ROLE_GROUPS).flat().includes(role)).map((r) => `\`${r}\``).join(", ") || "ninguno"}.`,
  `- Nombres usados solo en el frontend (el backend no los conoce): ${registry.filter((r) => r.frontendRoutes && !r.backendGuards && !ROLE_GROUPS[r.name] && !r.inGroups.length && !REAL_ROLES.includes(r.name)).map((r) => `\`${r.name}\``).join(", ") || "ninguno"}.`,
  "",
].join("\n");

// ---------------------------------------------------------------- matriz por modulo
const modules = new Map();
backend.forEach((endpoint) => {
  const key = moduleOf(endpoint.path);
  if (!modules.has(key)) modules.set(key, []);
  modules.get(key).push(endpoint);
});

const moduleSections = [...modules.keys()].sort().map((key) => {
  const endpoints = modules.get(key);
  const by = (classification) => endpoints.filter((e) => e.classification === classification);
  const roleCounts = {};
  by("rol").forEach((e) => (realRolesAllowed(e) || []).forEach((role) => { roleCounts[role] = (roleCounts[role] || 0) + 1; }));
  const noRealRole = by("rol").filter((e) => (realRolesAllowed(e) || []).length === 0);
  const openWrites = by("solo_autenticado").filter((e) => e.method !== "GET");
  const lines = [
    `## ${key}`,
    "",
    `Endpoints: ${endpoints.length} | por rol: ${by("rol").length} | solo autenticado: ${by("solo_autenticado").length} (${openWrites.length} de escritura) | permiso central: ${by("permiso_central").length} | publicos: ${by("publico").length} | internos: ${by("interno").length}`,
    "",
  ];
  if (Object.keys(roleCounts).length) {
    lines.push("Roles reales con acceso (endpoints por rol que pasan):", "");
    lines.push(Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).map(([role, n]) => `\`${role}\` ${n}`).join(" · "), "");
  }
  if (noRealRole.length) {
    lines.push(`Endpoints por rol que hoy ningun rol real puede usar (${noRealRole.length}):`, "");
    noRealRole.slice(0, 15).forEach((e) => lines.push(`- \`${e.method} ${e.path}\` — exige: ${e.roleGuards.map((g) => g.join(", ")).join(" Y ")}`));
    if (noRealRole.length > 15) lines.push(`- ... y ${noRealRole.length - 15} mas (ver backend-endpoints.csv)`);
    lines.push("");
  }
  if (openWrites.length) {
    lines.push(`Escrituras sin guarda de rol en la ruta (${openWrites.length}) — confirmar si el control esta en el controlador o falta:`, "");
    openWrites.slice(0, 25).forEach((e) => lines.push(`- [ ] \`${e.method} ${e.path}\` → \`${e.handler}\``));
    if (openWrites.length > 25) lines.push(`- ... y ${openWrites.length - 25} mas (ver backend-endpoints.csv)`);
    lines.push("");
  }
  lines.push("Responsable funcional: _por asignar_ · Aprobado: _pendiente_", "");
  return lines.join("\n");
});

const totals = (classification) => backend.filter((e) => e.classification === classification).length;
const matrixMd = [
  "# Matriz de acceso por modulo (backend)",
  "",
  `Generada el ${today} por \`backend/scripts/rbac/build_access_review.js\` desde \`backend-endpoints.json\`. No editar a mano: se regenera. El detalle fila por fila esta en \`backend-endpoints.csv\`.`,
  "",
  `Totales: ${backend.length} endpoints en ${modules.size} modulos · por rol ${totals("rol")} · solo autenticado ${totals("solo_autenticado")} · permiso central ${totals("permiso_central")} · publicos ${totals("publico")} · internos ${totals("interno")}.`,
  "",
  "Como leerla: \"solo autenticado\" significa que la ruta no exige rol; el control puede estar dentro del controlador o no existir. Cada escritura de esa lista debe confirmarse antes de convertirla en permiso.",
  "",
  ...moduleSections,
].join("\n");

fs.writeFileSync(path.join(DIR, "registro-de-roles.md"), registryMd);
fs.writeFileSync(path.join(DIR, "matriz-por-modulo.md"), matrixMd);
console.log(`registro-de-roles.md: ${registry.length} nombres | matriz-por-modulo.md: ${modules.size} modulos`);

// ---------------------------------------------------------------- vistas por rol
// Misma regla que ProtectedRoute.jsx (caracterizada en sus pruebas): cada guarda anidada debe
// pasar por rol o scope exactos, o por el pase de gerencia/pasante cuando no es estricta.
// No considera user_module_access ni extra_roles: es el acceso que da el rol por si solo.
function loadRoleMeta() {
  const text = fs.readFileSync(path.join(__dirname, "..", "..", "src", "modules", "auth", "auth.controller.js"), "utf8");
  const start = text.indexOf("const ROLE_META = {");
  const end = text.indexOf("\n};", start);
  if (start < 0 || end < 0) return {};
  return Function(`return ${text.slice(text.indexOf("{", start), end + 2)}`)();
}
const roleMeta = loadRoleMeta();
const identitiesOf = (role) => [...new Set([role, roleMeta[role]?.scope || role])];
function openVia(role, route) {
  const ids = identitiesOf(role);
  let viaPass = false;
  for (const guard of route.roleGuards) {
    if (guard.roles.some((allowed) => ids.includes(allowed))) continue;
    if (!guard.strict && (ids.includes("gerencia") || ids.includes("pasante"))) { viaPass = true; continue; }
    return null;
  }
  return viaPass ? "pase" : "rol";
}

const navPath = path.join(DIR, "frontend-navigation-by-role.json");
const viewsPath = path.join(DIR, "vistas-por-rol.json");
const navByRole = fs.existsSync(navPath) ? read("frontend-navigation-by-role.json") : {};
const viewsByRole = fs.existsSync(viewsPath) ? read("vistas-por-rol.json") : null;
const concreteRoutes = frontend.filter((route) => route.classification !== "publica" && !route.redirectTo && !route.path.includes(":") && !route.path.includes("*"));
const routeFor = (href) => frontend.find((route) => route.path === href) || frontend.find((route) => route.path.endsWith("/*") && href.startsWith(route.path.slice(0, -2)));

const viewSections = REAL_ROLES.map((role) => {
  const nav = navByRole[role]?.links || [];
  const navHrefs = new Set(nav.map((link) => link.href));
  const openable = concreteRoutes.filter((route) => openVia(role, route));
  const byPass = openable.filter((route) => openVia(role, route) === "pase");
  const navBlocked = nav.filter((link) => { const route = routeFor(link.href); return route && route.classification !== "publica" && !openVia(role, route); });
  const hidden = openable.filter((route) => !navHrefs.has(route.path));
  const lines = [
    `## ${role}`,
    "",
    `Identidades que usa el frontend: ${identitiesOf(role).map((id) => `\`${id}\``).join(", ")} · Panel: \`${navByRole[role]?.home || "-"}\``,
    "",
    `- Rutas que puede abrir por su rol: ${openable.length} de ${concreteRoutes.length}${byPass.length ? ` (${byPass.length} solo por el pase de gerencia/pasante)` : ""}.`,
    `- Enlaces en su menu: ${nav.length}.`,
    `- Enlaces del menu que la regla de rol le niega: ${navBlocked.length ? navBlocked.map((link) => `\`${link.href}\``).join(", ") : "ninguno"}.`,
    `- Rutas que puede abrir escribiendo la URL pero su menu no muestra: ${hidden.length}${hidden.length ? ` — ${hidden.slice(0, 14).map((route) => `\`${route.path}\``).join(", ")}${hidden.length > 14 ? `, ... y ${hidden.length - 14} mas` : ""}` : ""}.`,
  ];
  if (viewsByRole?.[role]) {
    const views = viewsByRole[role];
    const tally = views.reduce((acc, view) => ({ ...acc, [view.outcome]: (acc[view.outcome] || 0) + 1 }), {});
    lines.push(`- Verificacion en navegador de sus ${views.length} enlaces: ${Object.entries(tally).map(([outcome, n]) => `${outcome} ${n}`).join(", ")}.`);
    views.filter((view) => view.outcome !== "abre").forEach((view) => lines.push(`  - \`${view.href}\` (${view.label}): ${view.outcome}${view.landed !== view.href ? ` → \`${view.landed}\`` : ""}`));
    const withErrors = views.filter((view) => view.apiErrors.length || view.pageErrors.length);
    if (withErrors.length) {
      lines.push(`- Vistas que abren pero con llamadas a la API rechazadas o errores (${withErrors.length}):`);
      withErrors.forEach((view) => lines.push(`  - \`${view.href}\`: ${[...view.apiErrors, ...view.pageErrors.map((e) => `error de pagina: ${e}`)].slice(0, 6).join("; ")}`));
    }
  }
  lines.push("");
  return lines.join("\n");
});

const viewsMd = [
  "# Vistas del frontend por rol",
  "",
  `Generado el ${today} por \`backend/scripts/rbac/build_access_review.js\`. No editar a mano: se regenera.`,
  "",
  `Fuentes: \`frontend-routes.json\` (${frontend.length} rutas, ${concreteRoutes.length} protegidas y sin parametros), \`frontend-navigation-by-role.json\` (menu real de cada cuenta de prueba)${viewsByRole ? " y `vistas-por-rol.json` (cada enlace abierto en el navegador contra el ambiente local)" : ""}.`,
  "",
  "La regla de rol es la de `ProtectedRoute.jsx`. No incluye el acceso por modulo (`user_module_access`) ni `extra_roles`, asi que una ruta \"abrible por rol\" puede estar apagada para un usuario concreto.",
  "",
  ...viewSections,
].join("\n");
fs.writeFileSync(path.join(DIR, "vistas-por-rol.md"), viewsMd);
console.log(`vistas-por-rol.md: ${REAL_ROLES.length} roles${viewsByRole ? " (con verificacion en navegador)" : " (sin verificacion en navegador todavia)"}`);

// ---------------------------------------------------------------- foto de datos (solo conteos)
async function snapshot() {
  const url = process.env.STAGING_DATABASE_URL;
  if (!url) { console.log("Sin STAGING_DATABASE_URL: no se genera datos-snapshot.json."); return; }
  const { assertStagingTarget } = require("../staging/sanitize_staging_db");
  assertStagingTarget(url);
  const { Client } = require("pg");
  const target = new URL(url);
  const client = new Client({
    host: target.hostname, port: Number(target.port || 5432), user: decodeURIComponent(target.username),
    password: decodeURIComponent(target.password), database: target.pathname.slice(1),
    ssl: /^(localhost|127\.0\.0\.1)$/.test(target.hostname) ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  // Las cuentas prueba.* son del ambiente de pruebas, no de produccion: se excluyen.
  const real = "COALESCE(u.username, '') NOT LIKE 'prueba.%'";
  const q = async (sql) => (await client.query(sql)).rows;
  const data = {
    generatedAt: today,
    note: "Solo conteos, sin datos personales. Origen: copia saneada de produccion en el ambiente local.",
    usersByRole: await q(`SELECT COALESCE(role, '(NULL)') AS role, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE COALESCE(active, true))::int AS active, COUNT(*) FILTER (WHERE auth_provider = 'local')::int AS local_login FROM users u WHERE ${real} GROUP BY 1 ORDER BY 1`),
    extraRoleCombinations: await q(`SELECT role, extra_roles::text AS extra_roles, COUNT(*)::int AS users FROM users u WHERE ${real} AND extra_roles::text NOT IN ('[]', '{}', 'null') GROUP BY 1, 2 ORDER BY 1, 2`),
    moduleAccessByRole: await q(`SELECT u.role, COUNT(DISTINCT a.user_id)::int AS users_with_rows, COUNT(*)::int AS rows, COUNT(*) FILTER (WHERE a.is_enabled)::int AS enabled, COUNT(*) FILTER (WHERE NOT a.is_enabled)::int AS disabled FROM user_module_access a JOIN users u ON u.id = a.user_id WHERE ${real} GROUP BY 1 ORDER BY 1`),
    usersWithoutModuleRows: (await q(`SELECT COUNT(*)::int AS n FROM users u WHERE ${real} AND COALESCE(active, true) AND NOT EXISTS (SELECT 1 FROM user_module_access a WHERE a.user_id = u.id)`))[0].n,
    moduleGlobalStatus: await q("SELECT module_key, stage, COALESCE(array_length(whitelist_emails, 1), 0)::int AS whitelist_size FROM module_global_status ORDER BY 1"),
    centralTables: await q("SELECT 'roles' AS t, COUNT(*)::int AS n FROM roles UNION ALL SELECT 'permissions', COUNT(*)::int FROM permissions UNION ALL SELECT 'role_permissions', COUNT(*)::int FROM role_permissions UNION ALL SELECT 'user_roles', COUNT(*)::int FROM user_roles UNION ALL SELECT 'modules', COUNT(*)::int FROM modules ORDER BY 1"),
  };
  await client.end();
  fs.writeFileSync(path.join(DIR, "datos-snapshot.json"), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`datos-snapshot.json: ${data.usersByRole.length} roles, ${data.usersWithoutModuleRows} usuarios activos sin filas de acceso a modulos`);
}

snapshot().catch((error) => { console.error("ERROR:", error.message); process.exit(1); });
