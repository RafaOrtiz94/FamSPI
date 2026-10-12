// Scope que el login pone en el token para un rol (auth.controller.resolveRoleMeta). Lo usan los scripts
// de RBAC para reproducir los roles que ve requireRole: role + scope + extra_roles.
const { resolveRoleMeta } = require("../../src/modules/auth/auth.controller");

const deriveScope = (role) => String(resolveRoleMeta(role).scope || "").toLowerCase();

module.exports = { deriveScope };
