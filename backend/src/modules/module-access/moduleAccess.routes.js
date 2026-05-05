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

module.exports = router;
