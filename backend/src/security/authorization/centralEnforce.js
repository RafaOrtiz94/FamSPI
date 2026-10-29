/**
 * Enforcement central por area de la API (plan RBAC, Fase 7).
 *
 * Se activa con RBAC_CENTRAL_ENFORCE="viaticos,attendance" (areas = primer segmento tras /api/v1).
 * El valor "*" activa todas las areas: es para ensayar en staging; en produccion se activan una a una.
 * Solo toca las areas listadas; el resto sigue con requireRole de siempre. Ante cualquier duda decide
 * requireRole: area no listada, endpoint sin permiso en el catalogo, error del motor o tiempo agotado.
 * Rollback: quitar la variable (en Cloud Run, actualizar la variable de entorno; no requiere desplegar codigo).
 *
 * Los roles que usa el motor son los del token MAS las asignaciones manuales de la base, asi un usuario
 * nuevo funciona sin esperar a que se sincronicen sus asignaciones heredadas y una asignacion manual
 * tiene efecto real solo en las areas activadas.
 */
const logger = require("../../config/logger");
const { collectUserRoles } = require("../../middlewares/roles");
const { loadModel, loadUser } = require("./centralAuthorization");
const { resolveEndpointPermission, decide } = require("./centralModel");

const TIMEOUT_MS = 2000;

const enforcedAreas = () => new Set(String(process.env.RBAC_CENTRAL_ENFORCE || "").split(",").map((area) => area.trim().toLowerCase()).filter(Boolean));

function areaOf(req) {
  const parts = String(req.baseUrl || req.originalUrl || "").split("?")[0].split("/").filter(Boolean);
  if (parts[0] === "api" && parts[1] === "v1") return parts[2] || null;
  if (parts[0] === "asistencia") return "attendance";
  return null;
}

const withTimeout = (promise) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS).unref())]);

async function centralVerdict(req) {
  const model = await loadModel();
  const routePath = req.route && typeof req.route.path === "string" ? req.route.path : null;
  if (!routePath) return null;
  const path = String(req.originalUrl || "").split("?")[0];
  const permissionKey = resolveEndpointPermission(model.index, req.method, path, routePath);
  if (!permissionKey) return null;
  const user = await loadUser(req.user.id);
  const userRoles = new Set([...collectUserRoles(req.user), ...user.roles]);
  return { permissionKey, ...decide({ userRoles, permissionKey, permissionRoles: model.permissionRoles, moduleVerified: Boolean(req._moduleAccessVerified), grantedPermissions: user.grants }) };
}

function enforceCentral(req, res, next, legacyMiddleware) {
  if (!req.user || !req.user.id) return legacyMiddleware(req, res, next);
  const area = areaOf(req);
  const enforced = enforcedAreas();
  if (!area || !(enforced.has("*") || enforced.has(area))) return legacyMiddleware(req, res, next);

  return withTimeout(centralVerdict(req))
    .then((verdict) => {
      if (!verdict) return legacyMiddleware(req, res, next);
      if (verdict.allowed) return next();
      logger.warn({ area, permission: verdict.permissionKey, reason: verdict.reason, method: req.method }, "Acceso denegado por el motor central");
      return res.status(403).json({ ok: false, error: `Acceso denegado. Permiso requerido: ${verdict.permissionKey}`, code: "PERMISSION_DENIED" });
    })
    .catch((error) => {
      logger.warn({ area, error: error.message }, "Motor central fallo; decide requireRole");
      return legacyMiddleware(req, res, next);
    });
}

module.exports = { enforceCentral, enforcedAreas, areaOf };
