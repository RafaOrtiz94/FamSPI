const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const controller = require("./publicDeliveryPlans.controller");

const router = express.Router();

const PLAN_ANALYST_ROLES = [
  "acp_comercial",
  "jefe_comercial",
  "gerencia",
  "gerencia_general",
  "jefe_operaciones",
];

router.get("/", verifyToken, requireRole(PLAN_ANALYST_ROLES), controller.list);
router.post("/", verifyToken, requireRole(PLAN_ANALYST_ROLES), controller.createDraft);
router.post("/:id/lines", verifyToken, requireRole(PLAN_ANALYST_ROLES), controller.addLine);
router.post("/:id/status", verifyToken, requireRole(PLAN_ANALYST_ROLES), controller.transitionStatus);

module.exports = router;

