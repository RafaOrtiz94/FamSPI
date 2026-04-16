const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./ca0112.controller");

router.use(verifyToken);

router.post("/evaluations", requireRole(["calidad", "gerencia"]), ctrl.createEvaluation);
router.get("/evaluations", requireRole(["calidad", "gerencia"]), ctrl.listEvaluations);
router.post("/practices", requireRole(["calidad", "gerencia"]), ctrl.createPracticeVerification);
router.get("/practices", requireRole(["calidad", "gerencia"]), ctrl.listPracticeVerifications);
router.post("/non-compliances", requireRole(["calidad", "gerencia"]), ctrl.createNonCompliance);
router.get("/non-compliances", requireRole(["calidad", "gerencia"]), ctrl.listNonCompliances);
router.post("/ppe-checks", requireRole(["calidad", "gerencia"]), ctrl.createPpeCheck);
router.get("/ppe-checks", requireRole(["calidad", "gerencia"]), ctrl.listPpeChecks);
router.post("/trainings", requireRole(["calidad", "gerencia"]), ctrl.createTraining);
router.get("/trainings", requireRole(["calidad", "gerencia"]), ctrl.listTrainings);
router.put("/workflows/transition", requireRole(["calidad"]), ctrl.transitionRecord);
router.get("/metrics", requireRole(["calidad", "gerencia"]), ctrl.getMetrics);

module.exports = router;