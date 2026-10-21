const express = require("express");
const multer = require("multer");
const { verifyToken } = require("../../middlewares/auth");
const controller = require("./workManagement.controller");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.use(verifyToken);

router.get("/health", controller.getHealth);
router.get("/my-work", controller.listMyWork);
router.get("/portfolio-summary", controller.getPortfolioSummary);
router.get("/collaborators", controller.listCollaborators);
router.get("/workspaces", controller.listWorkspaces);
router.post("/workspaces", controller.createWorkspace);
router.get("/workspaces/:workspaceId/projects", controller.listProjectsByWorkspace);
router.post("/workspaces/:workspaceId/projects", controller.createProject);
router.post("/projects/from-opportunity/:opportunityId", controller.createProjectFromOpportunity);
router.get("/projects/:projectId", controller.getProject);
router.get("/projects/:projectId/boards", controller.listBoardsByProject);
router.get("/projects/:projectId/items", controller.listItemsByProject);
router.get("/projects/:projectId/assignee-options", controller.listAssigneeOptions);
router.post("/projects/:projectId/boards", controller.createBoard);
router.post("/boards/:boardId/groups", controller.createGroup);
router.post("/groups/:groupId/items", controller.createItem);
router.patch("/items/:itemId", controller.updateItem);
router.put("/items/:itemId/assignees", controller.updateItemAssignees);
router.put("/items/:itemId/supporters", controller.updateItemSupporters);
router.post("/items/:itemId/comments", controller.createItemComment);
router.post("/items/:itemId/checklist-items", controller.createChecklistItem);
router.patch("/checklist-items/:checklistItemId", controller.updateChecklistItem);
router.delete("/checklist-items/:checklistItemId", controller.deleteChecklistItem);
router.post("/items/:itemId/attachments", upload.single("file"), controller.uploadItemAttachment);
router.post("/items/:itemId/reorder", controller.reorderItem);

module.exports = router;
