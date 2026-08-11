const express = require("express");

const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const ctrl = require("./consumableFiles.controller");

const router = express.Router();

const viewerRoles = [
  "comercial",
  "asesor_comercial",
  "analista_comercial",
  "acp_comercial",
  "backoffice",
  "backoffice_comercial",
  "jefe_comercial",
  "jefe_de_comercial",
  "jefe_operaciones",
  "operaciones",
  "jefe_logistica",
  "logistica",
  "gerencia",
  "gerencia_general",
];

const editRoles = [
  "comercial",
  "asesor_comercial",
  "analista_comercial",
  "acp_comercial",
  "backoffice",
  "backoffice_comercial",
  "jefe_comercial",
  "jefe_de_comercial",
  "gerencia",
  "gerencia_general",
];

const reviewRoles = ["jefe_operaciones", "gerencia", "gerencia_general"];
const dispatchRoles = ["jefe_logistica", "logistica", "gerencia", "gerencia_general"];

router.get("/by-purchase", verifyToken, requireRole(viewerRoles), ctrl.getByPurchase);
router.get("/overview", verifyToken, requireRole(viewerRoles), ctrl.getOverview);
router.get("/catalog/search", verifyToken, requireRole(viewerRoles), ctrl.searchCatalog);
router.post("/catalog/standalone-preview", verifyToken, requireRole(viewerRoles), ctrl.previewStandaloneCatalog);
router.post("/standalone", verifyToken, requireRole(["comercial"]), ctrl.createStandalone);
router.post("/standalone/parse-preview", verifyToken, requireRole(["comercial"]), ctrl.previewStandaloneBusinessCase);
router.post("/standalone/request-client-assignment", verifyToken, requireRole(["comercial"]), ctrl.requestClientAssignment);
router.post("/:id/standalone-documents", verifyToken, requireRole(editRoles), ctrl.uploadStandaloneDocument);
router.post("/:id/standalone-business-case", verifyToken, requireRole(editRoles), ctrl.importStandaloneBusinessCase);
router.post("/from-purchase", verifyToken, requireRole(editRoles), ctrl.createFromPurchase);
router.get("/:id", verifyToken, requireRole(viewerRoles), ctrl.getOne);
router.patch("/:id", verifyToken, requireRole(editRoles), ctrl.updateHeader);
router.post("/:id/sections", verifyToken, requireRole(editRoles), ctrl.createSection);
router.post("/sections/:sectionId/import-business-case", verifyToken, requireRole(editRoles), ctrl.importBusinessCase);
router.post("/sections/:sectionId/lines", verifyToken, requireRole(editRoles), ctrl.addLine);
router.patch("/lines/:lineId", verifyToken, requireRole(editRoles), ctrl.updateLine);
router.delete("/lines/:lineId", verifyToken, requireRole(editRoles), ctrl.deleteLine);
router.post("/sections/:sectionId/import-equipment", verifyToken, requireRole(editRoles), ctrl.importEquipment);
router.post("/:id/register", verifyToken, requireRole(editRoles), ctrl.registerFile);
router.post("/:id/cancel", verifyToken, requireRole(viewerRoles), ctrl.cancelFile);
router.post("/:id/orders", verifyToken, requireRole(editRoles), ctrl.createOrder);
router.post("/orders/:orderId/review-extra", verifyToken, requireRole(reviewRoles), ctrl.reviewExtra);
router.post("/orders/:orderId/dispatch", verifyToken, requireRole(dispatchRoles), ctrl.dispatchOrder);
router.post("/orders/:orderId/cancel", verifyToken, requireRole(viewerRoles), ctrl.cancelOrder);

module.exports = router;
