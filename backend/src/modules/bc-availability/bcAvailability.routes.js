const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const controller = require("./bcAvailability.controller");

const router = express.Router();

// Comercial solicita; solo acp_comercial consulta proveedores y cierra (regla CP-03: jefe_comercial no).
const REQUESTER_ROLES = ["comercial", "asesor_comercial", "analista_comercial", "backoffice_comercial", "jefe_comercial"];
const ACP_ROLES = ["acp_comercial"];
const READ_ROLES = [...REQUESTER_ROLES, ...ACP_ROLES, "gerencia", "gerencia_general"];

router.get("/", verifyToken, requireRole(READ_ROLES), controller.list);
router.get("/:id", verifyToken, requireRole(READ_ROLES), controller.get);
router.post("/", verifyToken, requireRole(REQUESTER_ROLES), controller.create);
router.post("/:id/suppliers", verifyToken, requireRole(ACP_ROLES), controller.sendToSuppliers);
router.post("/:id/suppliers/:queryId/response", verifyToken, requireRole(ACP_ROLES), controller.recordResponse);
router.post("/:id/close", verifyToken, requireRole(ACP_ROLES), controller.close);

module.exports = router;
