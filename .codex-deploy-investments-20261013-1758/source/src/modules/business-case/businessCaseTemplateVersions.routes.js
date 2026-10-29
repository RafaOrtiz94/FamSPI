const express = require("express");
const multer = require("multer");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./businessCaseTemplateVersions.controller");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Solo jefe_comercial administra la plantilla base del BC.
router.use(verifyToken, requireRole(["jefe_comercial"]));

router.get("/", ctrl.getStatus);
router.post("/", upload.single("file"), ctrl.uploadVersion);
router.post("/:id/activate", ctrl.activateVersion);
router.post("/:id/reject", ctrl.rejectVersion);
router.get("/catalog-diff", ctrl.getCatalogDiff);
router.post("/catalog-sync", ctrl.syncCatalog);
router.get("/investment-catalog-diff", ctrl.getInvestmentCatalogDiff);
router.post("/investment-catalog-sync", ctrl.syncInvestmentCatalog);
router.get("/equipment-sheet-mapping-report", ctrl.getEquipmentSheetMappingReport);

module.exports = router;
