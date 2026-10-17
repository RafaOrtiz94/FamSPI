/**
 * Revision de las escrituras sin guarda de rol en la ruta (plan RBAC, Fase 0).
 *
 * Para cada POST/PUT/PATCH/DELETE que solo exige estar autenticado, lee el codigo que realmente
 * corre: los middlewares propios de la ruta, el controlador y las funciones del mismo modulo que
 * este llama (hasta tres niveles). Busca tres senales: denegacion explicita por rol o permiso, guarda
 * propia en la ruta, y uso de la identidad del usuario. Es una ayuda para la revision humana:
 * clasifica por evidencia en el codigo, no demuestra que el control sea correcto.
 *
 * Uso (desde backend/):  node scripts/rbac/review_open_writes.js
 * Salida: docs/plans/rbac-inventory/revision-escrituras-sin-rol.md y .json
 */
const fs = require("fs");
const path = require("path");

// asyncHandler oculta el controlador real tras una funcion envoltorio: se etiqueta antes de cargar rutas.
const asyncHandlerPath = require.resolve("../../src/middlewares/asyncHandler");
const asyncModule = require(asyncHandlerPath);
const originalAsyncHandler = asyncModule.asyncHandler;
asyncModule.asyncHandler = (fn) => {
  const wrapped = originalAsyncHandler(fn);
  wrapped.inner = fn;
  return wrapped;
};

const { rows } = require("./generate_access_inventory");

const MODULES_DIR = path.join(__dirname, "..", "..", "src", "modules");
const OUT_DIR = path.join(__dirname, "..", "..", "..", "docs", "plans", "rbac-inventory");
const unwrap = (fn) => (fn && fn.inner ? fn.inner : fn);
const sourceOf = (fn) => { try { return String(unwrap(fn)); } catch { return ""; } };

// ---- indice de funciones por archivo de modulo (para seguir las llamadas del controlador)
const fileCache = new Map();
function moduleFiles(dir) {
  if (!fileCache.has(dir)) {
    const files = [];
    const walk = (current) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.name === "__tests__" || entry.name === "node_modules") continue;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".js")) files.push({ full, text: fs.readFileSync(full, "utf8") });
      }
    };
    if (fs.existsSync(dir)) walk(dir);
    fileCache.set(dir, files);
  }
  return fileCache.get(dir);
}

// Cuerpo de una funcion por nombre: desde su declaracion hasta la llave que la cierra.
function functionBody(text, name) {
  const pattern = new RegExp(`(?:async\\s+function\\s+${name}\\s*\\(|function\\s+${name}\\s*\\(|(?:const|let)\\s+${name}\\s*=\\s*(?:async\\s*)?(?:\\(|function)|\\b${name}\\s*:\\s*(?:async\\s*)?(?:\\(|function)|exports\\.${name}\\s*=)`);
  const match = pattern.exec(text);
  if (!match) return null;
  // Saltar la lista de parametros: con desestructuracion ({ id, actor }) la primera llave no es el cuerpo.
  let cursor = text.indexOf("(", match.index);
  if (cursor < 0) return null;
  let parens = 0;
  for (; cursor < text.length; cursor += 1) {
    if (text[cursor] === "(") parens += 1;
    else if (text[cursor] === ")") { parens -= 1; if (parens === 0) break; }
  }
  const open = text.indexOf("{", cursor);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < text.length && i < open + 150000; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") { depth -= 1; if (depth === 0) return text.slice(match.index, i + 1); }
  }
  return null;
}

const allModuleDirs = fs.readdirSync(MODULES_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(MODULES_DIR, e.name));
function locateModuleDir(handlerSource) {
  const probe = handlerSource.replace(/\s+/g, " ").slice(0, 160);
  if (probe.length < 40) return null;
  const needle = handlerSource.slice(0, 120);
  return allModuleDirs.find((dir) => moduleFiles(dir).some((file) => file.text.includes(needle))) || null;
}

