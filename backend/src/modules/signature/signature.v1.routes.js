const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const ctrl = require("./signature.controller");

const router = express.Router();

router.post("/documents/:documentId/sign", verifyToken, ctrl.signDocument);
router.get("/documents/:documentId/audit-trail", verifyToken, ctrl.getDocumentAuditTrail);
router.get("/dashboard", verifyToken, ctrl.getSignatureDashboard);
router.get("/verificar/:token", ctrl.verifyDocument);
router.get("/verify/:token", ctrl.verifyDocument);

module.exports = router;
