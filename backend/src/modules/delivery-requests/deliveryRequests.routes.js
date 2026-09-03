const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const controller = require("./deliveryRequests.controller");

const router = express.Router();

const MANAGER_ROLES      = ["acp_comercial", "gerencia", "gerencia_general", "jefe_comercial", "jefe_de_comercial"];

// DR-01: Creadores — comercial, asesor_comercial, analista_comercial, backoffice + managers
const REQUEST_CREATOR_ROLES = [
  "comercial",
  "asesor_comercial",
  "analista_comercial",
  "backoffice",
  "backoffice_comercial",
  ...MANAGER_ROLES,
];

// DR-02: OPS aprueba — jefe_operaciones, operaciones + managers
const OPS_APPROVE_ROLES  = ["jefe_operaciones", "operaciones", ...MANAGER_ROLES];

// DR-02: Logística confirma entrega — jefe_logistica + managers (logistica sin jefe NO confirma)
const LOGISTICS_ROLES    = ["jefe_logistica", ...MANAGER_ROLES];

// Cancelación — solo managers (no comercial, no backoffice, no OPS, no logistica base)
const CANCEL_ROLES       = [...MANAGER_ROLES];

// DR-03: Lectura limitada para técnicos — planificación pre/post entrega
const READ_ROLES         = Array.from(new Set([
  ...REQUEST_CREATOR_ROLES,
  ...OPS_APPROVE_ROLES,
  ...LOGISTICS_ROLES,
  "jefe_tecnico", "jefe_servicio_tecnico", "tecnico", "servicio_tecnico",
]));

router.get("/",                      verifyToken, requireRole(READ_ROLES),            controller.listDeliveryRequests);
router.post("/",                     verifyToken, requireRole(REQUEST_CREATOR_ROLES),  controller.createDeliveryRequest);
router.post("/:id/ops-approve",      verifyToken, requireRole(OPS_APPROVE_ROLES),      controller.opsApproveDeliveryRequest);
router.post("/:id/cancel",           verifyToken, requireRole(CANCEL_ROLES),            controller.cancelDeliveryRequest);
router.post("/:id/confirm-delivery", verifyToken, requireRole(LOGISTICS_ROLES),        controller.confirmDeliveryRequest);
// DR-04: Dispatch history — same read access as requests
router.get("/dispatches",            verifyToken, requireRole(READ_ROLES),            controller.listDeliveryDispatches);

module.exports = router;

