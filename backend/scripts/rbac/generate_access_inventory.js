/**
 * Inventario de acceso actual del backend (plan RBAC, Fase 0).
 *
 * Carga los routers reales de Express y recorre sus capas, en vez de interpretar el texto de
 * los archivos: lo que sale es exactamente lo que el servidor monta. No abre el puerto, no
 * consulta la base y no modifica nada; solo escribe el inventario.
 *
 * Uso (desde backend/):
 *   node scripts/rbac/generate_access_inventory.js            # escribe docs/plans/rbac-inventory/
 *   node scripts/rbac/generate_access_inventory.js --check    # falla si el inventario guardado quedo desactualizado
 */
const fs = require("fs");
const path = require("path");

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.ENABLE_JOBS = "false";

const OUT_DIR = path.join(__dirname, "..", "..", "..", "docs", "plans", "rbac-inventory");
const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

// --- 1. Etiquetar las guardas ANTES de cargar las rutas -------------------------------------
// Las fabricas (requireRole, requirePermission, ...) devuelven una funcion anonima; se envuelven
// para que cada middleware recuerde con que argumentos fue creado.
function tagFactory(mod, name, type) {
  const original = mod[name];
  if (typeof original !== "function") return;
  mod[name] = (...args) => {
    const middleware = original(...args);
    if (typeof middleware === "function") middleware.__guard = { type, args };
    return middleware;
  };
}

const roles = require("../../src/middlewares/roles");
const auth = require("../../src/middlewares/auth");
const authorization = require("../../src/security/authorization/authorization.middleware");

tagFactory(roles, "requireRole", "requireRole");
tagFactory(auth, "requireRole", "requireRole");
tagFactory(authorization, "requirePermission", "requirePermission");
tagFactory(authorization, "requireModule", "requireModule");
auth.verifyToken.__guard = { type: "verifyToken", args: [] };

// Express 5 no guarda la ruta de montaje en la capa; se anota al registrar.
const express = require("express");
const routerProto = Object.getPrototypeOf(express.Router());
const originalUse = routerProto.use;
routerProto.use = function patchedUse(...args) {
  const before = this.stack.length;
  const result = originalUse.apply(this, args);
  const mountPath = typeof args[0] === "string" ? args[0] : "";
  for (let i = before; i < this.stack.length; i += 1) this.stack[i].__mountPath = mountPath;
  return result;
};

// --- 2. Cargar el registro real de rutas sobre una app falsa ---------------------------------
const mounts = [];
function fakeApp(scope) {
  const app = {
    use: (...args) => {
      const mountPath = typeof args[0] === "string" ? args[0] : "";
      const handlers = args.filter((arg) => typeof arg === "function");
      mounts.push({ scope, mountPath, handlers });
    },
  };
  HTTP_METHODS.forEach((method) => {
    app[method] = (routePath, ...handlers) => {
      mounts.push({ scope, mountPath: "", direct: { method, routePath, handlers } });
    };
  });
  return app;
}

const { mountPublicRoutes, mountPrivateRoutes } = require("../../src/routes/registerRoutes");
mountPublicRoutes(fakeApp("public"));
mountPrivateRoutes(fakeApp("private"));

// --- 3. Recorrer las capas -------------------------------------------------------------------
function describeHandler(fn) {
  if (fn.__guard) return fn.__guard;
  return { type: "other", name: fn.name || "(anonima)" };
}

function flattenRoles(args) {
  return [...new Set(args.flat(Infinity).filter((value) => typeof value === "string"))].sort();
}

function summarize(chain) {
  const guards = chain.map(describeHandler);
  const roleGuards = guards.filter((guard) => guard.type === "requireRole");
  return {
    authenticated: guards.some((guard) => guard.type === "verifyToken"),
    // Varias guardas de rol encadenadas deben cumplirse todas: se listan por separado.
    roleGuards: roleGuards.map((guard) => flattenRoles(guard.args)),
    permissions: guards.filter((guard) => guard.type === "requirePermission").map((guard) => flattenRoles(guard.args)).flat(),
    modules: guards.filter((guard) => guard.type === "requireModule").map((guard) => flattenRoles(guard.args)).flat(),
    otherMiddlewares: [...new Set(guards.filter((guard) => guard.type === "other").map((guard) => guard.name))],
  };
}

const endpoints = [];
function joinPath(...parts) {
  const joined = parts.filter(Boolean).join("/").replace(/\/+/g, "/");
  return joined.length > 1 ? joined.replace(/\/$/, "") : joined || "/";
}

