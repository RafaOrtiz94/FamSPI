const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./ca0117.controller");

router.use(verifyToken);
router.post("/reports", requireRole(["calidad", "gerencia"]), ctrl.createReport);
router.get("/reports", requireRole(["calidad", "gerencia"]), ctrl.listReports);
router.post("/investigations", requireRole(["calidad", "gerencia"]), ctrl.createInvestigation);
router.post("/actions", requireRole(["calidad", "gerencia"]), ctrl.createCorrectiveAction);
router.put("/transition", requireRole(["calidad"]), ctrl.transitionReport);
router.get("/metrics", requireRole(["calidad", "gerencia"]), ctrl.getMetrics);

module.exports = router;