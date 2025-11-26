const express = require("express");
const router = express.Router();

const ctrl = require("./equipmentPurchases.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

const managerRoles = ["acp_comercial", "gerencia", "jefe_comercial"];
const creatorRoles = ["comercial", ...managerRoles];

router.get("/meta", verifyToken, requireRole(creatorRoles), ctrl.getMeta);
router.get("/", verifyToken, requireRole(creatorRoles), ctrl.listMine);
router.get("/:id", verifyToken, requireRole(creatorRoles), ctrl.getOne);

router.post("/", verifyToken, requireRole(creatorRoles), ctrl.create);
router.post("/:id/start-availability", verifyToken, requireRole(managerRoles), ctrl.startAvailability);
router.post("/:id/provider-response", verifyToken, requireRole(managerRoles), ctrl.saveProviderResponse);
router.post("/:id/request-proforma", verifyToken, requireRole(managerRoles), ctrl.requestProforma);
router.post(
  "/:id/upload-proforma",
  verifyToken,
  requireRole(managerRoles),
  ctrl.upload.single("file"),
  ctrl.uploadProforma,
);
router.post(
  "/:id/reserve",
  verifyToken,
  requireRole(managerRoles),
  ctrl.reserve,
);
router.post(
  "/:id/upload-signed-proforma",
  verifyToken,
  requireRole(managerRoles),
  ctrl.upload.single("file"),
  ctrl.uploadSignedProforma,
);
router.post(
  "/:id/upload-contract",
  verifyToken,
  requireRole(managerRoles),
  ctrl.upload.single("file"),
  ctrl.uploadContract,
);

router.post(
  "/:id/renew-reservation",
  verifyToken,
  requireRole(managerRoles),
  ctrl.renewReservation,
);

router.post(
  "/:id/cancel-order",
  verifyToken,
  requireRole(managerRoles),
  ctrl.cancelOrder,
);

router.post(
  "/:id/submit-signed-proforma-with-inspection",
  verifyToken,
  requireRole(managerRoles),
  ctrl.upload.single("file"),
  ctrl.submitSignedProformaWithInspection,
);

module.exports = router;
