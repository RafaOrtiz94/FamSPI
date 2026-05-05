const {
  resolveModuleKeyByPath,
  isModuleEnabledForUser,
} = require("../modules/module-access/moduleAccess.service");

const BYPASS_PREFIXES = [
  "/api/v1/auth/",
  "/api/v1/module-access/",
  "/api/v1/notifications/",
];

async function moduleAccessGuard(req, res, next) {
  try {
    if (!req.user?.id) return next();
    const path = String(req.path || "");
    if (BYPASS_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return next();
    }

    const frontendPath = req.headers["x-app-path"] || "";
    const moduleKey = resolveModuleKeyByPath(frontendPath);
    if (!moduleKey) return next();

    const enabled = await isModuleEnabledForUser({
      userId: req.user.id,
      moduleKey,
    });
    if (enabled) return next();

    return res.status(403).json({
      ok: false,
      message: "Modulo deshabilitado para este usuario",
      code: "MODULE_DISABLED",
      module_key: moduleKey,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { moduleAccessGuard };