const SKIP_CALLS = new Set(["json", "status", "send", "query", "map", "filter", "forEach", "includes", "push", "String", "Number", "Boolean", "Array", "Object", "Date", "JSON", "Promise", "Math", "parseInt", "require", "next", "catch", "then", "trim", "toLowerCase", "slice", "join", "find", "some", "every", "reduce", "keys", "values", "entries", "test", "replace", "split", "set", "get", "has", "add", "warn", "error", "info", "debug", "log", "isArray", "isInteger", "isFinite", "stringify", "parse", "resolve", "reject", "all", "from", "now", "toISOString", "end", "redirect", "sendFile", "setHeader", "toString", "concat", "sort", "max", "min", "round", "floor", "trimEnd", "startsWith", "endsWith", "padStart", "assign", "freeze"]);
function calledNames(source) {
  const names = new Set();
  const regex = /\b([A-Za-z_]\w{3,})\s*\(/g;
  let match;
  while ((match = regex.exec(source))) if (!SKIP_CALLS.has(match[1])) names.add(match[1]);
  return [...names];
}

// ---- senales
const DENIAL = /,\s*403\s*\)|status\(\s*403\s*\)|\.status\s*=\s*403|statusCode\s*[:=]\s*403|code:\s*["'][A-Z_]*(FORBIDDEN|DENIED|NOT_ALLOWED|ROLE_REQUIRED|UNAUTHORIZED)[A-Z_]*["']|No tienes permis|no autorizad|Sin permis|sin permis|Acceso denegado|no puede[ns]? (realizar|acceder|modificar|aprobar)|Solo .{0,60}(puede|pueden)/;
const ROLE_REF = /\brole(s|_name)?\b|\bscope\b|extra_roles|resolveRequestRole|collectUserRoles|_ROLES\b|\bisAdmin|hasRole|hasReportingAccess|(assert|ensure)\w*(Access|Role|Permission|Editable|Participant|Owner|Ownership|Authorized|Can\w+)|(userHas|has)\w*Access|canManage|canApprove|canEdit|isOwner|isRequester|isAdminLike/;
const IDENTITY = /req\.user\??\.(id|email|sub)\b|\buser\??\.(id|email)\b|\buserId\b|\bactorId\b|author\b|requester|owner|created_by|approver|assigned/;
const GUARD_NAME = /^(require|assert|ensure|check|verify)[A-Z]|Access|Moderator|Presenter|Permission/;

function analyze(endpoint) {
  const { chain, finalHandler } = endpoint.fns;
  const guardMiddlewares = chain
    .filter((fn) => !fn.__guard)
    .map((fn) => ({ name: unwrap(fn).name || "(anonima)", source: sourceOf(fn) }))
    .filter((mw) => !/multer|rateLimit|limiter|upload/i.test(mw.name + mw.source.slice(0, 200)) || DENIAL.test(mw.source));
  const routeGuards = guardMiddlewares.filter((mw) => GUARD_NAME.test(mw.name) || (DENIAL.test(mw.source) && ROLE_REF.test(mw.source)));

  const handlerSource = sourceOf(finalHandler);
  const dir = locateModuleDir(handlerSource);
  const texts = [{ where: "controlador", text: handlerSource }];
  if (dir) {
    const files = moduleFiles(dir);
    const seen = new Set();
    let frontier = calledNames(handlerSource);
    for (let level = 1; level <= 3; level += 1) {
      const next = [];
      frontier.forEach((name) => {
        if (seen.has(name)) return;
        seen.add(name);
        for (const file of files) {
          const body = functionBody(file.text, name);
          if (body && body.length < 150000) {
            texts.push({ where: `${path.basename(file.full)} → ${name}()`, text: body });
            next.push(...calledNames(body));
            break;
          }
        }
      });
      frontier = next;
    }
  }

  const denialIn = texts.find((t) => DENIAL.test(t.text) && ROLE_REF.test(t.text));
  const identityIn = texts.find((t) => IDENTITY.test(t.text));
  let verdict;
  let evidence;
  if (routeGuards.length) {
    verdict = "guarda_propia_en_ruta";
    evidence = `middleware ${routeGuards.map((mw) => mw.name).join(", ")}`;
  } else if (denialIn) {
    verdict = "valida_rol_o_permiso";
    evidence = denialIn.where;
  } else if (identityIn) {
    verdict = "usa_identidad_del_usuario";
    evidence = identityIn.where;
  } else {
    verdict = "sin_control_visible";
    evidence = dir ? "ni el controlador ni las funciones que llama mencionan rol o usuario" : "no se pudo ubicar el codigo del controlador";
  }
  return { verdict, evidence, module: dir ? path.basename(dir) : "(sin ubicar)", handler: unwrap(finalHandler).name || endpoint.handler };
}

// ---- recorrido
const open = rows.filter((row) => row.classification === "solo_autenticado" && row.method !== "GET" && row.fns);
// /asistencia es un alias de /api/v1/attendance con el mismo router: se revisa una sola vez.
const unique = open.filter((row) => !row.path.startsWith("/asistencia/"));
// Conclusiones de revision humana: viven en un archivo aparte y se conservan al regenerar.
const MANUAL_PATH = path.join(OUT_DIR, "revision-escrituras-manual.json");
const manual = fs.existsSync(MANUAL_PATH) ? JSON.parse(fs.readFileSync(MANUAL_PATH, "utf8")) : {};
const reviewed = unique.map((row) => ({
  method: row.method,
  path: row.path,
  ...analyze(row),
  manual: manual[`${row.method} ${row.path}`] || null,
}));

const LABELS = {
  sin_control_visible: "Sin control visible: revisar primero",
  usa_identidad_del_usuario: "Usa la identidad del usuario, sin validar rol",
  valida_rol_o_permiso: "Valida rol o permiso dentro del codigo",
  guarda_propia_en_ruta: "Tiene guarda propia en la ruta (no es requireRole)",
};
const order = Object.keys(LABELS);
const today = new Date().toISOString().slice(0, 10);
const counts = Object.fromEntries(order.map((key) => [key, reviewed.filter((r) => r.verdict === key).length]));

const md = [
  "# Revision de escrituras sin guarda de rol en la ruta",
  "",
  `Generada el ${today} por \`backend/scripts/rbac/review_open_writes.js\`. No editar a mano: se regenera.`,
  "",
  `Alcance: ${open.length} endpoints de escritura que solo exigen estar autenticado; ${unique.length} unicos (los de \`/asistencia/*\` son alias de \`/api/v1/attendance/*\`).`,
  "",
  "Metodo: se lee el codigo que corre en cada ruta (middlewares propios, controlador y funciones del mismo modulo que llama, hasta tres niveles) y se clasifica por la evidencia encontrada. Es una ayuda para priorizar la revision humana, no una prueba de que el control sea correcto ni completo.",
  "",
  "| Resultado | Endpoints |",
  "|---|---|",
  ...order.map((key) => `| ${LABELS[key]} | ${counts[key]} |`),
  "",
  ...order.flatMap((key) => {
    const items = reviewed.filter((r) => r.verdict === key).sort((a, b) => a.path.localeCompare(b.path));
    if (!items.length) return [];
    return [
      `## ${LABELS[key]} (${items.length})`,
      "",
      "| Endpoint | Modulo | Controlador | Evidencia automatica | Revision manual |",
      "|---|---|---|---|---|",
      ...items.map((r) => `| \`${r.method} ${r.path}\` | ${r.module} | \`${r.handler}\` | ${r.evidence} | ${r.manual ? `**${r.manual.verdict}**: ${r.manual.note}` : "-"} |`),
      "",
    ];
  }),
].join("\n");

fs.writeFileSync(path.join(OUT_DIR, "revision-escrituras-sin-rol.md"), md);
fs.writeFileSync(path.join(OUT_DIR, "revision-escrituras-sin-rol.json"), `${JSON.stringify({ generatedAt: today, counts, endpoints: reviewed }, null, 2)}\n`);
console.log(JSON.stringify(counts), `| unicos ${unique.length} de ${open.length}`);
process.exit(0);
