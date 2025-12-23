const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const ctrl = require("./signature.controller");

// =============================================================================
// FIRMA AVANZADA
// =============================================================================

// POST /api/signature/documents/:documentId/sign
// Firma avanzada completa con sello institucional y QR
router.post("/documents/:documentId/sign", verifyToken, ctrl.signDocument);

// =============================================================================
// VERIFICACIÓN PÚBLICA
// =============================================================================

// GET /api/signature/verificar/:token
// Verificación pública de documentos (rate-limited)
router.get("/verificar/:token", ctrl.verifyDocument);

// =============================================================================
// AUDITORÍA Y REPORTES (REQUIERE AUTENTICACIÓN)
// =============================================================================

// GET /api/signature/documents/:documentId/audit-trail
// Trail completo de auditoría de un documento
router.get("/documents/:documentId/audit-trail", verifyToken, ctrl.getDocumentAuditTrail);

// GET /api/signature/dashboard
// Dashboard de métricas de firmas
router.get("/dashboard", verifyToken, ctrl.getSignatureDashboard);

// =============================================================================
// LEGACY ENDPOINTS (para compatibilidad)
// =============================================================================

// Alias para compatibilidad hacia atrás
router.get("/verify/:token", ctrl.verifyDocument);

module.exports = router;
