const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./ca0105.controller");

/**
 * Routes - CA-01-05 (Gestión y Control de Documentos)
 * Prefijo sugerido: /api/v1/calidad/documentos
 *
 * La exposición se mantiene privada y con RBAC autoritativo.
 */

router.use(verifyToken);

// ============ FOLDERS ============
router.post(
  "/folders",
  requireRole(["calidad", "gerencia"]),
  ctrl.createFolder
);

router.get(
  "/folders",
  requireRole(["calidad", "gerencia"]),
  ctrl.listFolders
);

router.get(
  "/folders/:id",
  requireRole(["calidad", "gerencia"]),
  ctrl.getFolder
);

router.put(
  "/folders/:id",
  requireRole(["calidad", "gerencia"]),
  ctrl.updateFolder
);

router.delete(
  "/folders/:id",
  requireRole(["calidad"]),
  ctrl.deleteFolder
);

// ============ DOCUMENTS ============
router.post(
  "/documents",
  requireRole(["calidad", "gerencia"]),
  ctrl.createDocument
);

router.get(
  "/documents",
  requireRole(["calidad", "gerencia"]),
  ctrl.listDocuments
);

router.get(
  "/documents/:id",
  requireRole(["calidad", "gerencia"]),
  ctrl.getDocument
);

router.put(
  "/documents/:id",
  requireRole(["calidad", "gerencia"]),
  ctrl.updateDocument
);

router.delete(
  "/documents/:id",
  requireRole(["calidad"]),
  ctrl.deleteDocument
);

// ============ DOCUMENT VERSIONS ============
router.post(
  "/versions",
  requireRole(["calidad", "gerencia"]),
  ctrl.createDocumentVersion
);

router.get(
  "/versions",
  requireRole(["calidad", "gerencia"]),
  ctrl.listDocumentVersions
);

router.get(
  "/versions/:id",
  requireRole(["calidad", "gerencia"]),
  ctrl.getDocumentVersion
);

// ============ PERMISSIONS ============
router.post(
  "/permissions",
  requireRole(["calidad", "gerencia"]),
  ctrl.createDocumentPermission
);

router.get(
  "/permissions",
  requireRole(["calidad", "gerencia"]),
  ctrl.listDocumentPermissions
);

// ============ LEGACY: Snapshot & Transition ============
router.post(
  "/snapshots",
  requireRole(["calidad", "gerencia"]),
  ctrl.buildSnapshot
);

router.post(
  "/validate-transition",
  requireRole(["calidad", "gerencia"]),
  ctrl.validateTransition
);

router.put(
  "/workflows/transition",
  requireRole(["calidad"]),
  ctrl.transitionRecord
);

module.exports = router;