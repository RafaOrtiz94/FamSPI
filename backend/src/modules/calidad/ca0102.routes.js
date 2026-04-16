const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./ca0102.controller");

/**
 * Routes - CA-01-02 (Limpieza de Áreas GXP)
 * Prefijo montado en: /api/v1/calidad/cleaning
 */

router.use(authMiddleware);

// Gestión de Áreas (solo Calidad)
router.post("/areas",         requireRole(["calidad"]),         ctrl.createArea);
router.get("/areas",          requireRole(["calidad", "gerencia"]), ctrl.getAreas);

// Registro de Limpieza (operadores de campo + calidad)
router.post("/logs",          requireRole(["calidad", "servicio_tecnico", "operaciones"]), ctrl.registerCleaning);
router.get("/logs",           requireRole(["calidad", "gerencia"]), ctrl.getActiveLogs);

// Transición QA (solo Calidad valida y cierra)
router.put("/logs/:logId",    requireRole(["calidad"]), ctrl.transitionLog);

module.exports = router;
