const express = require("express");
const multer  = require("multer");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./tiAssets.controller");
const { TI_ROLES, TI_READ_ROLES } = require("./tiAssets.service");

const router   = express.Router();
const upload   = multer({ storage: multer.memoryStorage() });

router.use(verifyToken);

// ── Read-only routes (TI + Financiero) ───────────────────────────────────────
router.get("/",                          requireRole(TI_READ_ROLES), ctrl.listAssets);
router.get("/maintenance/list",          requireRole(TI_READ_ROLES), ctrl.listMaintenance);
router.get("/maintenance/diagnose",      requireRole(TI_READ_ROLES), ctrl.diagnoseMaintenance);
router.get("/reports",                   requireRole(TI_READ_ROLES), ctrl.listReports);
router.get("/reports/download",          requireRole(TI_READ_ROLES), ctrl.downloadReport);
router.get("/:id/history",              requireRole(TI_READ_ROLES), ctrl.listHistory);
router.get("/:id/assignments-history",  requireRole(TI_READ_ROLES), ctrl.listAssignmentsHistory);
router.get("/:id/accessories",          requireRole(TI_READ_ROLES), ctrl.listAccessories);
router.get("/:id/actas",                requireRole(TI_READ_ROLES), ctrl.listActas);
router.get("/actas",                    requireRole(TI_READ_ROLES), ctrl.listAllActas);
router.get("/actas/:actaId",            requireRole(TI_READ_ROLES), ctrl.getActa);
router.get("/actas/:actaId/pdf",        requireRole(TI_READ_ROLES), ctrl.downloadActaPdf);

// Reports (on-demand PDF, financiero can access)
router.get("/reports/asset/:id",               requireRole(TI_READ_ROLES), ctrl.downloadAssetReport);
router.get("/reports/collaborator/:userId",    requireRole(TI_READ_ROLES), ctrl.downloadCollaboratorReport);

// Recipient info for acta pre-fill
router.get("/recipient-info/:userId", requireRole(TI_ROLES), ctrl.getActaRecipientInfo);

// Financial docs (factura / letra de cambio) — both TI and financiero can list and upload
router.get("/:id/financial-docs",              requireRole(TI_READ_ROLES), ctrl.listFinancialDocs);
router.get("/:id/letras-de-cambio-history",   requireRole(TI_READ_ROLES), ctrl.getLetrasDeChangioHistory);
router.post("/:id/financial-docs",             requireRole(TI_READ_ROLES), upload.single("file"), ctrl.uploadFinancialDoc);

// ── Write routes (TI only) ────────────────────────────────────────────────────
router.post("/",                         requireRole(TI_ROLES), ctrl.createAsset);
router.post("/batch/assign",             requireRole(TI_ROLES), ctrl.assignMultipleAssets);
router.patch("/:id",                     requireRole(TI_ROLES), ctrl.updateAsset);
router.post("/:id/assign",               requireRole(TI_ROLES), ctrl.assignAsset);
router.post("/:id/status",               requireRole(TI_ROLES), ctrl.updateStatus);
router.post("/:id/accessories",          requireRole(TI_ROLES), ctrl.createAccessory);
router.patch("/:id/accessories/:accId",  requireRole(TI_ROLES), ctrl.updateAccessory);
router.delete("/:id/accessories/:accId", requireRole(TI_ROLES), ctrl.removeAccessory);

// Maintenance write
router.delete("/maintenance",                        requireRole(TI_ROLES), ctrl.clearAllMaintenance);
router.post("/maintenance",                          requireRole(TI_ROLES), ctrl.createMaintenance);
router.patch("/maintenance/:id/coordination-date",   requireRole(TI_ROLES), ctrl.setMaintenanceCoordinationDate);
router.post("/maintenance/annual/generate",          requireRole(TI_ROLES), ctrl.generateAnnualMaintenance);
router.post("/maintenance/generate",                 requireRole(TI_ROLES), ctrl.generateFutureMaintenance);
router.post("/maintenance/refresh",                  requireRole(TI_ROLES), ctrl.generateFutureMaintenance);
router.post("/maintenance/:id/complete",             requireRole(TI_ROLES), ctrl.completeMaintenance);
router.post("/maintenance/:id/request-delivery",     requireRole(TI_ROLES), ctrl.requestMaintenanceDelivery);

// Reports write
router.post("/reports/generate", requireRole(TI_ROLES), ctrl.generateReport);

// Signed acta upload (TI only)
router.post("/actas/:actaId/upload-signed",
  requireRole(TI_ROLES),
  upload.single("file"),
  ctrl.uploadSignedActa,
);

// ── FASE 6: Liberation (TI only) ──────────────────────────────────────────
router.post("/:id/liberate",                        requireRole(TI_ROLES), upload.single("photo"), ctrl.liberateAsset);
router.get("/:id/liberation-photos",               requireRole(TI_READ_ROLES), ctrl.getLiberationPhotos);

// ── FASE 2: Corporate Numbers (TI + Financiero can read, TI only can write) ──
router.get("/corporate-numbers",                    requireRole(TI_READ_ROLES), ctrl.listCorporateNumbers);
router.get("/corporate-numbers/:id",                requireRole(TI_READ_ROLES), ctrl.getCorporateNumber);
router.get("/corporate-numbers/:id/history",       requireRole(TI_READ_ROLES), ctrl.getCorporateNumberHistory);
router.post("/corporate-numbers",                   requireRole(TI_ROLES), ctrl.createCorporateNumber);
router.post("/corporate-numbers/:id/assign",       requireRole(TI_ROLES), ctrl.assignCorporateNumber);
router.post("/corporate-numbers/:currentId/change", requireRole(TI_ROLES), ctrl.changeCorporateNumber);

module.exports = router;
