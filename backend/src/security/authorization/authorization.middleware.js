const {
  hasPermission,
  isKnownPermission,
} = require("./authorization");
const {
  isModuleEnabledForUser,
} = require("../../modules/module-access/moduleAccess.service");
const logger = require("../../config/logger");

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

    if (!hasPermission(req.user, key)) {
      logger.warn({
        userId: req.user.id || null,
        permission: key,
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
