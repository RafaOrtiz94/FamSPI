const express = require("express");
const { requireRole } = require("../../middlewares/auth");
const controller = require("./supportTickets.controller");
const { TI_ROLES } = require("./supportTickets.service");

const router = express.Router();

// Cualquier usuario autenticado puede crear y revisar sus propios tickets.
router.post("/", controller.create);
router.get("/my", controller.listMy);
router.get("/:id/events", controller.listEvents);
router.get("/:id/comments", controller.listComments);
router.post("/:id/comments", controller.addComment);
router.post("/:id/reopen", controller.reopen);
router.post("/:id/close", controller.closeByRequester);
router.post("/:id/satisfaction", controller.rateSatisfaction);

// Workspace y gestión exclusiva TI.
router.get("/workspace/list", requireRole(TI_ROLES), controller.listWorkspace);
router.get("/workspace/kpi", requireRole(TI_ROLES), controller.kpiWorkspace);
router.patch("/:id/assign-self", requireRole(TI_ROLES), controller.assignSelf);
router.patch("/:id/status", requireRole(TI_ROLES), controller.updateStatus);

module.exports = router;
