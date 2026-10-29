const express = require("express");
const router = express.Router();
const ctrl = require("./documents.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

// Crear documento desde plantilla (para un request)
router.post(
  "/from-template",
  verifyToken,
  requireRole(["tecnico", "comercial", "gerencia"]),
  ctrl.createFromTemplate
);

// Insertar firma (canvas base64) en un documento usando un tag (p.ej. {{FIRMA_RESPONSABLE}})
router.post(
  "/:documentId/sign",
  verifyToken,
  requireRole(["tecnico", "gerencia"]),
  ctrl.signAtTag
);

router.post(
  "/:documentId/sign-advanced",
  verifyToken,
  requireRole(["tecnico", "gerencia"]),
  ctrl.signAdvanced
);

// Exportar a PDF y registrar
router.post(
  "/:documentId/export-pdf",
  verifyToken,
  requireRole(["tecnico", "gerencia"]),
  ctrl.exportPdf
);

// Obtener documento y listar por request
router.get("/by-request/:requestId", verifyToken, ctrl.listByRequest);
router.get("/:documentId", verifyToken, ctrl.getDocument);

module.exports = router;
