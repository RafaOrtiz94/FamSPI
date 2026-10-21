const {
  hasPermission,
  isKnownPermission,
  collectUserRoles,
} = require("./authorization");
const {
  isModuleEnabledForUser,
} = require("../../modules/module-access/moduleAccess.service");
const logger = require("../../config/logger");
const { centralHasPermission } = require("./centralAuthorization");

// Piloto de enforcement central (plan RBAC, Fase 5): apagado salvo RBAC_CENTRAL_PILOT=true.
// Si el motor central falla o no conoce el permiso, decide la regla de siempre: el piloto nunca
// deja a nadie sin acceso por un fallo propio.
const isCentralPilotEnabled = () => process.env.RBAC_CENTRAL_PILOT === "true";

const unauthorized = (res) =>
  res.status(401).json({ ok: false, code: "NO_AUTHENTICATED_USER", message: "No autenticado." });

const forbidden = (res, code, message) =>
  res.status(403).json({ ok: false, code, message });

function requirePermission(permission) {
  const key = String(permission || "").trim().toLowerCase();

  return (req, res, next) => {
    if (!req.user) return unauthorized(res);

    if (!isKnownPermission(key)) {
      return forbidden(res, "UNKNOWN_PERMISSION", "Permiso no registrado.");
    }

    const finish = (allowed, source) => {
      if (!allowed) {
        logger.warn({
          userId: req.user.id || null,
          permission: key,
          source,
          path: req.originalUrl || req.url || null,
        }, "Autorizacion denegada por permiso");
        return forbidden(res, "PERMISSION_DENIED", "No tienes permisos para esta operación.");
      }
      req.authorization = {
        ...(req.authorization || {}),
        permission: key,
      };
      return next();
    };

    const legacyAllowed = hasPermission(req.user, key);
    if (!isCentralPilotEnabled() || !req.user.id) return finish(legacyAllowed, "legacy");

    return centralHasPermission({ userId: req.user.id, permissionKey: key, tokenRoles: [...collectUserRoles(req.user)] })
      .then((central) => (central ? finish(central.allowed, "central") : finish(legacyAllowed, "legacy")))
      .catch((error) => {
        logger.warn({ permission: key, error: error.message }, "Piloto central fallo; se usa la regla de siempre");
        return finish(legacyAllowed, "legacy");
      });
  };
}

function requireModule(moduleKey) {
  const key = String(moduleKey || "").trim().toLowerCase();

  return async (req, res, next) => {
    if (!req.user) return unauthorized(res);
    if (!key) return forbidden(res, "UNKNOWN_MODULE", "Módulo no registrado.");

    try {
      const enabled = await isModuleEnabledForUser({
        userId: req.user.id,
        moduleKey: key,
      });

      if (!enabled) {
        return res.status(403).json({
          ok: false,
          code: "MODULE_DISABLED",
          message: "Modulo deshabilitado para este usuario",
          module_key: key,
        });
      }

      req.authorization = {
        ...(req.authorization || {}),
        module: key,
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  requirePermission,
  requireModule,
};
