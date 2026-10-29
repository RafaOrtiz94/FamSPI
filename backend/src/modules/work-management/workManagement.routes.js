const express = require("express");
const multer = require("multer");
const { verifyToken } = require("../../middlewares/auth");
const controller = require("./workManagement.controller");
const { ROLE_GROUPS } = require("../../middlewares/roles");

const EXTERNAL_ROLES = new Set((ROLE_GROUPS.ext_users || ["ing_servicio_ext", "esp_app_ext"]).map((role) => String(role).toLowerCase()));

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.use(verifyToken);
// Abierto a todos los colaboradores; los usuarios externos (ROLE_GROUPS.ext_users) no tienen acceso.
router.use((req, res, next) => {
  const roles = [req.user?.role, req.user?.scope].map((value) => String(value || "").trim().toLowerCase());
  if (roles.some((value) => EXTERNAL_ROLES.has(value))) {
    return res.status(403).json({ ok: false, message: "Work Management no esta disponible para usuarios externos." });
  }
  return next();
});

router.get("/health", controller.getHealth);
router.get("/my-work", controller.listMyWork);
router.get("/portfolio-summary", controller.getPortfolioSummary);
router.get("/collaborators", controller.listCollaborators);
router.get("/workspaces", controller.listWorkspaces);
router.post("/workspaces", controller.createWorkspace);
router.patch("/workspaces/:workspaceId", controller.updateWorkspace);
router.get("/workspaces/:workspaceId/members", controller.listWorkspaceMembers);
router.post("/workspaces/:workspaceId/members", controller.addWorkspaceMember);
router.delete("/workspaces/:workspaceId/members/:memberUserId", controller.removeWorkspaceMember);
router.delete("/workspaces/:workspaceId", controller.deleteWorkspace);
router.get("/workspaces/:workspaceId/projects", controller.listProjectsByWorkspace);
router.post("/workspaces/:workspaceId/projects", controller.createProject);
router.post("/projects/from-opportunity/:opportunityId", controller.createProjectFromOpportunity);
router.get("/projects/:projectId", controller.getProject);
router.delete("/projects/:projectId", controller.deleteProject);
router.get("/projects/:projectId/boards", controller.listBoardsByProject);
router.get("/projects/:projectId/items", controller.listItemsByProject);
router.get("/projects/:projectId/assignee-options", controller.listAssigneeOptions);
router.post("/projects/:projectId/boards", controller.createBoard);
router.post("/boards/:boardId/groups", controller.createGroup);
router.post("/groups/:groupId/items", controller.createItem);
router.patch("/items/:itemId", controller.updateItem);
router.put("/items/:itemId/assignees", controller.updateItemAssignees);
router.post("/items/:itemId/supporters", controller.addItemSupporter);
router.delete("/items/:itemId/supporters/:supporterUserId", controller.removeItemSupporter);
router.post("/items/:itemId/comments", controller.createItemComment);
router.post("/items/:itemId/checklist-items", controller.createChecklistItem);
router.patch("/checklist-items/:checklistItemId", controller.updateChecklistItem);
router.delete("/checklist-items/:checklistItemId", controller.deleteChecklistItem);
router.post("/items/:itemId/attachments", upload.single("file"), controller.uploadItemAttachment);
router.post("/items/:itemId/reorder", controller.reorderItem);
router.delete("/items/:itemId", controller.deleteItem);

module.exports = router;
