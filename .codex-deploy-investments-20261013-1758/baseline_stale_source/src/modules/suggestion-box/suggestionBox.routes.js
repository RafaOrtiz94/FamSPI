const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/roles");
const controller = require("./suggestionBox.controller");
const { MANAGER_ROLES } = require("./suggestionBox.service");

const router = express.Router();
router.use(verifyToken);
router.post("/submissions", controller.createInternalSubmission);
router.get("/submissions", requireRole(MANAGER_ROLES), controller.listSubmissions);
router.get("/submissions/:id", requireRole(MANAGER_ROLES), controller.getSubmission);
router.post("/submissions/:id/status", requireRole(MANAGER_ROLES), controller.updateStatus);

module.exports = router;
