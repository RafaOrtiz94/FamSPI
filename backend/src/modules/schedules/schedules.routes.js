const express = require("express");
const { requireRole } = require("../../middlewares/roles");
const controller = require("./schedules.controller");

const router = express.Router({ mergeParams: true });

const advisorRoles = ["comercial", "acp_comercial", "backoffice", "backoffice_comercial"];
const managerRoles = ["jefe_comercial", "gerencia", "gerencia_general", "admin", "administrador"];

router.get("/", requireRole(advisorRoles), controller.listMySchedules);
router.get("/pending-approval", requireRole(managerRoles), controller.listPendingApproval);
router.get("/team", requireRole(managerRoles), controller.listTeamSchedules);
router.get("/analytics", requireRole(managerRoles), controller.analytics);
router.get("/approved/current", requireRole([...advisorRoles, ...managerRoles]), controller.getApprovedSchedule);
router.get("/:id", requireRole(advisorRoles), controller.getScheduleDetail);
router.post("/", requireRole(advisorRoles), controller.createSchedule);
router.put("/:id", requireRole(advisorRoles), controller.updateSchedule);
router.delete("/:id", requireRole(advisorRoles), controller.deleteSchedule);
router.post("/:id/submit", requireRole(advisorRoles), controller.submitForApproval);
router.post("/:id/visits", requireRole(advisorRoles), controller.addVisit);
router.put("/:id/visits/:visitId", requireRole(advisorRoles), controller.updateVisit);
router.delete("/:id/visits/:visitId", requireRole(advisorRoles), controller.deleteVisit);
router.post("/:id/approve", requireRole(managerRoles), controller.approveSchedule);
router.post("/:id/reject", requireRole(managerRoles), controller.rejectSchedule);

module.exports = router;
