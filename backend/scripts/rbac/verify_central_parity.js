/**
 * Paridad entre el motor central y las guardas reales (plan RBAC, Fases 3 y 4). Solo lectura.
 *
 *  A. Catalogo: para cada endpoint con guarda de rol y cada usuario de prueba (todos los roles del
 *     catalogo, extra_roles reales, valores invalidos, pasante con y sin modulo verificado) ejecuta las
 *     funciones requireRole REALES de la ruta y compara su resultado con la decision del motor central
 *     leida desde la base. Cualquier diferencia es un defecto del catalogo o del motor.
 *  B. Asignaciones: para cada usuario de la base compara los roles que ve requireRole (role + scope +
 *     extra_roles) con los que guardan user_role_assignments.
 *
 * Uso (desde backend/):  STAGING_DATABASE_URL=postgresql://... node scripts/rbac/verify_central_parity.js
 * Sale con codigo 1 si hay alguna diferencia. Resumen en docs/plans/rbac-inventory/paridad-motor-central.md
 */
const fs = require("fs");
const path = require("path");

const url = process.env.STAGING_DATABASE_URL;
if (!url) { console.error("Falta STAGING_DATABASE_URL."); process.exit(1); }
const target = new URL(url);
if (!/^(localhost|127\.0\.0\.1)$/.test(target.hostname)) { console.error("Solo corre contra la base local de staging."); process.exit(1); }
// Antes de cargar la aplicacion: el pool de la base se crea al importar.
Object.assign(process.env, {
  DB_HOST: target.hostname, DB_PORT: target.port || "5432", DB_USER: decodeURIComponent(target.username),
  DB_PASSWORD: decodeURIComponent(target.password), DB_NAME: target.pathname.slice(1), DB_SSL: "false", NODE_ENV: "staging",
  // Mismo aislamiento que scripts/staging_local.ps1: la guarda de arranque lo exige y nada sale del equipo.
  DISABLE_MAIL: "true", EMAIL_NOTIFICATIONS_ENABLED: "false", NOTIFICATIONS_EMAIL_ENABLED: "false",
  NOTIFICATIONS_PUSH_ENABLED: "false", DISABLE_GCHAT: "true", ENABLE_JOBS: "false", JOBS_RUN_ON_START: "false",
  DB_BACKUP_AUTO_ENABLED: "false", GSA_KEY_PATH: "deshabilitado-en-staging-local",
});

const db = require("../../src/config/db");
const { collectUserRoles } = require("../../src/middlewares/roles");
const { rows } = require("./generate_access_inventory");
const { deriveScope } = require("./roleScope");
const { loadModel } = require("../../src/security/authorization/centralAuthorization");
const { decide } = require("../../src/security/authorization/centralModel");
const { INVALID_ROLE_VALUES, EXTRA_ROLE_CASES } = require("../../src/security/authorization/__fixtures__/legacyRoles.fixture");

// Ejecuta las guardas reales ya envueltas por el enforcement central y espera su resultado.
function runGuardsAsync(guards, request) {
  return guards.reduce((chain, guard) => chain.then((allowed) => {
    if (!allowed) return false;
    return new Promise((resolve) => {
      const res = { status: () => ({ json: () => resolve(false) }) };
      guard({ ...request }, res, () => resolve(true));
    });
  }), Promise.resolve(true));
}

function runLegacy(guards, user, moduleVerified) {
  let denied = false;
  const req = { user, _moduleAccessVerified: moduleVerified };
  for (const guard of guards) {
    if (denied) break;
    let passed = false;
    guard(req, { status: () => ({ json: () => {} }) }, () => { passed = true; });
    if (!passed) denied = true;
  }
  return !denied;
}

