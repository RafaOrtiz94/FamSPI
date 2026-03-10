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

// Todas las rutas requieren autenticación
router.use(verifyToken);

// CRUD Usuarios
router.get("/", controller.getUsers);
router.get("/:id", requireRole(USER_ADMIN_ROLES), controller.getUserById);
router.post("/", requireRole(USER_ADMIN_ROLES), controller.createUser);
router.put("/:id", requireRole(USER_ADMIN_ROLES), controller.updateUser);
router.delete("/:id", requireRole(USER_ADMIN_ROLES), controller.deleteUser);

module.exports = router;
