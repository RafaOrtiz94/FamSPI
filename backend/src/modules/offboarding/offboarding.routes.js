const express = require("express");
const controller = require("./offboarding.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

const router = express.Router();

const OFFBOARDING_ALLOWED_ROLES = [
  "talento_humano",
  "jefe_talento_humano",
  "jefe_financiero",
  "jefe_finanzas",
  "jefe_ti",
  "gerencia_general",
  "admin",
];

router.use(verifyToken);
router.use(requireRole(OFFBOARDING_ALLOWED_ROLES));

router.get("/:userId/workspace", controller.getWorkspace);
router.patch("/:userId/tasks/:taskKey", controller.updateTask);
router.post("/:userId/start", controller.startOffboarding);
router.post("/:userId/cancel", controller.cancelOffboarding);
router.post("/:userId/liquidation", controller.runLiquidation);
router.post("/:userId/close", controller.closeOffboarding);

module.exports = router;
