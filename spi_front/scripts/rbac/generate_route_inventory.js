/**
 * Inventario de rutas del frontend y sus guardas de rol (plan RBAC, Fase 0).
 *
 * Lee src/routes/AppRoutes.jsx con el parser de Babel y recorre el arbol JSX: cada <Route path>
 * hereda las guardas de todos los <Route element={<ProtectedRoute .../>}> que lo envuelven.
 * No ejecuta la app ni modifica nada; solo escribe el inventario.
 *
 * Uso (desde spi_front/):
 *   node scripts/rbac/generate_route_inventory.js            # escribe docs/plans/rbac-inventory/
 *   node scripts/rbac/generate_route_inventory.js --check    # falla si el inventario guardado quedo desactualizado
 */
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const SOURCE = path.join(__dirname, "..", "..", "src", "routes", "AppRoutes.jsx");
const OUT_DIR = path.join(__dirname, "..", "..", "..", "docs", "plans", "rbac-inventory");

const ast = parser.parse(fs.readFileSync(SOURCE, "utf8"), { sourceType: "module", plugins: ["jsx"] });

// Listas de roles declaradas como constantes (const xRoles = [...]); admiten spread de otras.
const constants = new Map();
function resolveArray(node) {
  if (!node) return { roles: [], unresolved: false };
  if (node.type === "Identifier") return constants.get(node.name) || { roles: [], unresolved: true };
  if (node.type !== "ArrayExpression") return { roles: [], unresolved: true };
  const roles = [];
  let unresolved = false;
  node.elements.forEach((element) => {
    if (!element) return;
    if (element.type === "StringLiteral") roles.push(element.value);
    else if (element.type === "SpreadElement") {
      const inner = resolveArray(element.argument);
      roles.push(...inner.roles);
      unresolved = unresolved || inner.unresolved;
    } else unresolved = true;
  });
  return { roles, unresolved };
}
ast.program.body.forEach((statement) => {
  if (statement.type !== "VariableDeclaration") return;
  statement.declarations.forEach((declaration) => {
    if (declaration.id.type === "Identifier" && declaration.init?.type === "ArrayExpression") {
      constants.set(declaration.id.name, resolveArray(declaration.init));
    }
  });
});

const tagName = (element) => element.openingElement.name.name || "";
const attr = (element, name) => element.openingElement.attributes.find((a) => a.type === "JSXAttribute" && a.name.name === name);
const attrExpression = (attribute) => (attribute?.value?.type === "JSXExpressionContainer" ? attribute.value.expression : attribute?.value);

function describeElement(node) {
  if (!node) return { component: null };
  if (node.type === "JSXElement") {
    const name = tagName(node);
    if (name === "Navigate") {
      const to = attrExpression(attr(node, "to"));
      return { component: "Navigate", redirectTo: to?.type === "StringLiteral" ? to.value : "(dinamico)" };
    }
    return { component: name };
  }
  if (node.type === "Identifier") return { component: node.name };
  return { component: "(expresion)" };
}

function guardFrom(element) {
  if (element?.type !== "JSXElement" || tagName(element) !== "ProtectedRoute") return null;
  const allowed = resolveArray(attrExpression(attr(element, "allowedRoles")));
  return { allowedRoles: [...new Set(allowed.roles)].sort(), strict: Boolean(attr(element, "strictRoles")), unresolved: allowed.unresolved };
}

const routes = [];
function visit(node, guards) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((child) => visit(child, guards)); return; }
  if (node.type === "JSXElement" && tagName(node) === "Route") {
    const elementNode = attrExpression(attr(node, "element"));
    const guard = guardFrom(elementNode);
    const nextGuards = guard ? [...guards, guard] : guards;
    const pathNode = attrExpression(attr(node, "path"));
    if (pathNode) {
      routes.push({
        path: pathNode.type === "StringLiteral" ? pathNode.value : "(dinamico)",
        line: node.loc.start.line,
        ...(guard ? { component: "(solo guarda)" } : describeElement(elementNode)),
        guards: nextGuards,
      });
    }
    visit(node.children, nextGuards);
    return;
  }
  Object.keys(node).forEach((key) => {
    if (key === "loc" || key === "start" || key === "end") return;
    const value = node[key];
    if (value && typeof value === "object") visit(value, guards);
  });
}
visit(ast.program, []);

function classify(route) {
  if (!route.guards.length) return "publica";
  if (route.guards.every((guard) => !guard.allowedRoles.length)) return "solo_autenticado";
  return route.guards.some((guard) => guard.strict && guard.allowedRoles.length) ? "rol_estricto" : "rol";
}

const rows = routes
  .map((route) => ({
    path: route.path,
    line: route.line,
    component: route.component,
    redirectTo: route.redirectTo || null,
    classification: classify(route),
    // Varias guardas anidadas deben cumplirse todas: se listan por separado, de afuera hacia adentro.
    roleGuards: route.guards.filter((guard) => guard.allowedRoles.length).map((guard) => ({ roles: guard.allowedRoles, strict: guard.strict })),
    unresolved: route.guards.some((guard) => guard.unresolved),
  }))
  .sort((a, b) => (a.path === b.path ? a.line - b.line : a.path.localeCompare(b.path)));

const summary = {
  total: rows.length,
  byClassification: rows.reduce((acc, row) => ({ ...acc, [row.classification]: (acc[row.classification] || 0) + 1 }), {}),
  redirects: rows.filter((row) => row.redirectTo).length,
  unresolved: rows.filter((row) => row.unresolved).length,
  distinctRoles: [...new Set(rows.flatMap((row) => row.roleGuards.flatMap((guard) => guard.roles)))].sort(),
};

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const csv = [
  ["ruta", "clasificacion", "componente", "redirige_a", "roles", "linea"].join(","),
  ...rows.map((row) => [
    row.path,
    row.classification,
    row.component,
    row.redirectTo || "",
    row.roleGuards.map((guard) => `${guard.roles.join(" | ")}${guard.strict ? " (estricto)" : ""}`).join("  Y  "),
    row.line,
  ].map(csvCell).join(",")),
].join("\n");

const json = `${JSON.stringify({ summary, routes: rows }, null, 2)}\n`;
const jsonPath = path.join(OUT_DIR, "frontend-routes.json");

if (process.argv.includes("--check")) {
  const saved = fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, "utf8") : "";
  if (saved !== json) {
    console.error("Inventario de rutas desactualizado: hay rutas nuevas, eliminadas o con guardas distintas. Ejecuta el generador sin --check y revisa el cambio.");
    process.exit(1);
  }
  console.log(`Inventario de rutas al dia: ${rows.length} rutas.`);
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(jsonPath, json);
fs.writeFileSync(path.join(OUT_DIR, "frontend-routes.csv"), `${csv}\n`);
console.log(JSON.stringify(summary.byClassification), `| total ${summary.total} | redirecciones ${summary.redirects} | sin resolver ${summary.unresolved} | roles ${summary.distinctRoles.length}`);
