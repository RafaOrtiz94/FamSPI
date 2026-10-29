const express = require("express");
const { verifyToken } = require("../../middlewares/auth");
const { requirePermission } = require("../../security/authorization/authorization.middleware");
const controller = require("./rbacAdmin.controller");

const router = express.Router();

router.use(verifyToken);

router.get("/summary", requirePermission("rbac.read"), controller.getSummary);
router.get("/roles", requirePermission("rbac.read"), controller.listRoles);
router.get("/members", requirePermission("rbac.read"), controller.listMembers);
router.get("/permissions", requirePermission("rbac.read"), controller.listPermissions);
router.get("/roles/:roleId", requirePermission("rbac.read"), controller.getRole);
router.post("/roles", requirePermission("rbac.manage"), controller.createRole);
router.put("/roles/:roleId", requirePermission("rbac.manage"), controller.updateRole);
router.delete("/roles/:roleId", requirePermission("rbac.manage"), controller.archiveRole);
router.get("/users/:userId", requirePermission("rbac.read"), controller.getUserAccess);
router.get("/matrix", requirePermission("rbac.read"), controller.getMatrix);
router.get("/audit", requirePermission("rbac.read"), controller.listAudit);

router.post("/sync-inherited", requirePermission("rbac.manage"), controller.syncInherited);

router.post("/users/:userId/roles", requirePermission("rbac.manage"), controller.assignRole);
router.delete("/users/:userId/roles/:assignmentId", requirePermission("rbac.manage"), controller.revokeRole);
router.post("/users/:userId/grants", requirePermission("rbac.manage"), controller.grantPermission);
router.delete("/users/:userId/grants/:grantId", requirePermission("rbac.manage"), controller.revokeGrant);

module.exports = router;
