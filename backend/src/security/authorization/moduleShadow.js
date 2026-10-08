/**
 * Modo sombra de la autorizacion modular (plan RBAC, Fase 2).
 *
 * Hoy el modulo de una peticion lo decide el encabezado x-app-path, que envia el navegador y se
 * puede omitir o falsificar. Aqui se calcula, sin afectar la respuesta, que habria decidido el
 * registro explicito "ruta API -> modulo" y se anota la diferencia con la decision vigente.
 *
 * Nunca cambia la respuesta: se ejecuta despues de resolver la decision vigente, sin esperarse,
 * y cualquier error se descarta. Apagado salvo RBAC_MODULE_SHADOW=true.
 */
const logger = require("../../config/logger");
const { isModuleEnabledForUser } = require("../../modules/module-access/moduleAccess.service");
const { apiPrefixOf, resolveDeclaredModules } = require("./apiModuleRegistry");

// ponytail: conteo en memoria por instancia; pasar a tabla si hace falta agregarlo entre instancias.
const MAX_KEYS = 5000;
const counts = new Map();

const isShadowEnabled = () => process.env.RBAC_MODULE_SHADOW === "true";

async function evaluate(req, legacy, path) {
  const declared = resolveDeclaredModules(path);
  let shadowAllowed = null;
  let divergence = "sin_declarar";

  if (declared) {
    shadowAllowed = true;
    if (declared.length) {
      const results = await Promise.all(
        declared.map((moduleKey) => isModuleEnabledForUser({ userId: req.user.id, moduleKey }))
      );
      shadowAllowed = results.some(Boolean);
    }
    if (shadowAllowed !== legacy.allowed) divergence = "decision_distinta";
    else if (declared.length && !declared.includes(legacy.moduleKey)) divergence = "modulo_distinto";
    else divergence = "coincide";
  }

  // Sin identificadores de usuario ni de recurso: solo metodo, prefijo, modulos y rol.
  return {
    divergence,
    method: req.method,
    apiPrefix: apiPrefixOf(path),
    headerModule: legacy.moduleKey || null,
    declared: declared || null,
    legacyAllowed: legacy.allowed,
    shadowAllowed,
    role: String(req.user.role || "").toLowerCase() || null,
  };
}

function observeModuleDecision(req, legacy) {
  if (!isShadowEnabled() || !req.user?.id) return Promise.resolve(null);
  // La ruta se lee ya: Express recorta req.url al entrar a cada router y esto termina despues.
  return evaluate(req, legacy, String(req.path || ""))
    .then((entry) => {
      const key = JSON.stringify(entry);
      const previous = counts.get(key) || 0;
      if (!previous && counts.size >= MAX_KEYS) return entry;
      counts.set(key, previous + 1);
      // Cada combinacion se escribe una sola vez; las coincidencias solo se cuentan.
      if (!previous && entry.divergence !== "coincide") {
        logger.info({ rbacShadow: "module", ...entry }, "RBAC sombra: diferencia de modulo");
      }
      return entry;
    })
    .catch(() => null);
}

const getShadowCounts = () => [...counts.entries()].map(([key, count]) => ({ ...JSON.parse(key), count }));
const resetShadowCounts = () => counts.clear();

module.exports = { observeModuleDecision, getShadowCounts, resetShadowCounts, isShadowEnabled };
