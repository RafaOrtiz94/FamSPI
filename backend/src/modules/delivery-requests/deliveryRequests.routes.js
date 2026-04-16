const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const controller = require("./deliveryRequests.controller");

const router = express.Router();

const MANAGER_ROLES = ["acp_comercial", "gerencia", "gerencia_general", "jefe_comercial"];
const REQUEST_CREATOR_ROLES = ["comercial", "backoffice_comercial", ...MANAGER_ROLES];
const DELIVERY_CONFIRM_ROLES = Array.from(
  new Set([
    ...MANAGER_ROLES,
    "jefe_operaciones",
    "operaciones",
    "jefe_logistica",
    "jefe_tecnico",
    "jefe_servicio_tecnico",
    "tecnico",
  ]),
);

router.post("/", verifyToken, requireRole(REQUEST_CREATOR_ROLES), controller.createDeliveryRequest);
router.post(
  "/:id/confirm-delivery",
  verifyToken,
  requireRole(DELIVERY_CONFIRM_ROLES),
  controller.confirmDeliveryRequest,
);

module.exports = router;

