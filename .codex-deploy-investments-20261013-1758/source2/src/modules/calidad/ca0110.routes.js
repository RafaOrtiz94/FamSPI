const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./ca0110.controller");

router.use(verifyToken);

router.post("/fmea", requireRole(["calidad", "gerencia"]), ctrl.createFmea);
router.get("/fmea", requireRole(["calidad", "gerencia"]), ctrl.listFmea);
router.post("/mitigation", requireRole(["calidad", "gerencia"]), ctrl.createMitigation);
router.get("/mitigation", requireRole(["calidad", "gerencia"]), ctrl.listMitigation);
router.post("/reviews", requireRole(["calidad", "gerencia"]), ctrl.createReview);
router.get("/reviews", requireRole(["calidad", "gerencia"]), ctrl.listReviews);
router.post("/impact", requireRole(["calidad", "gerencia"]), ctrl.createImpactAssessment);
router.get("/impact", requireRole(["calidad", "gerencia"]), ctrl.listImpactAssessment);
router.put("/workflows/transition", requireRole(["calidad"]), ctrl.transitionRecord);
router.get("/metrics", requireRole(["calidad", "gerencia"]), ctrl.getMetrics);

module.exports = router;