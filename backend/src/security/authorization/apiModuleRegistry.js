/**
 * Registro explicito "ruta API -> modulo" (plan RBAC, Fase 2).
 *
 * Declara a que modulos del catalogo pertenece cada prefijo de la API, para dejar de depender del
 * encabezado x-app-path. Lista vacia = transversal (no depende de ningun modulo). Con varios
 * modulos basta con tener habilitado uno. Un prefijo ausente esta sin declarar.
 *
 * Por ahora solo lo lee el modo sombra (moduleShadow.js): no autoriza ni deniega nada.
 * Es una propuesta: requiere aprobacion del responsable de cada modulo antes de usarse para decidir.
 * Detalle legible en docs/plans/rbac-inventory/api-por-modulo.md.
 */
// Los datos los genera backend/scripts/rbac/generate_api_module_registry.js a partir de las llamadas
// observadas por la sombra y del analisis de imports de cada pantalla. No editar el JSON a mano.
const API_MODULE_REGISTRY = Object.freeze(
  Object.fromEntries(Object.entries(require("./apiModuleRegistry.data.json")).map(([prefix, entry]) => [prefix, entry.modules]))
);

// Prefijo estable de una ruta, sin identificadores: /api/v1/<modulo>, /internal/<x>, /api/<x>, /asistencia.
function apiPrefixOf(path) {
  const parts = String(path || "").split("?")[0].split("/").filter(Boolean);
  const size = parts[0] === "api" && parts[1] === "v1" ? 3 : parts[0] === "asistencia" ? 1 : 2;
  return `/${parts.slice(0, size).join("/")}`;
}

// Devuelve los modulos declarados (gana el prefijo mas largo) o null si la ruta esta sin declarar.
function resolveDeclaredModules(path, registry = API_MODULE_REGISTRY) {
  const clean = String(path || "").split("?")[0];
  const prefixes = Object.keys(registry).sort((a, b) => b.length - a.length);
  const match = prefixes.find((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
  return match ? registry[match] : null;
}

module.exports = { API_MODULE_REGISTRY, apiPrefixOf, resolveDeclaredModules };
