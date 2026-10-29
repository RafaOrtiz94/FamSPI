/**
 * Modo sombra del motor central (plan RBAC, Fase 4).
 *
 * Al terminar cada respuesta compara lo que el motor central habria decidido con lo que paso de verdad
 * (403 = la guarda de rol actual nego). Solo registra: no se espera, no cambia la respuesta, descarta sus
 * errores y se apaga con RBAC_CENTRAL_SHADOW distinto de "true". No guarda identificadores de usuario.
 */
const logger = require("../../config/logger");
const { centralDecisionForRequest } = require("./centralAuthorization");

const MAX_KEYS = 5000;
const TIMEOUT_MS = 2000;
const counts = new Map();
const totals = {};
let evaluated = 0;
const SUMMARY_EVERY = 500;

const isCentralShadowEnabled = () => process.env.RBAC_CENTRAL_SHADOW === "true";

const withTimeout = (promise) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS).unref())]);

function classify(central, status) {
  const legacyDenied = status === 403;
  if (central.allowed === !legacyDenied) return "coincide";
  // El motor central negaria algo que hoy se atiende: rompe a un usuario si se activara.
  if (!central.allowed) return status >= 400 ? "central_niega_legacy_error" : "central_niega_legacy_permite";
  // 403 con central permitiendo: suele ser una negacion de objeto (propiedad, estado), no de rol.
  return "central_permite_legacy_403";
}

function record(entry) {
  totals[entry.divergence] = (totals[entry.divergence] || 0) + 1;
  evaluated += 1;
  // Resumen periodico: sin el no hay forma de ver cuantas decisiones coincidieron, porque solo se escriben las diferencias.
  if (evaluated % SUMMARY_EVERY === 0) logger.info({ rbacShadow: "central_resumen", evaluated, ...totals }, "RBAC sombra central: resumen");
  const key = JSON.stringify(entry);
  const previous = counts.get(key) || 0;
  if (!previous && counts.size >= MAX_KEYS) return;
  counts.set(key, previous + 1);
  if (!previous && entry.divergence !== "coincide") {
    logger.info({ rbacShadow: "central", ...entry }, "RBAC sombra central: diferencia");
  }
}

function centralShadow(req, res, next) {
  if (!isCentralShadowEnabled() || !req.user?.id) return next();
  const userId = req.user.id;
  const method = req.method;
  const path = req.originalUrl ? String(req.originalUrl).split("?")[0] : String(req.path || "");
  res.on("finish", () => {
    const status = res.statusCode;
    const routePath = req.route && typeof req.route.path === "string" ? req.route.path : null;
    if (!routePath || status === 401) return;
    withTimeout(centralDecisionForRequest({ userId, method, path, routePath, moduleVerified: Boolean(req._moduleAccessVerified) }))
      .then((central) => {
        if (!central) return;
        record({
          divergence: classify(central, status),
          method,
          permission: central.permissionKey,
          centralAllowed: central.allowed,
          reason: central.reason,
          status: status >= 500 ? "5xx" : status >= 400 ? status : "ok",
          role: String(req.user.role || "").toLowerCase() || null,
        });
      })
      .catch(() => {});
  });
  return next();
}

const getCentralShadowCounts = () => [...counts.entries()].map(([key, count]) => ({ ...JSON.parse(key), count }));
const resetCentralShadowCounts = () => {
  counts.clear();
  evaluated = 0;
  Object.keys(totals).forEach((key) => delete totals[key]);
};

module.exports = { centralShadow, classify, getCentralShadowCounts, resetCentralShadowCounts, isCentralShadowEnabled };
