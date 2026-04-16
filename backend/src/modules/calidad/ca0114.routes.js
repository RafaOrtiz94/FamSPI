const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./ca0114.controller");

router.use(verifyToken);

router.post("/areas", requireRole(["calidad", "gerencia"]), ctrl.createArea);
router.get("/areas", requireRole(["calidad", "gerencia"]), ctrl.listAreas);
router.post("/params", requireRole(["calidad", "gerencia"]), ctrl.createQualificationParam);
router.get("/params", requireRole(["calidad", "gerencia"]), ctrl.listQualificationParams);
router.post("/monitoring", requireRole(["calidad", "gerencia"]), ctrl.createMonitoringResult);
router.get("/monitoring", requireRole(["calidad", "gerencia"]), ctrl.listMonitoringResults);
router.post("/deviations", requireRole(["calidad", "gerencia"]), ctrl.createDeviation);
router.get("/deviations", requireRole(["calidad", "gerencia"]), ctrl.listDeviations);
router.post("/docs", requireRole(["calidad", "gerencia"]), ctrl.createQualificationDoc);
router.get("/docs", requireRole(["calidad", "gerencia"]), ctrl.listQualificationDocs);
router.put("/workflows/transition", requireRole(["calidad"]), ctrl.transitionRecord);
router.get("/metrics", requireRole(["calidad", "gerencia"]), ctrl.getMetrics);

module.exports = router;