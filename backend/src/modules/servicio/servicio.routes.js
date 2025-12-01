const express = require("express");
const router = express.Router();
const controller = require("./servicio.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

// Rutas protegidas por verifyToken + requireRole

// ======================================================
// 🧠 CAPACITACIONES
// ======================================================
router.get("/capacitaciones", verifyToken, requireRole(["tecnico", "gerencia"]), controller.getCapacitaciones);
router.post("/capacitaciones", verifyToken, requireRole(["tecnico"]), controller.createCapacitacion);
router.put("/capacitaciones/:id", verifyToken, requireRole(["tecnico"]), controller.updateCapacitacion);
router.delete("/capacitaciones/:id", verifyToken, requireRole(["tecnico", "gerencia"]), controller.deleteCapacitacion);

// ======================================================
// ✅ DISPONIBILIDAD DE TÉCNICOS
// ======================================================
router.get(
  "/disponibilidad",
  verifyToken,
  requireRole(["servicio_tecnico", "tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.getDisponibilidadTecnicos
);
router.post(
  "/disponibilidad",
  verifyToken,
  requireRole(["servicio_tecnico", "tecnico", "jefe_servicio_tecnico", "gerencia"]),
  controller.updateDisponibilidadTecnico
);

// ======================================================
// ⚙️ EQUIPOS
// ======================================================
router.get("/equipos", verifyToken, requireRole(["tecnico", "gerencia", "jefe_tecnico"]), controller.getEquipos);
router.post("/equipos", verifyToken, requireRole(["tecnico", "gerencia"]), controller.createEquipo);

// ======================================================
// 🛠️ MANTENIMIENTOS
// ======================================================
router.get("/mantenimientos", verifyToken, requireRole(["tecnico", "gerencia"]), controller.getMantenimientos);

// ======================================================
// 📅 MANTENIMIENTOS ANUALES
// ======================================================
router.get("/mantenimientos-anuales", verifyToken, requireRole(["tecnico", "gerencia"]), controller.getMantenimientosAnuales);
router.post("/mantenimientos-anuales", verifyToken, requireRole(["gerencia", "tecnico"]), controller.createMantenimientoAnual);

module.exports = router;
