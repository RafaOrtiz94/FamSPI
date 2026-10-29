const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./ca0106.controller");

router.use(verifyToken);

router.post("/traceability", requireRole(["calidad", "gerencia"]), ctrl.createTraceability);
router.get("/traceability", requireRole(["calidad", "gerencia"]), ctrl.listTraceability);

router.post("/communications", requireRole(["calidad", "gerencia"]), ctrl.createCommunication);
router.get("/communications", requireRole(["calidad", "gerencia"]), ctrl.listCommunications);

router.post("/quarantine", requireRole(["calidad", "gerencia"]), ctrl.createQuarantine);
router.get("/quarantine", requireRole(["calidad", "gerencia"]), ctrl.listQuarantine);

router.post("/logistics", requireRole(["calidad", "gerencia"]), ctrl.createLogistics);
router.get("/logistics", requireRole(["calidad", "gerencia"]), ctrl.listLogistics);

router.put("/workflows/transition", requireRole(["calidad"]), ctrl.transitionRecord);

module.exports = router;