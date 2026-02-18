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
const inspectionRequestRoles = ["acp_comercial"];
const inspectionCoordinationRoles = ["jefe_tecnico", "jefe_servicio_tecnico"];
const inspectionReviewRoles = ["jefe_tecnico", "jefe_servicio_tecnico"];
const technicalInspectionExecutionRoles = ["tecnico", "jefe_tecnico", "jefe_servicio_tecnico"];
const deliveryRoles = Array.from(new Set([
  ...managerRoles,
  "jefe_operaciones",
  "jefe_logistica",
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
router.get("/provider-contacts", verifyToken, requireRole(managerRoles), ctrl.listProviderContacts);
router.get("/stats", verifyToken, requireRole(managerRoles), ctrl.getStats);
router.get("/technical-schedule", verifyToken, requireRole(viewerRoles), ctrl.getTechnicalScheduleCalendar);
router.get("/", verifyToken, requireRole(viewerRoles), ctrl.listMine);
router.get("/:id", verifyToken, requireRole(viewerRoles), ctrl.getOne);

router.post("/", verifyToken, requireRole(creatorRoles), ctrl.create);
router.post("/provider-contacts", verifyToken, requireRole(managerRoles), ctrl.saveProviderContact);
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
  requireRole(["acp_comercial"]),
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
  "/:id/request-delivery-dates",
  verifyToken,
  requireRole(deliveryRoles),
  ctrl.requestDeliveryDates,
);
router.post(
  "/:id/submit-delivery-dates",
  verifyToken,
  requireRole(deliveryRoles),
  ctrl.submitDeliveryDates,
);
router.post(
  "/:id/mark-equipment-arrived",
  verifyToken,
  requireRole(deliveryRoles),
  ctrl.markEquipmentArrived,
);
router.post(
  "/:id/mark-dispatch-ready",
  verifyToken,
  requireRole(deliveryRoles),
  ctrl.markDispatchReady,
);
router.post(
  "/:id/complete-delivery",
  verifyToken,
  requireRole(deliveryRoles),
  ctrl.completeDelivery,
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
  requireRole(["acp_comercial"]),
  ctrl.upload.single("file"),
  ctrl.submitSignedProformaWithInspection,
);
router.post(
  "/:id/request-inspection",
  verifyToken,
  requireRole(inspectionRequestRoles),
  ctrl.requestInspectionEnvironment,
);
router.patch(
  "/:id/coordinate-inspection-date",
  verifyToken,
  requireRole(inspectionCoordinationRoles),
  ctrl.coordinateInspectionDate,
);
router.patch(
  "/:id/review-inspection-date",
  verifyToken,
  requireRole(inspectionReviewRoles),
  ctrl.reviewInspectionDate,
);
router.patch(
  "/:id/site-inspection",
  verifyToken,
  requireRole(technicalInspectionExecutionRoles),
  ctrl.registerSiteInspection,
);

module.exports = router;
