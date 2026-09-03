const {
  resolveModuleKeyByPath,
  isModuleEnabledForUser,
} = require("../modules/module-access/moduleAccess.service");

// Rutas que nunca dependen de user_module_access: auth (aun sin sesion),
// el propio panel de gestion de modulos (siempre exclusivo de jefe_ti/admin_ti,
// nunca asignable a nadie mas) y notificaciones (no es un modulo del catalogo;
// depender de x-app-path aqui acoplaria el poll de notificaciones a la pagina
// que el usuario tenga abierta en ese momento). Viaticos SI es un modulo del
// catalogo ("finanzas_viaticos") y debe pasar por este guard como cualquier
// otro -- de lo contrario, deshabilitarlo desde el Gestor de Modulos (para un
// pasante o para cualquier usuario) no tendria ningun efecto real.
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
    if (enabled) {
      // Marca que este request ya fue autorizado por module_access, para que
      // requireRole (mas adelante en la cadena) sepa que es seguro dejar
      // pasar a un pasante sin volver a filtrarlo por rol -- ver
      // middlewares/roles.js. Sin este flag (rutas en BYPASS_PREFIXES o sin
      // module_key resuelto) requireRole sigue exigiendo el rol exacto.
      req._moduleAccessVerified = true;
      return next();
    }

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
