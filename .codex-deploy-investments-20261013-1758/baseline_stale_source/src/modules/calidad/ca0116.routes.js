const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./ca0116.controller");

router.use(verifyToken);
router.post("/batches", requireRole(["calidad", "gerencia"]), ctrl.createBatch);
router.get("/batches", requireRole(["calidad", "gerencia"]), ctrl.listBatches);
router.post("/analysis", requireRole(["calidad", "gerencia"]), ctrl.createAnalysisResult);
router.post("/approvals", requireRole(["calidad", "gerencia"]), ctrl.createApproval);
router.post("/releases", requireRole(["calidad", "gerencia"]), ctrl.createRelease);
router.put("/transition", requireRole(["calidad"]), ctrl.transitionBatch);
router.get("/metrics", requireRole(["calidad", "gerencia"]), ctrl.getMetrics);

module.exports = router;