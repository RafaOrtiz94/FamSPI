const express = require("express");
const multer  = require("multer");
const { verifyToken }  = require("../../middlewares/auth");
const { requireRole }  = require("../../middlewares/roles");
const ctrl = require("./collabDeliveries.controller");
const { COLLAB_WRITE_ROLES, COLLAB_SESSION_ROLES, COLLAB_READ_ROLES } = require("./collabDeliveries.service");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(verifyToken);

// ── Catálogo ─────────────────────────────────────────────────────────────────
router.get("/catalog",         requireRole(COLLAB_READ_ROLES),  ctrl.listCatalog);
router.post("/catalog",        requireRole(COLLAB_WRITE_ROLES), ctrl.createCatalogItem);
router.patch("/catalog/:id",   requireRole(COLLAB_WRITE_ROLES), ctrl.updateCatalogItem);
router.delete("/catalog/:id",  requireRole(COLLAB_WRITE_ROLES), ctrl.deleteCatalogItem);

// ── Resumen ejecutivo ─────────────────────────────────────────────────────────
router.get("/summary", requireRole(COLLAB_READ_ROLES), ctrl.getSummary);

// ── Reportes ──────────────────────────────────────────────────────────────────
router.get("/report/full",                       requireRole(COLLAB_READ_ROLES), ctrl.getFullReport);
router.get("/report/full/pdf",                   requireRole(COLLAB_READ_ROLES), ctrl.getFullReportPdf);
router.get("/report/collaborator/:userId",        requireRole(COLLAB_READ_ROLES), ctrl.getCollaboratorReport);
router.get("/report/collaborator/:userId/pdf",    requireRole(COLLAB_READ_ROLES), ctrl.getCollaboratorReportPdf);

// ── Renovaciones (ANTES de /:id) ─────────────────────────────────────────────
router.get("/renewals",      requireRole(COLLAB_READ_ROLES),  ctrl.listRenewals);
router.patch("/renewals/:id", requireRole(COLLAB_WRITE_ROLES), ctrl.completeRenewal);

// ── Actas globales (ANTES de /:id) ───────────────────────────────────────────
router.get("/actas/:actaId",             requireRole(COLLAB_READ_ROLES),  ctrl.getActa);
router.get("/actas/:actaId/pdf",         requireRole(COLLAB_READ_ROLES),  ctrl.downloadActaPdf);
// Roles de sesion (no solo financiero) -- regenerar el PDF no es destructivo
// (no borra nada, solo re-renderiza desde la plantilla), asi que se abre al
// mismo grupo que ya puede gestionar actas de la sesion.
router.post("/actas/:actaId/pdf/regenerate", requireRole(COLLAB_SESSION_ROLES), ctrl.regenerateActaPdf);
router.get("/actas/:actaId/signature-workflow", requireRole(COLLAB_READ_ROLES), ctrl.getActaSignatureWorkflow);
router.post("/actas/:actaId/start-signature-workflow", requireRole(COLLAB_SESSION_ROLES), ctrl.startActaSignatureWorkflow);
router.post("/actas/:actaId/upload-signed",
  requireRole(COLLAB_WRITE_ROLES),
  upload.single("file"),
  ctrl.uploadSignedActa,
);

// ── Entregas por colaborador (ANTES de /:id) ──────────────────────────────────
router.get("/user/:userId",               requireRole(COLLAB_READ_ROLES), ctrl.listDeliveriesByUser);
router.get("/user/:userId/docs",          requireRole(COLLAB_READ_ROLES), ctrl.listDeliveryDocsByUser);
router.post("/user/:userId/offboarding",  requireRole(COLLAB_WRITE_ROLES), ctrl.createOffboardingTasks);

// ── Recipient info para pre-llenar acta ──────────────────────────────────────
router.get("/recipient-info/:userId", requireRole(COLLAB_READ_ROLES), ctrl.getActaRecipientInfo);

// ── Sesiones de entrega (multi-ítem, 1 acta por categoría) ───────────────────
router.get("/sessions",            requireRole(COLLAB_READ_ROLES),    ctrl.listSessions);
router.post("/sessions",           requireRole(COLLAB_SESSION_ROLES), ctrl.createCollabSession);
router.patch("/sessions/:sessionId", requireRole(COLLAB_SESSION_ROLES), ctrl.updateCollabSession);
router.get("/sessions/:sessionId", requireRole(COLLAB_READ_ROLES),    ctrl.getSession);
router.post("/sessions/ti",        requireRole(COLLAB_WRITE_ROLES),   ctrl.createTiSession);

// ── Entregas (raíz y /:id) ───────────────────────────────────────────────────
router.get("/",    requireRole(COLLAB_READ_ROLES),  ctrl.listDeliveries);
router.post("/",   requireRole(COLLAB_WRITE_ROLES), ctrl.createDelivery);

router.get("/:id",          requireRole(COLLAB_READ_ROLES),  ctrl.getDelivery);
router.patch("/:id",        requireRole(COLLAB_WRITE_ROLES), ctrl.updateDelivery);
router.post("/:id/withdraw", requireRole(COLLAB_WRITE_ROLES), ctrl.withdrawDelivery);
router.get("/:id/events",   requireRole(COLLAB_READ_ROLES),  ctrl.listDeliveryEvents);
router.get("/:id/actas",    requireRole(COLLAB_READ_ROLES),  ctrl.listActasByDelivery);
router.post("/:id/actas",   requireRole(COLLAB_WRITE_ROLES), ctrl.generateActa);
router.get("/:id/docs",     requireRole(COLLAB_READ_ROLES),  ctrl.listDeliveryDocs);
router.post("/:id/docs",    requireRole(COLLAB_WRITE_ROLES), upload.single("file"), ctrl.uploadDeliveryDoc);

module.exports = router;
