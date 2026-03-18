// src/modules/users/users.routes.js
const express = require("express");
const router = express.Router();
const controller = require("./users.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

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
];

// Todas las rutas requieren autenticación
router.use(verifyToken);

// CRUD Usuarios
router.get("/", requireRole(USER_DIRECTORY_ROLES), controller.getUsers);
router.get("/:id", requireRole(USER_ADMIN_ROLES), controller.getUserById);
router.post("/", requireRole(USER_ADMIN_ROLES), controller.createUser);
router.put("/:id", requireRole(USER_ADMIN_ROLES), controller.updateUser);
router.delete("/:id", requireRole(USER_ADMIN_ROLES), controller.deleteUser);

module.exports = router;
