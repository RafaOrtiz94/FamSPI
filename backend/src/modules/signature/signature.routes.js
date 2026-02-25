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

// =============================================================================
// VERIFICACIÃ“N PÃšBLICA
// =============================================================================

// GET /api/signature/verificar/:token
// VerificaciÃ³n pÃºblica de documentos (rate-limited)
router.get("/verificar/:token", ctrl.verifyDocument);

// =============================================================================
// AUDITORÃA Y REPORTES (REQUIERE AUTENTICACIÃ“N)
// =============================================================================

// GET /api/signature/documents/:documentId/audit-trail
// Trail completo de auditorÃ­a de un documento
router.get("/documents/:documentId/audit-trail", verifyToken, ctrl.getDocumentAuditTrail);

// GET /api/signature/dashboard
// Dashboard de mÃ©tricas de firmas
router.get("/dashboard", verifyToken, ctrl.getSignatureDashboard);

// =============================================================================
// LEGACY ENDPOINTS (para compatibilidad)
// =============================================================================

// Alias para compatibilidad hacia Atrás
router.get("/verify/:token", ctrl.verifyDocument);

module.exports = router;

