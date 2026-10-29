const express = require("express");
const { verifyToken, requireRole } = require("../../middlewares/auth");
const controller = require("./supportTicketsAdmin.controller");

const router = express.Router();

// Reportes mensuales y configuracion de KPIs del workspace de tickets TI:
// exclusivo de jefe_ti (decision explicita del rework -- no incluye admin_ti
// aunque ese rol administre el resto de paneles admin de TI en el repo).
router.use(verifyToken, requireRole(["jefe_ti"]));

router.get("/kpi-definitions", controller.listKpiDefinitions);
router.get("/kpi-definitions/metric-catalog", controller.getKpiMetricCatalog);
router.post("/kpi-definitions", controller.createKpiDefinition);
router.put("/kpi-definitions/:id", controller.updateKpiDefinition);
router.delete("/kpi-definitions/:id", controller.deleteKpiDefinition);
router.patch("/kpi-definitions/reorder", controller.reorderKpiDefinitions);

router.get("/reports/monthly", controller.getMonthlyReport);
router.get("/reports/monthly/export", controller.exportMonthlyReport);

module.exports = router;
