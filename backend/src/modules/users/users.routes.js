// src/modules/users/users.routes.js
const express = require("express");
const router = express.Router();
const controller = require("./users.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

const ALLOWED_USER_ROLES = new Set([
  "pendiente",
  "gerencia",
  "gerencia_general",
  "gerente_general",
  "director",
  "comercial",
  "asesor_comercial",
  "acp_comercial",
  "backoffice_comercial",
  "marketing",
  "jefe_comercial",
  "servicio_tecnico",
  "tecnico",
  "responsable_tecnico",
  "jefe_servicio_tecnico",
  "jefe_tecnico",
  "finanzas",
  "jefe_finanzas",
  "jefe_financiero",
  "talento_humano",
  "jefe_talento_humano",
  "ti",
  "jefe_ti",
  "admin_ti",
  "operaciones",
  "jefe_operaciones",
  "calidad",
  "jefe_calidad",
  "logistica",
  "jefe_logistica",
  "usuario",
  "admin",
  "administrador",
]);

const USER_ADMIN_ROLES = [
  "talento_humano",
  "jefe_talento_humano",
  "gerencia",
  "ti",
  "jefe_ti",
  "admin_ti",
  "admin",
  "administrador",
];
const USER_DIRECTORY_ROLES = [
  ...USER_ADMIN_ROLES,
  "gerencia_general",
  "gerente_general",
  "director",
  "finanzas",
  "financiero",
  "jefe_finanzas",
  "jefe_financiero",
  "comercial",
  "jefe_comercial",
  "backoffice_comercial",
  "acp_comercial",
  // jefe_servicio necesita el directorio para asignar tecnico/esp_app al
  // coordinar inspecciones de ambiente desde Solicitudes.
  "jefe_servicio",
  // jefe_operaciones necesita el directorio para elegir el asesor al asignar clientes
  // (Clientes.jsx#loadAdvisors -> GET /users).
  "jefe_operaciones",
  "jefe_de_operaciones",
];

// Todas las rutas requieren autenticación
const allowSignerDirectoryLookup = (req, res, next) => {
  const forSigners = req.query?.for_signers === "true" || req.query?.for_signers === "1";
  if (forSigners) return next();
  return requireRole(USER_DIRECTORY_ROLES)(req, res, next);
};

router.use(verifyToken);

// Catálogo de roles (para selects del frontend)
router.get("/roles", requireRole(USER_DIRECTORY_ROLES), (req, res) => {
  res.status(200).json({
    ok: true,
    data: Array.from(ALLOWED_USER_ROLES).sort().map((role) => ({
      value: role,
      label: role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    })),
  });
});

// CRUD Usuarios
router.get("/", allowSignerDirectoryLookup, controller.getUsers);
router.get("/:id", requireRole(USER_ADMIN_ROLES), controller.getUserById);
router.post("/", requireRole(USER_ADMIN_ROLES), controller.createUser);
router.put("/:id", requireRole(USER_ADMIN_ROLES), controller.updateUser);
router.delete("/:id", requireRole(USER_ADMIN_ROLES), controller.deleteUser);

module.exports = router;
