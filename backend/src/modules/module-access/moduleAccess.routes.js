const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const controller = require("./moduleAccess.controller");

const router = express.Router();

router.use(verifyToken);
router.use(requireRole(["jefe_ti", "admin_ti"]));

router.get("/catalog", controller.getCatalog);
router.get("/users/:userId", controller.getUserModules);
router.put("/users/:userId", controller.updateUserModules);

// Global status — GET available to all TI; PUT restricted to jefe_ti
router.get("/global", controller.getGlobalStatuses);
router.put("/global/:moduleKey", requireRole(["jefe_ti", "admin_ti"]), controller.updateGlobalStatus);

module.exports = router;
