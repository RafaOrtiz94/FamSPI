const service = require("./workManagement.service");

function getUserId(req) {
  const userId = Number(req.user?.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    const error = new Error("Usuario no valido");
    error.status = 401;
    throw error;
  }
  return userId;
}

async function handle(res, action) {
  try {
    const data = await action();
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Error interno",
    });
  }
}

async function getHealth(req, res) {
  return handle(res, () => service.getHealth(getUserId(req)));
}

async function listMyWork(req, res) {
  return handle(res, () => service.listMyWork(getUserId(req)));
}

async function getPortfolioSummary(req, res) {
  return handle(res, () =>
    service.getPortfolioSummary(req.user || { id: getUserId(req), role: null })
  );
}

async function listCollaborators(req, res) {
  return handle(res, () => service.listCollaborators(req.query || {}));
}

async function listWorkspaces(req, res) {
  return handle(res, () => service.listWorkspaces(getUserId(req), req.user?.role));
}

async function createWorkspace(req, res) {
  return handle(res, () => service.createWorkspace(req.body || {}, getUserId(req)));
}

async function updateWorkspace(req, res) {
  return handle(res, () =>
    service.updateWorkspace(req.params.workspaceId, req.body || {}, getUserId(req), req.user?.role)
  );
}

async function listWorkspaceMembers(req, res) {
  return handle(res, () =>
    service.listWorkspaceMembers(req.params.workspaceId, getUserId(req), req.user?.role)
  );
}

async function addWorkspaceMember(req, res) {
  return handle(res, () =>
    service.addWorkspaceMember(
      req.params.workspaceId,
      req.body?.user_id,
      req.body?.member_role,
      getUserId(req),
      req.user?.role
    )
  );
}

async function removeWorkspaceMember(req, res) {
  return handle(res, () =>
    service.removeWorkspaceMember(req.params.workspaceId, req.params.memberUserId, getUserId(req), req.user?.role)
  );
}

async function deleteWorkspace(req, res) {
  return handle(res, () =>
    service.deleteWorkspace(req.params.workspaceId, getUserId(req), req.user?.role)
  );
}

async function deleteProject(req, res) {
  return handle(res, () =>
    service.deleteProject(req.params.projectId, getUserId(req), req.user?.role)
  );
}

async function deleteItem(req, res) {
  return handle(res, () =>
    service.deleteItem(req.params.itemId, getUserId(req), req.user?.role)
  );
}

async function listProjectsByWorkspace(req, res) {
  return handle(res, () =>
    service.listProjectsByWorkspace(req.params.workspaceId, getUserId(req), req.user?.role)
  );
}

async function createProject(req, res) {
  return handle(res, () =>
    service.createProject(req.params.workspaceId, req.body || {}, getUserId(req), req.user?.role)
  );
}

async function getProject(req, res) {
  return handle(res, () => service.getProject(req.params.projectId, getUserId(req), req.user?.role));
}

async function createProjectFromOpportunity(req, res) {
  return handle(res, () =>
    service.createProjectFromOpportunity(
      req.params.opportunityId,
      req.body || {},
      req.user || { id: getUserId(req) },
    )
  );
}

async function listBoardsByProject(req, res) {
  return handle(res, () =>
    service.listBoardsByProject(req.params.projectId, getUserId(req), req.user?.role)
  );
}

async function listItemsByProject(req, res) {
  return handle(res, () =>
    service.listItemsByProject(req.params.projectId, getUserId(req), req.user?.role)
  );
}

async function listAssigneeOptions(req, res) {
  return handle(res, () =>
    service.listAssigneeOptions(req.params.projectId, getUserId(req), req.user?.role)
  );
}

async function updateItem(req, res) {
  return handle(res, () =>
    service.updateItem(req.params.itemId, req.body || {}, getUserId(req), req.user?.role)
  );
}

async function updateItemAssignees(req, res) {
  return handle(res, () =>
    service.updateItemAssignees(req.params.itemId, req.body || {}, getUserId(req), req.user?.role)
  );
}

async function addItemSupporter(req, res) {
  return handle(res, () =>
    service.addItemSupporter(req.params.itemId, req.body || {}, getUserId(req), req.user?.role)
  );
}

async function removeItemSupporter(req, res) {
  return handle(res, () =>
    service.removeItemSupporter(req.params.itemId, req.params.supporterUserId, getUserId(req), req.user?.role)
  );
}

async function createItemComment(req, res) {
  return handle(res, () =>
    service.createItemComment(req.params.itemId, req.body || {}, getUserId(req), req.user?.role)
  );
}

async function createChecklistItem(req, res) {
  return handle(res, () =>
    service.createChecklistItem(req.params.itemId, req.body || {}, getUserId(req), req.user?.role)
  );
}

async function updateChecklistItem(req, res) {
  return handle(res, () =>
    service.updateChecklistItem(req.params.checklistItemId, req.body || {}, getUserId(req), req.user?.role)
  );
}

async function deleteChecklistItem(req, res) {
  return handle(res, () =>
    service.deleteChecklistItem(req.params.checklistItemId, getUserId(req), req.user?.role)
  );
}

async function uploadItemAttachment(req, res) {
  return handle(res, () =>
    service.uploadItemAttachment(req.params.itemId, req.file, getUserId(req), req.user?.role)
  );
}

async function reorderItem(req, res) {
  return handle(res, () =>
    service.reorderItem(req.params.itemId, req.body || {}, getUserId(req), req.user?.role)
  );
}

async function createBoard(req, res) {
  return handle(res, () =>
    service.createBoard(req.params.projectId, req.body || {}, getUserId(req), req.user?.role)
  );
}

async function createGroup(req, res) {
  return handle(res, () =>
    service.createGroup(req.params.boardId, req.body || {}, getUserId(req), req.user?.role)
  );
}

async function createItem(req, res) {
  return handle(res, () =>
    service.createItem(req.params.groupId, req.body || {}, getUserId(req), req.user?.role)
  );
}

module.exports = {
  getHealth,
  listMyWork,
  getPortfolioSummary,
  listCollaborators,
  listWorkspaces,
  createWorkspace,
  updateWorkspace,
  listWorkspaceMembers,
  addWorkspaceMember,
  removeWorkspaceMember,
  deleteWorkspace,
  listProjectsByWorkspace,
  createProject,
  deleteProject,
  createProjectFromOpportunity,
  getProject,
  listBoardsByProject,
  listItemsByProject,
  listAssigneeOptions,
  updateItem,
  updateItemAssignees,
  addItemSupporter,
  removeItemSupporter,
  createItemComment,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  uploadItemAttachment,
  reorderItem,
  deleteItem,
  createBoard,
  createGroup,
  createItem,
};
