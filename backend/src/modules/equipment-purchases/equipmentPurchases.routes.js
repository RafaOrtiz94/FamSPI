const express = require("express");
const router = express.Router();

const ctrl = require("./equipmentPurchases.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const { streamPurchaseUpdates } = require("./purchaseEvents");

const managerRoles = ["acp_comercial", "gerencia", "gerencia_general", "jefe_comercial"];
const creatorRoles = ["comercial", ...managerRoles];
const viewerRoles = Array.from(new Set([
  ...creatorRoles,
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "tecnico",
  "jefe_operaciones",
]));
const inspectionCoordinationRoles = Array.from(new Set([
  ...creatorRoles,
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "tecnico",
]));

const attachTokenFromQuery = (req, _res, next) => {
  const token = req.query?.token;
  if (token) {
    req.headers.authorization = `Bearer ${token}`;
  }
  next();
};

router.get("/events", attachTokenFromQuery, verifyToken, requireRole(viewerRoles), streamPurchaseUpdates);
router.get("/meta", verifyToken, requireRole(creatorRoles), ctrl.getMeta);
router.get("/stats", verifyToken, requireRole(managerRoles), ctrl.getStats);
router.get("/", verifyToken, requireRole(viewerRoles), ctrl.listMine);
router.get("/:id", verifyToken, requireRole(viewerRoles), ctrl.getOne);

router.post("/", verifyToken, requireRole(creatorRoles), ctrl.create);
router.post("/:id/start-availability", verifyToken, requireRole(managerRoles), ctrl.startAvailability);
router.post("/:id/provider-response", verifyToken, requireRole(managerRoles), ctrl.saveProviderResponse);
router.patch("/:id/checklist", verifyToken, requireRole(creatorRoles), ctrl.updateChecklist);
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
router.patch(
  "/:id/coordinate-inspection-date",
  verifyToken,
  requireRole(inspectionCoordinationRoles),
  ctrl.coordinateInspectionDate,
);

module.exports = router;
