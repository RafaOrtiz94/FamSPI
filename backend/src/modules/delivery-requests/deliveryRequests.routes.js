const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const controller = require("./deliveryRequests.controller");

const router = express.Router();

const MANAGER_ROLES      = ["acp_comercial", "gerencia", "gerencia_general", "jefe_comercial"];
const REQUEST_CREATOR_ROLES = ["comercial", "backoffice_comercial", ...MANAGER_ROLES];
const OPS_APPROVE_ROLES  = ["jefe_operaciones", "operaciones", ...MANAGER_ROLES];
const LOGISTICS_ROLES    = ["jefe_logistica", ...MANAGER_ROLES];
const CANCEL_ROLES       = Array.from(new Set([...REQUEST_CREATOR_ROLES, ...OPS_APPROVE_ROLES, ...LOGISTICS_ROLES]));
const READ_ROLES         = Array.from(new Set([
  ...CANCEL_ROLES,
  "jefe_tecnico", "jefe_servicio_tecnico", "tecnico", "servicio_tecnico",
]));

router.get("/",                    verifyToken, requireRole(READ_ROLES),           controller.listDeliveryRequests);
router.post("/",                   verifyToken, requireRole(REQUEST_CREATOR_ROLES), controller.createDeliveryRequest);
router.post("/:id/ops-approve",    verifyToken, requireRole(OPS_APPROVE_ROLES),    controller.opsApproveDeliveryRequest);
router.post("/:id/cancel",         verifyToken, requireRole(CANCEL_ROLES),          controller.cancelDeliveryRequest);
router.post("/:id/confirm-delivery", verifyToken, requireRole(LOGISTICS_ROLES),    controller.confirmDeliveryRequest);

module.exports = router;

