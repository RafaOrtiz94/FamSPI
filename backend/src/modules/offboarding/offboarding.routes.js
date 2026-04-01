const express = require("express");
const controller = require("./offboarding.controller");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");

const router = express.Router();

const OFFBOARDING_ALLOWED_ROLES = ["jefe_financiero", "jefe_finanzas", "jefe_talento_humano"];

router.use(verifyToken);
router.use(requireRole(OFFBOARDING_ALLOWED_ROLES));

router.get("/:userId/workspace", controller.getWorkspace);
router.patch("/:userId/tasks/:taskKey", controller.updateTask);
router.post("/:userId/liquidation", controller.runLiquidation);
router.post("/:userId/close", controller.closeOffboarding);

module.exports = router;
