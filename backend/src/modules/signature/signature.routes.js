const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const ctrl = require("./signature.controller");

// =============================================================================
// FamSign
// =============================================================================

// POST /api/signature/documents/:documentId/sign
// FamSign completo con sello institucional y QR
router.post("/documents/:documentId/sign", verifyToken, ctrl.signDocument);

router.get("/verificar/:token", ctrl.verifyDocument);


router.get("/documents/:documentId/audit-trail", verifyToken, ctrl.getDocumentAuditTrail);

// GET /api/signature/dashboard
router.get("/dashboard", verifyToken, ctrl.getSignatureDashboard);

// =============================================================================
// LEGACY ENDPOINTS (para compatibilidad)
// =============================================================================

// Alias para compatibilidad hacia Atrás
router.get("/verify/:token", ctrl.verifyDocument);

module.exports = router;

