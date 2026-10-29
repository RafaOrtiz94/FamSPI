const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./ca0111.controller");

router.use(verifyToken);

router.post("/incidents", requireRole(["calidad", "gerencia"]), ctrl.createIncident);
router.get("/incidents", requireRole(["calidad", "gerencia"]), ctrl.listIncidents);
router.post("/containment", requireRole(["calidad", "gerencia"]), ctrl.createContainmentAction);
router.get("/containment", requireRole(["calidad", "gerencia"]), ctrl.listContainmentActions);
router.post("/hazardous", requireRole(["calidad", "gerencia"]), ctrl.createHazardousMaterial);
router.get("/hazardous", requireRole(["calidad", "gerencia"]), ctrl.listHazardousMaterials);
router.post("/affected", requireRole(["calidad", "gerencia"]), ctrl.createAffected);
router.get("/affected", requireRole(["calidad", "gerencia"]), ctrl.listAffected);
router.post("/cleanup", requireRole(["calidad", "gerencia"]), ctrl.createCleanupAction);
router.get("/cleanup", requireRole(["calidad", "gerencia"]), ctrl.listCleanupActions);
router.put("/workflows/transition", requireRole(["calidad"]), ctrl.transitionRecord);
router.get("/metrics", requireRole(["calidad", "gerencia"]), ctrl.getMetrics);

module.exports = router;