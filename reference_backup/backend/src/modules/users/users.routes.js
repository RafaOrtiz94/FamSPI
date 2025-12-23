// src/modules/users/users.routes.js
const express = require("express");
const router = express.Router();
const controller = require("./users.controller");
const { verifyToken } = require("../../middlewares/auth");

// Todas las rutas requieren autenticación
router.use(verifyToken);

// CRUD Usuarios
router.get("/", controller.getUsers);
router.get("/:id", controller.getUserById);
router.post("/", controller.createUser);
router.put("/:id", controller.updateUser);
router.delete("/:id", controller.deleteUser);

module.exports = router;