async function main() {
  const model = await loadModel();
  const roleNames = [...new Set([...model.permissionRoles.values()].flatMap((set) => [...set]))].sort();
  const probes = [
    ...roleNames.map((role) => ({ label: role, user: { id: 1, role, scope: deriveScope(role) } })),
    ...EXTRA_ROLE_CASES.map((item) => ({ label: `${item.role}+${item.extra_roles.join("+")}`, user: { id: 1, role: item.role, scope: deriveScope(item.role), extra_roles: item.extra_roles } })),
    ...INVALID_ROLE_VALUES.map((value) => ({ label: `invalido:${value}`, user: { id: 1, role: value, scope: deriveScope(value) } })),
    { label: "sin rol", user: { id: 1, role: null, scope: "pendiente" } },
    { label: "administrador", user: { id: 1, role: "administrador", scope: "admin" } },
  ];
  const { buildEndpointIndex, resolveEndpointPermission } = require("../../src/security/authorization/centralModel");
  const mapRows = (await db.query("SELECT method, route_pattern, permission_key FROM public.rbac_endpoint_permissions")).rows;
  const index = buildEndpointIndex(mapRows);

  const endpoints = rows.filter((row) => row.classification === "rol" && row.fns);
  const differences = [];
  let comparisons = 0;
  let unmapped = 0;
  for (const endpoint of endpoints) {
    const guards = endpoint.fns.chain.filter((fn) => fn.__guard?.type === "requireRole");
    const permissionKey = resolveEndpointPermission(index, endpoint.method, endpoint.path, null);
    if (!permissionKey) { unmapped += 1; differences.push({ kind: "sin_permiso", endpoint: `${endpoint.method} ${endpoint.path}` }); continue; }
    for (const probe of probes) {
      for (const verified of probe.label === "pasante" ? [false, true] : [false]) {
        comparisons += 1;
        const legacy = runLegacy(guards, probe.user, verified);
        const central = decide({ userRoles: collectUserRoles(probe.user), permissionKey, permissionRoles: model.permissionRoles, moduleVerified: verified }).allowed;
        if (legacy !== central) differences.push({ kind: "decision", endpoint: `${endpoint.method} ${endpoint.path}`, probe: probe.label + (verified ? " (modulo verificado)" : ""), legacy, central });
      }
    }
  }

  // C. requireRole con RBAC_CENTRAL_ENFORCE activo en todas las areas debe decidir igual que sin la bandera.
  const areas = [...new Set(endpoints.map((e) => { const p = e.path.split("/").filter(Boolean); return p[0] === "api" ? p[2] : p[0] === "asistencia" ? "attendance" : null; }).filter(Boolean))];
  process.env.RBAC_CENTRAL_ENFORCE = areas.join(",");
  const enforceDiffs = [];
  let enforceComparisons = 0;
  const NO_DB_USER = 2147483000; // sin asignaciones en la base: prueba el camino por rol del token
  for (const endpoint of endpoints) {
    const guards = endpoint.fns.chain.filter((fn) => fn.__guard?.type === "requireRole");
    const concrete = endpoint.path.replace(/:[A-Za-z0-9_]+/g, "1");
    for (const probe of probes) {
      for (const verified of probe.label === "pasante" ? [false, true] : [false]) {
        enforceComparisons += 1;
        const user = { ...probe.user, id: NO_DB_USER };
        const request = { user, method: endpoint.method, baseUrl: endpoint.path, originalUrl: concrete, route: { path: endpoint.path }, _moduleAccessVerified: verified };
        const legacy = runLegacy(guards, user, verified);
        const enforced = await runGuardsAsync(guards.map((guard) => guard.__wrapped || guard), request);
        if (legacy !== enforced) enforceDiffs.push({ kind: "enforce", endpoint: `${endpoint.method} ${endpoint.path}`, probe: probe.label + (verified ? " (modulo verificado)" : ""), legacy, enforced });
      }
    }
  }
  delete process.env.RBAC_CENTRAL_ENFORCE;

  // B. asignaciones vs roles que ve requireRole
  const { rows: users } = await db.query(`SELECT u.id, u.role, u.extra_roles,
      COALESCE((SELECT array_agg(r.key ORDER BY r.key) FROM public.user_role_assignments a JOIN public.roles r ON r.id = a.role_id
                 WHERE a.user_id = u.id AND a.revoked_at IS NULL), '{}') AS central_roles FROM public.users u`);
  const assignmentDiffs = [];
  users.forEach((user) => {
    const expected = [...collectUserRoles({ role: user.role, scope: deriveScope(user.role), extra_roles: user.extra_roles })]
      .filter((role) => !["null", "pending", "pendiente", ""].includes(role)).sort();
    const actual = [...new Set(user.central_roles)].sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) assignmentDiffs.push({ userId: user.id, role: user.role, expected, actual });
  });

  const decisionDiffs = differences.filter((d) => d.kind === "decision");
  const summary = {
    endpoints: endpoints.length, probes: probes.length, comparisons, unmapped,
    decisionDifferences: decisionDiffs.length, enforceComparisons, enforceDifferences: enforceDiffs.length, users: users.length, assignmentDifferences: assignmentDiffs.length,
  };
  const md = [
    "# Paridad del motor central con las guardas reales",
    "",
    `Generado el ${new Date().toISOString().slice(0, 10)} por \`backend/scripts/rbac/verify_central_parity.js\` contra la base local de staging. No editar a mano.`,
    "",
    "Ejecuta las funciones `requireRole` reales de cada ruta y las compara con la decision del motor central leida desde la base.",
    "",
    "| Medida | Valor |",
    "|---|---|",
    `| Endpoints con guarda de rol | ${summary.endpoints} |`,
    `| Usuarios de prueba (roles del catalogo, extra_roles, invalidos, administrador) | ${summary.probes} |`,
    `| Comparaciones | ${summary.comparisons} |`,
    `| Endpoints sin permiso asignado | ${summary.unmapped} |`,
    `| **Diferencias de decision** | **${summary.decisionDifferences}** |`,
    `| Comparaciones con el enforcement central activo en todas las areas | ${summary.enforceComparisons} |`,
    `| **Diferencias con el enforcement activo** | **${summary.enforceDifferences}** |`,
    `| Usuarios de la base revisados | ${summary.users} |`,
    `| **Diferencias en asignaciones de roles** | **${summary.assignmentDifferences}** |`,
    "",
    ...(decisionDiffs.length ? ["## Diferencias de decision (primeras 40)", "", ...decisionDiffs.slice(0, 40).map((d) => `- ${d.endpoint} | ${d.probe} | actual=${d.legacy} central=${d.central}`), ""] : []),
    ...(assignmentDiffs.length ? ["## Diferencias de asignaciones (primeras 40)", "", ...assignmentDiffs.slice(0, 40).map((d) => `- usuario ${d.userId} (${d.role}): esperado [${d.expected}] guardado [${d.actual}]`), ""] : []),
  ].join("\n");
  fs.writeFileSync(path.join(__dirname, "..", "..", "..", "docs", "plans", "rbac-inventory", "paridad-motor-central.md"), md);
  console.log(JSON.stringify(summary));
  enforceDiffs.slice(0, 10).forEach((d) => console.log(JSON.stringify(d)));
  if (differences.length || assignmentDiffs.length || enforceDiffs.length) {
    differences.slice(0, 10).forEach((d) => console.log(JSON.stringify(d)));
    assignmentDiffs.slice(0, 5).forEach((d) => console.log(JSON.stringify(d)));
    process.exitCode = 1;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => process.exit(process.exitCode || 0));
