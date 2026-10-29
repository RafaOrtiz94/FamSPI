const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ca0101Controller = require("./ca0101.controller");

/**
 * Routes - CA-01-01 (Control de Temperatura GXP)
 * -------------------------------------------------------------
 * Expone endpoints ISO 9001. Requiere RBAC para Quality Management.
 */

// Todos los endpoints de calidad son privados
router.use(verifyToken);

// POST: Registrar lectura de termohigrómetro. 
// Permitido para Calidad, Mantenimiento, o Técnicos delegados.
router.post(
  "/temperature/readings",
  requireRole(["calidad", "servicio_tecnico", "operaciones"]),
  ca0101Controller.registerReading
);

// GET: Tablero de mando de desviaciones (Alarmas)
// Requerido por Jefes de Calidad para revisión.
router.get(
  "/temperature/alarms",
  requireRole(["calidad", "gerencia"]),
  ca0101Controller.getActiveAlarms
);

// PUT: Evaluar/Escalar Alarma (State Machine transition)
router.put(
  "/temperature/alarms/:alarmId",
  requireRole(["calidad"]),
  ca0101Controller.transitionAlarm
);

module.exports = router;
