const express = require("express");
const router = express.Router();

const ctrl = require("./equipmentPurchases.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const { streamPurchaseUpdates } = require("./purchaseEvents");

const managerRoles = ["acp_comercial", "gerencia", "gerencia_general", "jefe_comercial", "jefe_de_comercial"];

// CP-01: Creadores — comercial, asesor_comercial, analista_comercial + managers
const creatorRoles = ["comercial", "asesor_comercial", "analista_comercial", ...managerRoles];

// CP-02: Viewers — todos los que pueden ver expedientes (backoffice, técnicos, logística, ops)
const viewerRoles = Array.from(new Set([
  ...creatorRoles,
  "backoffice",
  "backoffice_comercial",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "tecnico",
  "jefe_operaciones",
  "operaciones",
  "jefe_logistica",
  "logistica",
]));

// Roles de inspección: solicitar solo acp_comercial, coordinar solo técnicos
const inspectionRequestRoles = ["acp_comercial"];                                    // CP-06
const inspectionCoordinationRoles = ["jefe_tecnico", "jefe_servicio_tecnico"];       // CP-06
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

// CP-09: comercialAndBackofficeRoles incluye comercial y backoffice (antes faltaban)
const comercialAndBackofficeRoles = Array.from(new Set([
  "comercial",
  "asesor_comercial",
  "analista_comercial",
  "backoffice",
  "backoffice_comercial",
  ...managerRoles,
]));

// CP-03: solo acp_comercial confirma disponibilidad ACP (jefe_comercial ya NO)
const acpConfirmRoles = ["acp_comercial"];
// Para otras acciones ACP (devolver, portal, etc.) se mantiene el grupo completo
const acpRoles = ["acp_comercial", "jefe_comercial", "jefe_de_comercial", "gerencia", "gerencia_general"];

// CP-09: Control Operativo — solo acp_comercial o jefe_comercial habilitan
const controlOperativoRoles = ["acp_comercial", "jefe_comercial", "jefe_de_comercial"];

const supplyRequestRoles = ["comercial", "asesor_comercial", "analista_comercial", "backoffice", "backoffice_comercial", ...managerRoles];
const supplyApproveRoles = ["jefe_operaciones", "operaciones", ...managerRoles];
const supplyDispatchRoles = ["jefe_logistica", "logistica", ...managerRoles];

const attachTokenFromQuery = (req, _res, next) => {
  const token = req.query?.token;
  if (token) {
    req.headers.authorization = `Bearer ${token}`;
  }
  next();
};

router.get("/events", attachTokenFromQuery, verifyToken, requireRole(viewerRoles), streamPurchaseUpdates);
router.get("/meta", verifyToken, requireRole(viewerRoles), ctrl.getMeta);
router.get("/provider-contacts", verifyToken, requireRole(managerRoles), ctrl.listProviderContacts);
router.get("/stats", verifyToken, requireRole(managerRoles), ctrl.getStats);
router.get("/active-reservations", verifyToken, requireRole(["acp_comercial", ...managerRoles]), ctrl.getActiveReservations);
router.get("/freed-reservations", verifyToken, requireRole(["acp_comercial", ...managerRoles]), ctrl.getFreedReservations);
router.get("/technical-schedule", verifyToken, requireRole(viewerRoles), ctrl.getTechnicalScheduleCalendar);
router.get("/", verifyToken, requireRole(viewerRoles), ctrl.listMine);
router.get("/:id", verifyToken, requireRole(viewerRoles), ctrl.getOne);
router.get("/:id/timeline", verifyToken, requireRole(viewerRoles), ctrl.getTimeline);

router.post("/", verifyToken, requireRole(creatorRoles), ctrl.create);
router.post("/provider-contacts", verifyToken, requireRole(managerRoles), ctrl.saveProviderContact);
router.post("/:id/start-availability", verifyToken, requireRole(managerRoles), ctrl.startAvailability);
router.post("/:id/provider-response", verifyToken, requireRole(managerRoles), ctrl.saveProviderResponse);
// CU (condición de uso) approval — comercial + managers aprueban/rechazan en nombre del cliente
router.post(
  "/:id/confirm-cu-availability",
  verifyToken,
  requireRole(["comercial", "asesor_comercial", "analista_comercial", ...managerRoles]),
  ctrl.confirmCuAvailability,
);
// Import awareness — ACP confirma que tiene al cliente comprometido para proceder con importación
router.post(
  "/:id/confirm-import-awareness",
  verifyToken,
  requireRole(["acp_comercial", ...managerRoles]),
  ctrl.confirmAcpImportAwareness,
);
router.patch(
  "/:id/public-portal-outcome",
  verifyToken,
  requireRole(managerRoles),
  ctrl.registerPublicPortalOutcome,
);
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

// Transferir reserva liberada a este expediente
router.post(
  "/:id/transfer-reservation",
  verifyToken,
  requireRole(["acp_comercial", ...managerRoles]),
  ctrl.transferReservation,
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
router.patch(
  "/:id/installation-workflow",
  verifyToken,
  requireRole(deliveryRoles),
  ctrl.updateInstallationWorkflow,
);

router.patch(
  "/:id/sercop",
  verifyToken,
  requireRole(managerRoles),
  ctrl.updateSercop,
);

// WORKFLOW ALIGNMENT — Parte 2
// Decisión formal de participar (solo compra pública, antes de asignar ACP).
router.post(
  "/:id/register-participation-decision",
  verifyToken,
  requireRole(managerRoles),
  ctrl.registerParticipationDecision,
);

// Registro de serial — gate: solo si serial_status = received_pending_serial.
router.post(
  "/:id/register-serial",
  verifyToken,
  requireRole(deliveryRoles),
  ctrl.registerSerial,
);

// WORKFLOW ALIGNMENT — Nuevos endpoints
router.post(
  "/:id/set-purchase-type",
  verifyToken,
  requireRole(comercialAndBackofficeRoles),
  ctrl.setPurchaseType,
);

router.post(
  "/:id/set-private-modality",
  verifyToken,
  requireRole(comercialAndBackofficeRoles),
  ctrl.setPrivateModality,
);

router.post(
  "/:id/set-availability",
  verifyToken,
  requireRole(managerRoles),
  ctrl.setAvailability,
);

router.post(
  "/:id/activate-supply-control",
  verifyToken,
  requireRole(managerRoles),
  ctrl.activateSupplyControl,
);

router.post(
  "/:id/request-supply",
  verifyToken,
  requireRole(supplyRequestRoles),
  ctrl.requestSupply,
);

router.patch(
  "/:id/ops-approve-supply",
  verifyToken,
  requireRole(supplyApproveRoles),
  ctrl.opsApproveSupply,
);

router.post(
  "/:id/register-dispatch",
  verifyToken,
  requireRole(supplyDispatchRoles),
  ctrl.registerDispatch,
);

// ================================================
// UNIFIED PURCHASES — FLUJO ESENCIAL (comercial → backoffice → ACP)
// ================================================

// Transiciones de estado
router.post(
  "/:id/transition",
  verifyToken,
  requireRole(viewerRoles),
  ctrl.transitionState,
);

router.get(
  "/:id/transitions",
  verifyToken,
  requireRole(viewerRoles),
  ctrl.getAllowedTransitions,
);

// Flujo comercial → backoffice → ACP
router.post(
  "/:id/send-to-acp",
  verifyToken,
  requireRole(comercialAndBackofficeRoles),
  ctrl.forwardToAcp,
);

// CP-03: SOLO acp_comercial puede confirmar disponibilidad — jefe_comercial NO puede
router.post(
  "/:id/confirm-acp-availability",
  verifyToken,
  requireRole(acpConfirmRoles),
  ctrl.confirmAcpAvailability,
);

router.post(
  "/:id/return-to-backoffice",
  verifyToken,
  requireRole(acpRoles),
  ctrl.returnToBackoffice,
);

// Business Case y oferta
router.post(
  "/:id/start-business-case",
  verifyToken,
  requireRole(comercialAndBackofficeRoles),
  ctrl.startBusinessCase,
);

router.post(
  "/:id/send-offer",
  verifyToken,
  requireRole(comercialAndBackofficeRoles),
  ctrl.sendOffer,
);

// Subir oferta firmada (requisito para contrato)
router.post(
  "/:id/offer/signed",
  verifyToken,
  requireRole(comercialAndBackofficeRoles),
  ctrl.uploadSignedOffer,
);

// Obtener configuración de visibilidad dinámica
router.get(
  "/:id/visibility-config",
  verifyToken,
  requireRole(viewerRoles),
  ctrl.getVisibilityConfig,
);

// ================================================
// UNIFIED PURCHASES — NUEVOS ENDPOINTS (Parte 3)
// ================================================

// Regla de disponibilidad: equipo interno listo
router.post(
  "/:id/set-equipment-ready",
  verifyToken,
  requireRole(comercialAndBackofficeRoles),
  ctrl.setEquipmentReady,
);

// Checklist del portal público
router.patch(
  "/:id/portal-checklist",
  verifyToken,
  requireRole(acpRoles),
  ctrl.updatePublicPortalChecklist,
);

// CP-09: Control Operativo — SOLO acp_comercial o jefe_comercial pueden habilitarlo
router.post(
  "/:id/control-operativo/start",
  verifyToken,
  requireRole(controlOperativoRoles),
  ctrl.startControlOperativo,
);

router.post(
  "/:id/control-operativo/register-delivery",
  verifyToken,
  requireRole(deliveryRoles),
  ctrl.registerDelivery,
);

router.post(
  "/:id/control-operativo/complete",
  verifyToken,
  requireRole(deliveryRoles),
  ctrl.completeControlOperativo,
);

module.exports = router;
