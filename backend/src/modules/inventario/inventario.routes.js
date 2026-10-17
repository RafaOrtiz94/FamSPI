/**
 * Routes: Inventario
 * ------------------------------------------------------------
 * /api/v1/inventario
 */

const express = require("express");
const router = express.Router();
const controller = require("./inventario.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

const INVENTORY_CREATE_ROLES = [
  "comercial",
  "jefe_comercial",
  "backoffice_comercial",
  "acp_comercial",
  "servicio_tecnico",
  "tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "operaciones",
  "jefe_operaciones",
  "logistica",
  "jefe_logistica",
  "gerencia",
  "ti",
  "admin_ti",
  "admin",
];

const INVENTORY_MUTATION_ROLES = [
  "servicio_tecnico",
  "tecnico",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "operaciones",
  "jefe_operaciones",
  "logistica",
  "jefe_logistica",
  "finanzas",
  "jefe_finanzas",
  "gerencia",
  "ti",
  "admin_ti",
  "admin",
];

// Rutas protegidas (requieren JWT)
router.use(verifyToken);

// 📦 Consultar inventario completo
router.get("/", controller.getInventario);

// 📋 Listar equipos disponibles para selección
router.get("/equipos-disponibles", controller.getEquiposDisponibles);
router.get("/equipos-cliente/:cliente_id", controller.getEquiposPorCliente);
router.get("/modelos", controller.listModelos);
router.put("/modelos/:id", requireRole(INVENTORY_MUTATION_ROLES), controller.updateModelo);

// ➕ Crear unidad desde modelo
router.post("/equipos-unidad", requireRole(INVENTORY_CREATE_ROLES), controller.createUnidad);

// 🏷️ Capturar o confirmar serial de unidad
router.post("/equipos-unidad/:id/serial", requireRole(INVENTORY_MUTATION_ROLES), controller.captureSerial);

// 🎯 Asignar unidad a cliente/sucursal
router.post("/equipos-unidad/:id/asignar", requireRole(INVENTORY_MUTATION_ROLES), controller.assignUnidad);

// 🔄 Cambiar estado de unidad
router.post("/equipos-unidad/:id/cambiar-estado", requireRole(INVENTORY_MUTATION_ROLES), controller.cambiarEstadoUnidad);
router.get("/equipos-unidad/:id/historial", requireRole(INVENTORY_MUTATION_ROLES), controller.getUnidadHistorial);

// ➕ Registrar entrada o salida
router.post("/movimiento", requireRole(INVENTORY_MUTATION_ROLES), controller.addMovimiento);

module.exports = router;
