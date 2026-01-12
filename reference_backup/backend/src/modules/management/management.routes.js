// src/modules/management/management.routes.js
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth"); // ✅ Solo verifyToken viene de auth.js
const { requireRole } = require("../../middlewares/roles"); // ✅ requireRole viene de roles.js
const managementController = require("./management.controller");

// ✅ Primero verifica el token
router.use(verifyToken);

// ✅ Luego restringe el acceso por rol
router.use(requireRole(["gerente_general", "admin"]));

// === Rutas del dashboard de gerencia ===
router.get("/stats", managementController.getGlobalStats);
router.get("/requests", managementController.listAllRequests);
router.get("/trace/:id", managementController.getRequestTrace);
router.get("/documents/:id", managementController.getRequestDocuments);

module.exports = router;
