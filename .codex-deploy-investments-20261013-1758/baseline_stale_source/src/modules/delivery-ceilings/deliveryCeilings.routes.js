const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const controller = require("./deliveryCeilings.controller");

const router = express.Router();

const DELIVERY_CEILING_READ_ROLES = [
  "comercial",
  "backoffice_comercial",
  "acp_comercial",
  "jefe_comercial",
  "gerencia",
  "gerencia_general",
  "jefe_operaciones",
  "operaciones",
  "jefe_logistica",
  "jefe_tecnico",
  "jefe_servicio_tecnico",
  "tecnico",
  "servicio_tecnico",
];

router.get("/", verifyToken, requireRole(DELIVERY_CEILING_READ_ROLES), controller.listDeliveryCeilings);

module.exports = router;

