const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./ca0113.controller");

router.use(verifyToken);

router.post("/communications", requireRole(["calidad", "gerencia"]), ctrl.createCommunication);
router.get("/communications", requireRole(["calidad", "gerencia", "comercial", "servicio_tecnico"]), ctrl.listCommunications);
router.post("/recipients", requireRole(["calidad", "gerencia"]), ctrl.createRecipient);
router.get("/recipients", requireRole(["calidad", "gerencia"]), ctrl.listRecipients);
router.post("/attachments", requireRole(["calidad", "gerencia"]), ctrl.createAttachment);
router.get("/attachments", requireRole(["calidad", "gerencia"]), ctrl.listAttachments);
router.post("/read", requireRole(["calidad", "gerencia", "comercial", "servicio_tecnico"]), ctrl.markAsRead);
router.get("/read-logs", requireRole(["calidad", "gerencia"]), ctrl.listReadLogs);
router.post("/templates", requireRole(["calidad", "gerencia"]), ctrl.createTemplate);
router.get("/templates", requireRole(["calidad", "gerencia"]), ctrl.listTemplates);
router.put("/workflows/transition", requireRole(["calidad"]), ctrl.transitionRecord);
router.get("/metrics", requireRole(["calidad", "gerencia"]), ctrl.getMetrics);

module.exports = router;