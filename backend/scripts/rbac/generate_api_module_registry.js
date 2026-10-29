/**
 * Propuesta del registro "ruta API -> modulo" (plan RBAC, Fase 2), armada con dos evidencias:
 *
 *  - Observada: llamadas reales vistas por el modo sombra al recorrer el menu de los 17 roles
 *    en el ambiente local (OBSERVED, abajo). Solo cubre cargas de pagina.
 *  - Estatica: para cada pantalla de AppRoutes.jsx se siguen sus imports y se anotan los prefijos
 *    de API que menciona el codigo alcanzable. Cubre acciones de escritura y pantallas fuera del
 *    menu, pero exagera: un componente compartido arrastra sus APIs a todas las pantallas que lo usan.
 *
 * No inventa modulos: cada uno sale del catalogo y de una pantalla que usa esa API.
 * Es una propuesta para aprobacion funcional; por ahora solo la lee el modo sombra.
 *
 * Uso (desde backend/):  node scripts/rbac/generate_api_module_registry.js [--check]
 * Salidas: src/security/authorization/apiModuleRegistry.data.json
 *          docs/plans/rbac-inventory/api-por-modulo.md
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..", "..");
const FRONT_SRC = path.join(ROOT, "spi_front", "src");
const DOCS = path.join(ROOT, "docs", "plans", "rbac-inventory");
const DATA_PATH = path.join(__dirname, "..", "..", "src", "security", "authorization", "apiModuleRegistry.data.json");

// Copia del catalogo sin cargar el servicio (que abre la conexion a base).
const serviceText = fs.readFileSync(path.join(__dirname, "..", "..", "src", "modules", "module-access", "moduleAccess.service.js"), "utf8");
const CATALOG = [...serviceText.matchAll(/\{\s*key:\s*"([^"]+)",\s*label:\s*"[^"]*",\s*path_prefixes:\s*\[([^\]]*)\]/g)]
  .map((match) => ({ key: match[1], prefixes: [...match[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]) }));
function moduleOfUiPath(uiPath) {
  let best = null;
  let bestLen = -1;
  CATALOG.forEach((module) => module.prefixes.forEach((prefix) => {
    if (uiPath.startsWith(prefix) && prefix.length > bestLen) { best = module.key; bestLen = prefix.length; }
  }));
  return best;
}

// Observado el 2026-10-07/08 (modo sombra, recorrido de menu de 17 roles). [] = llamada desde todas las pantallas.
const OBSERVED = {
  "/api/v1/attendance": [],
  "/api/v1/audit-prep": [],
  "/api/v1/clients": [],
  "/api/v1/notifications": [],
  "/api/v1/signature-workflows": [],
  "/api/v1/auditoria": ["auditoria"],
  "/api/v1/business-case": ["business_case", "comercial", "finanzas", "inicio", "operaciones", "servicio_solicitudes", "workspace_compras"],
  "/api/v1/collab-deliveries": ["collab_entregas", "collab_resumen"],
  "/api/v1/collaborators": ["gerencia", "talento_colaboradores", "talento_humano"],
  "/api/v1/consumable-files": ["workspace_compras"],
  "/api/v1/crm-fam": ["crm_fam"],
  "/api/v1/dashboard": ["comercial"],
  "/api/v1/delivery-ceilings": ["comercial_maximos_saldos"],
  "/api/v1/departments": ["talento_gestion", "ti"],
  "/api/v1/equipment-management": ["servicio_equipos"],
  "/api/v1/equipment-purchases": ["comercial_solicitudes", "servicio_solicitudes", "workspace_compras"],
  "/api/v1/famsheets": ["comercial"],
  "/api/v1/hiring-pipeline": ["talento_pruebas_tecnicas"],
  "/api/v1/mantenimientos": ["inicio", "operaciones", "servicio_mantenimientos"],
  "/api/v1/permisos": ["finanzas", "inicio", "operaciones", "talento_permisos", "ti"],
  "/api/v1/personnel-requests": ["talento_colaboradores"],
  "/api/v1/private-purchases": ["logistica", "servicio_solicitudes", "workspace_compras"],
  "/api/v1/process-notes": ["workspace_compras"],
  "/api/v1/requests": ["inicio", "operaciones", "servicio_solicitudes"],
  "/api/v1/schedules": ["comercial_aprobacion_planes"],
  "/api/v1/servicio": ["inicio", "servicio_cronograma", "servicio_disponibilidad", "servicio_mantenimientos"],
  "/api/v1/support-tickets": ["ti_workspace"],
  "/api/v1/technical-applications": ["servicio_aplicaciones"],
  "/api/v1/ti-assets": ["ti_dispositivos"],
  "/api/v1/trainings": ["capacitaciones"],
  "/api/v1/users": ["collab_entregas", "operaciones", "servicio_solicitudes", "talento_gestion", "ti", "ti_dispositivos", "ti_modulos"],
  "/api/v1/vacaciones": ["talento_permisos"],
  "/api/v1/viaticos": ["finanzas_viaticos"],
  "/api/v1/work-management": ["work_management"],
};

// ---- prefijos privados de la API
const endpoints = JSON.parse(fs.readFileSync(path.join(DOCS, "backend-endpoints.json"), "utf8")).endpoints;
const prefixOf = (apiPath) => { const parts = apiPath.split("/").filter(Boolean); return parts[0] === "api" && parts[1] === "v1" ? `/${parts.slice(0, 3).join("/")}` : null; };
const apiPrefixes = [...new Set(endpoints.filter((e) => e.scope === "private").map((e) => prefixOf(e.path)).filter(Boolean))].sort();
const apiNames = apiPrefixes.map((prefix) => prefix.split("/")[3]);

// ---- grafo de imports del frontend
const files = new Map();
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) files.set(full, fs.readFileSync(full, "utf8"));
  }
})(FRONT_SRC);

function resolveImport(from, spec) {
  const base = path.resolve(path.dirname(from), spec);
  return [base, `${base}.js`, `${base}.jsx`, path.join(base, "index.js"), path.join(base, "index.jsx")].find((candidate) => files.has(candidate)) || null;
}
const IMPORT = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](\.{1,2}\/[^"']+)["']/g;
const importsOf = new Map();
const apisOf = new Map();
files.forEach((text, file) => {
  importsOf.set(file, [...text.matchAll(IMPORT)].map((m) => resolveImport(file, m[1])).filter(Boolean));
  // Una API se cuenta cuando el archivo contiene un literal que empieza por /<prefijo>: "/viaticos", `/viaticos/${id}`.
  apisOf.set(file, apiNames.filter((name) => new RegExp(`["'\`]/${name.replace(/[-/]/g, "\\$&")}(?=[/"'\`?])`).test(text)));
});
// El cliente HTTP lo importa casi todo el frontend (via AuthContext) y menciona rutas de muchas APIs
// para invalidar cache: no es evidencia de que una pantalla las use.
const HTTP_CLIENT = path.join(FRONT_SRC, "core", "api", "index.js");
function reachableApis(start, blocked = new Set()) {
  const seen = new Set([HTTP_CLIENT]);
  const found = new Set();
  const stack = [start];
  while (stack.length) {
    const file = stack.pop();
    if (!file || seen.has(file) || blocked.has(file)) continue;
    seen.add(file);
    apisOf.get(file).forEach((name) => found.add(name));
    stack.push(...importsOf.get(file));
  }
  return found;
}

// ---- pantallas: componente de cada ruta -> archivo
const routesFile = path.join(FRONT_SRC, "routes", "AppRoutes.jsx");
const routesText = files.get(routesFile);
const componentFile = new Map();
[...routesText.matchAll(/const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)/g),
  ...routesText.matchAll(/import\s+(\w+)\s+from\s+["'](\.{1,2}\/[^"']+)["']/g)]
  .forEach((m) => componentFile.set(m[1], resolveImport(routesFile, m[2])));

const routes = JSON.parse(fs.readFileSync(path.join(DOCS, "frontend-routes.json"), "utf8")).routes;
const staticModules = Object.fromEntries(apiNames.map((name) => [name, new Set()]));
const pageFiles = new Set();
const unresolvedPages = [];
routes.forEach((route) => {
  if (!route.component || route.component === "Navigate") return;
  const file = componentFile.get(route.component);
  if (!file) { unresolvedPages.push(`${route.path} (${route.component})`); return; }
  pageFiles.add(file);
  const moduleKey = moduleOfUiPath(route.path);
  if (!moduleKey) return;
  reachableApis(file).forEach((name) => staticModules[name].add(moduleKey));
});
// Lo que carga la aplicacion fuera de las pantallas (layout, barra, widgets): se llama desde cualquier modulo.
const globalApis = reachableApis(path.join(FRONT_SRC, "App.js"), pageFiles);

// ---- propuesta
const registry = {};
const globalOnly = [];
apiPrefixes.forEach((prefix, index) => {
  const name = apiNames[index];
  const observed = OBSERVED[prefix];
  const fromStatic = [...staticModules[name]].sort();
  // Transversal solo si se observo desde todas las pantallas. El alcance estatico del layout no basta:
  // arrastra codigo compartido y marcaria como transversal APIs que solo se vieron desde su modulo.
  const transversal = Boolean(observed && !observed.length);
  if (!observed && !fromStatic.length) { if (globalApis.has(name)) globalOnly.push(prefix); return; }
  registry[prefix] = {
    modules: transversal ? [] : [...new Set([...(observed || []), ...fromStatic])].sort(),
    evidence: observed && fromStatic.length ? "observada y estatica" : observed ? "observada" : "estatica",
  };
});
const undeclared = apiPrefixes.filter((prefix) => !registry[prefix] && !globalOnly.includes(prefix));
const serialized = `${JSON.stringify(registry, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = fs.existsSync(DATA_PATH) ? fs.readFileSync(DATA_PATH, "utf8").replace(/\r\n/g, "\n") : "";
  if (current !== serialized) { console.error("Registro API -> modulo desactualizado: ejecuta el generador sin --check y revisa el cambio."); process.exit(1); }
  console.log("Registro API -> modulo al dia.");
  process.exit(0);
}

fs.writeFileSync(DATA_PATH, serialized);
const entries = Object.entries(registry);
const md = [
  "# Registro propuesto: ruta API -> modulo",
  "",
  "Generado por `backend/scripts/rbac/generate_api_module_registry.js`. No editar a mano: se regenera.",
  "",
  "Propuesta para aprobacion funcional. Hoy solo la usa el modo sombra: no autoriza ni deniega nada.",
  "",
  "- **Observada**: llamada real vista al recorrer el menu de los 17 roles en el ambiente local.",
  "- **Estatica**: una pantalla de ese modulo alcanza, por sus imports, codigo que llama a esa API. Exagera cuando el codigo es compartido.",
  "- **Transversal**: se llama desde cualquier pantalla; no depende de ningun modulo.",
  "",
  `Prefijos privados: ${apiPrefixes.length}. Declarados: ${entries.length} (${entries.filter(([, v]) => !v.modules.length).length} transversales). Sin evidencia: ${undeclared.length}.`,
  "",
  "| Prefijo de API | Modulos que la usan | Evidencia |",
  "|---|---|---|",
  ...entries.map(([prefix, value]) => `| \`${prefix}\` | ${value.modules.length ? value.modules.join(", ") : "**transversal**"} | ${value.evidence} |`),
  "",
  `## Sin evidencia de uso desde una pantalla (${undeclared.length})`,
  "",
  "Ninguna pantalla con modulo las menciona: pueden ser de uso interno, de pantallas fuera de `/dashboard` o no usarse. Quedan sin declarar hasta revisarlas.",
  "",
  ...undeclared.map((prefix) => `- \`${prefix}\``),
  "",
  `## Solo alcanzadas desde el layout comun (${globalOnly.length})`,
  "",
  "El codigo comun de la aplicacion las menciona, pero ninguna pantalla con modulo. Quedan sin declarar hasta que la sombra muestre desde donde se llaman.",
  "",
  ...globalOnly.map((prefix) => `- \`${prefix}\``),
  "",
  ...(unresolvedPages.length ? [`## Pantallas cuyo archivo no se pudo ubicar (${unresolvedPages.length})`, "", ...unresolvedPages.map((p) => `- ${p}`), ""] : []),
].join("\n");
fs.writeFileSync(path.join(DOCS, "api-por-modulo.md"), md);
console.log(`prefijos ${apiPrefixes.length} | declarados ${entries.length} | transversales ${entries.filter(([, v]) => !v.modules.length).length} | sin evidencia ${undeclared.length} | pantallas sin ubicar ${unresolvedPages.length}`);
