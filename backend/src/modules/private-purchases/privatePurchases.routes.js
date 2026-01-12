const express = require("express");
const router = express.Router();
const ctrl = require("./privatePurchases.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

router.post(
  "/",
  verifyToken,
  requireRole(["comercial", "acp_comercial", "backoffice_comercial"]),
  ctrl.createPrivatePurchase,
);
router.get(
  "/",
  verifyToken,
  requireRole([
    "backoffice_comercial",
    "gerencia",
    "gerencia_general",
    "jefe_comercial",
    "comercial",
    "asesor_comercial",
    "acp_comercial",
  ]),
  ctrl.listPrivatePurchases,
);
router.get(
  "/:id",
  verifyToken,
  requireRole(["backoffice_comercial", "comercial", "gerencia", "gerencia_general", "jefe_comercial"]),
  ctrl.getPrivatePurchase,
);
router.post(
  "/:id/offer",
  verifyToken,
  requireRole(["backoffice_comercial"]),
  ctrl.sendOffer,
);
router.post(
  "/:id/offer/signed",
  verifyToken,
  requireRole(["comercial", "gerencia", "jefe_comercial", "gerencia_general"]),
  ctrl.uploadSignedOffer,
);
router.post(
  "/:id/register-client",
  verifyToken,
  requireRole(["comercial"]),
  ctrl.registerClient,
);
router.post(
  "/:id/send-to-acp",
  verifyToken,
  requireRole(["backoffice_comercial"]),
  ctrl.forwardToACP,
);

// ===========================================
// FASE 2: Nuevas rutas para flujo completo
// ===========================================

router.get(
  "/:id/timeline",
  verifyToken,
  requireRole(["backoffice_comercial", "comercial", "gerencia", "gerencia_general", "jefe_comercial"]),
  ctrl.getTimeline,
);

router.post(
  "/:id/manager-decision",
  verifyToken,
  requireRole(["gerencia", "gerencia_general"]),
  ctrl.managerDecision,
);

router.post(
  "/:id/submit-corrections",
  verifyToken,
  requireRole(["backoffice_comercial"]),
  ctrl.submitCorrections,
);

router.post(
  "/:id/submit-contract",
  verifyToken,
  requireRole(["backoffice_comercial"]),
  ctrl.submitContract,
);

router.post(
  "/:id/request-delivery-dates",
  verifyToken,
  requireRole(["jefe_operaciones"]),
  ctrl.requestDeliveryDates,
);

router.post(
  "/:id/submit-delivery-dates",
  verifyToken,
  requireRole(["comercial", "asesor_comercial"]),
  ctrl.submitDeliveryDates,
);

router.post(
  "/:id/mark-dispatch-ready",
  verifyToken,
  requireRole(["jefe_logistica"]),
  ctrl.markDispatchReady,
);

router.post(
  "/:id/generate-delivery-act",
  verifyToken,
  requireRole(["jefe_logistica", "backoffice_comercial"]),
  ctrl.generateDeliveryAct,
);

// ===========================================
// FUNCIONES PARA COMODATO
// ===========================================

router.post(
  "/:id/request-acp-availability",
  verifyToken,
  requireRole(["backoffice_comercial", "comercial"]),
  ctrl.requestAcpAvailability,
);

router.post(
  "/:id/start-business-case",
  verifyToken,
  requireRole(["backoffice_comercial", "comercial"]),
  ctrl.startBusinessCase,
);

// Debug endpoint
router.get(
  "/:id/validate-client-approval",
  verifyToken,
  requireRole(["backoffice_comercial", "comercial", "gerencia"]),
  ctrl.validateClientApproval,
);

module.exports = router;
