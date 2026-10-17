const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./ca0115.controller");

router.use(verifyToken);
router.post("/audits", requireRole(["calidad", "gerencia"]), ctrl.createAudit);
router.get("/audits", requireRole(["calidad", "gerencia"]), ctrl.listAudits);
router.post("/findings", requireRole(["calidad", "gerencia"]), ctrl.createFinding);
router.get("/findings", requireRole(["calidad", "gerencia"]), ctrl.listFindings);
router.post("/evidences", requireRole(["calidad", "gerencia"]), ctrl.createEvidence);
router.post("/checklists", requireRole(["calidad", "gerencia"]), ctrl.createChecklist);
router.get("/checklists", requireRole(["calidad", "gerencia"]), ctrl.listChecklists);
router.put("/workflows/transition", requireRole(["calidad"]), ctrl.transitionRecord);
router.get("/metrics", requireRole(["calidad", "gerencia"]), ctrl.getMetrics);

module.exports = router;