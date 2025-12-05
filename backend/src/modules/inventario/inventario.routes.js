/**
 * Routes: Inventario
 * ------------------------------------------------------------
 * /api/v1/inventario
 */

const express = require("express");
const router = express.Router();
const controller = require("./inventario.controller");
const { verifyToken } = require("../../middlewares/auth");

// Rutas protegidas (requieren JWT)
router.use(verifyToken);

// 📦 Consultar inventario completo
router.get("/", controller.getInventario);

// 📋 Listar equipos disponibles para selección
router.get("/equipos-disponibles", controller.getEquiposDisponibles);

// ➕ Registrar entrada o salida
router.post("/movimiento", controller.addMovimiento);

module.exports = router;
