const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./tiAssets.controller");
const { TI_ROLES } = require("./tiAssets.service");

const router = express.Router();

router.use(verifyToken);
router.use(requireRole(TI_ROLES));

router.get("/", ctrl.listAssets);
router.post("/", ctrl.createAsset);
router.get("/maintenance/list", ctrl.listMaintenance);
router.delete("/maintenance", ctrl.clearAllMaintenance);
router.post("/maintenance", ctrl.createMaintenance);
router.patch("/maintenance/:id/coordination-date", ctrl.setMaintenanceCoordinationDate);
router.post("/maintenance/annual/generate", ctrl.generateAnnualMaintenance);
router.post("/maintenance/generate", ctrl.generateFutureMaintenance);
router.post("/maintenance/refresh", ctrl.generateFutureMaintenance);
router.get("/maintenance/diagnose", ctrl.diagnoseMaintenance);
router.get("/reports", ctrl.listReports);
router.post("/reports/generate", ctrl.generateReport);
router.get("/reports/download", ctrl.downloadReport);
router.post("/maintenance/:id/complete", ctrl.completeMaintenance);
router.post("/maintenance/:id/request-delivery", ctrl.requestMaintenanceDelivery);
router.patch("/:id", ctrl.updateAsset);
router.post("/:id/assign", ctrl.assignAsset);
router.post("/:id/status", ctrl.updateStatus);
router.get("/:id/history", ctrl.listHistory);
router.get("/:id/assignments-history", ctrl.listAssignmentsHistory);

module.exports = router;
