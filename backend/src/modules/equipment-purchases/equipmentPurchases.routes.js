const express = require("express");
const router = express.Router();

const ctrl = require("./equipmentPurchases.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

const allowedRoles = ["acp_comercial", "gerencia", "jefe_comercial"];

router.get("/meta", verifyToken, requireRole(allowedRoles), ctrl.getMeta);
router.get("/", verifyToken, requireRole(allowedRoles), ctrl.listMine);
router.get("/:id", verifyToken, requireRole(allowedRoles), ctrl.getOne);

router.post("/", verifyToken, requireRole(allowedRoles), ctrl.create);
router.post("/:id/provider-response", verifyToken, requireRole(allowedRoles), ctrl.saveProviderResponse);
router.post("/:id/request-proforma", verifyToken, requireRole(allowedRoles), ctrl.requestProforma);
router.post(
  "/:id/upload-proforma",
  verifyToken,
  requireRole(allowedRoles),
  ctrl.upload.single("file"),
  ctrl.uploadProforma,
);
router.post(
  "/:id/reserve",
  verifyToken,
  requireRole(allowedRoles),
  ctrl.reserve,
);
router.post(
  "/:id/upload-signed-proforma",
  verifyToken,
  requireRole(allowedRoles),
  ctrl.upload.single("file"),
  ctrl.uploadSignedProforma,
);
router.post(
  "/:id/upload-contract",
  verifyToken,
  requireRole(allowedRoles),
  ctrl.upload.single("file"),
  ctrl.uploadContract,
);

module.exports = router;
