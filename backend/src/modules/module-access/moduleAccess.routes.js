const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const { requirePermission } = require("../../security/authorization/authorization.middleware");
const controller = require("./moduleAccess.controller");

const router = express.Router();

router.use(verifyToken);
router.use(requirePermission("module_access.manage"));

router.get("/catalog", controller.getCatalog);
router.get("/users/:userId", controller.getUserModules);
router.put("/users/:userId", controller.updateUserModules);

// Global status — GET available to all TI; PUT restricted to jefe_ti
router.get("/global", controller.getGlobalStatuses);
router.put("/global/:moduleKey", requirePermission("module_access.manage"), controller.updateGlobalStatus);

module.exports = router;