function walk(router, prefix, inherited, scope) {
  const local = [...inherited];
  for (const layer of router.stack || []) {
    if (layer.route) {
      const routePaths = [].concat(layer.route.path);
      const methods = Object.keys(layer.route.methods).filter((method) => layer.route.methods[method]);
      const handlers = layer.route.stack.map((item) => item.handle);
      const chain = [...local, ...handlers.slice(0, -1)];
      const finalHandler = handlers[handlers.length - 1];
      routePaths.forEach((routePath) => methods.forEach((method) => {
        const endpoint = {
          scope,
          method: method.toUpperCase(),
          path: joinPath(prefix, String(routePath)),
          handler: finalHandler?.name || "(anonima)",
          ...summarize(chain),
        };
        // No enumerable: lo usa review_open_writes.js y no entra al JSON del inventario.
        Object.defineProperty(endpoint, "fns", { value: { chain, finalHandler } });
        endpoints.push(endpoint);
      }));
    } else if (layer.handle && Array.isArray(layer.handle.stack)) {
      walk(layer.handle, joinPath(prefix, layer.__mountPath), local, scope);
    } else if (typeof layer.handle === "function") {
      // router.use(middleware): afecta a las rutas registradas despues, y solo bajo su ruta de montaje.
      if (!layer.__mountPath) local.push(layer.handle);
    }
  }
}

for (const mount of mounts) {
  if (mount.direct) {
    const handlers = mount.direct.handlers;
    endpoints.push({
      scope: mount.scope,
      method: mount.direct.method.toUpperCase(),
      path: joinPath(String(mount.direct.routePath)),
      handler: handlers[handlers.length - 1]?.name || "(anonima)",
      ...summarize(handlers.slice(0, -1)),
    });
    continue;
  }
  const routers = mount.handlers.filter((handler) => Array.isArray(handler.stack));
  const middlewares = mount.handlers.filter((handler) => !Array.isArray(handler.stack));
  routers.forEach((router) => walk(router, mount.mountPath, middlewares, mount.scope));
}

endpoints.sort((a, b) => (a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path)));

// --- 4. Clasificar y escribir ----------------------------------------------------------------
// app.js aplica verifyToken a todo lo montado en mountPrivateRoutes salvo las rutas de
// publicPaths.js; esa autenticacion no aparece en la cadena del router y se suma aqui.
const { isPublicPath } = require("../../src/routes/publicPaths");

function classify(endpoint) {
  if (endpoint.path.startsWith("/internal/")) return "interno";
  if (endpoint.permissions.length) return "permiso_central";
  if (endpoint.roleGuards.length) return "rol";
  if (endpoint.authenticated) return "solo_autenticado";
  return "publico";
}

const rows = endpoints.map((endpoint) => {
  const declaredPublic = endpoint.scope === "public" || isPublicPath(endpoint.path);
  const authenticated = endpoint.authenticated || !declaredPublic;
  const row = { ...endpoint, authenticated, declaredPublic };
  const classified = { ...row, classification: classify(row) };
  if (endpoint.fns) Object.defineProperty(classified, "fns", { value: endpoint.fns });
  return classified;
});
const moduleOf = (routePath) => routePath.replace(/^\/api\/v1\//, "").split("/")[0] || "(raiz)";

const summary = {
  total: rows.length,
  byClassification: rows.reduce((acc, row) => ({ ...acc, [row.classification]: (acc[row.classification] || 0) + 1 }), {}),
  modules: [...new Set(rows.map((row) => moduleOf(row.path)))].length,
  distinctRoles: [...new Set(rows.flatMap((row) => row.roleGuards.flat()))].sort(),
};

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const csv = [
  ["modulo", "metodo", "ruta", "clasificacion", "autenticado", "roles", "permisos", "modulos", "otros_middlewares", "handler"].join(","),
  ...rows.map((row) => [
    moduleOf(row.path),
    row.method,
    row.path,
    row.classification,
    row.authenticated ? "si" : "no",
    row.roleGuards.map((group) => group.join(" | ")).join("  Y  "),
    row.permissions.join(" | "),
    row.modules.join(" | "),
    row.otherMiddlewares.join(" | "),
    row.handler,
  ].map(csvCell).join(",")),
].join("\n");

const json = `${JSON.stringify({ summary, endpoints: rows }, null, 2)}\n`;
const jsonPath = path.join(OUT_DIR, "backend-endpoints.json");
const csvPath = path.join(OUT_DIR, "backend-endpoints.csv");

module.exports = { rows };

if (require.main !== module) return;

if (process.argv.includes("--check")) {
  const saved = fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, "utf8") : "";
  if (saved !== json) {
    console.error("Inventario desactualizado: hay endpoints nuevos, eliminados o con guardas distintas. Ejecuta el generador sin --check y revisa el cambio.");
    process.exit(1);
  }
  console.log(`Inventario al dia: ${rows.length} endpoints.`);
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(jsonPath, json);
fs.writeFileSync(csvPath, `${csv}\n`);
console.log(JSON.stringify(summary.byClassification), `| total ${summary.total} | modulos ${summary.modules} | roles ${summary.distinctRoles.length}`);
process.exit(0);
