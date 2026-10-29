const express = require("express");
const router = express.Router();
const { requireRole } = require("../../middlewares/auth");
const ctrl = require("./auditPrep.controller");

// Estado general y feature flag
router.get("/status", ctrl.getStatus);
router.put("/status", requireRole(["admin_ti", "jefe_ti"]), ctrl.updateStatus);

// Checklist y secciones configurables
router.get("/sections", ctrl.listSections);
router.post("/sections", requireRole(["admin_ti", "jefe_ti"]), ctrl.upsertSection);

// Documentos
router.get("/documents", ctrl.listDocuments);
router.post("/documents/upload", ctrl.uploadDocument);
router.patch("/documents/:id/status", ctrl.updateDocumentStatus);
router.get("/documents/:id/download", ctrl.downloadDocument);

// Acceso externo temporal
router.get(
  "/external-access",
  requireRole(["admin_ti", "jefe_ti"]),
  ctrl.listExternalAccess
);
router.post(
  "/external-access",
  requireRole(["admin_ti", "jefe_ti"]),
  ctrl.addExternalAccess
);
router.delete(
  "/external-access/:id",
  requireRole(["admin_ti", "jefe_ti"]),
  ctrl.revokeExternalAccess
);

module.exports = router;
