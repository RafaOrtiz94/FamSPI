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
  return handle(res, () => service.listWorkspaces(getUserId(req)));
}

async function createWorkspace(req, res) {
  return handle(res, () => service.createWorkspace(req.body || {}, getUserId(req)));
}

async function listProjectsByWorkspace(req, res) {
  return handle(res, () =>
    service.listProjectsByWorkspace(req.params.workspaceId, getUserId(req))
  );
}

async function createProject(req, res) {
  return handle(res, () =>
    service.createProject(req.params.workspaceId, req.body || {}, getUserId(req))
  );
}

async function getProject(req, res) {
  return handle(res, () => service.getProject(req.params.projectId, getUserId(req)));
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
    service.listBoardsByProject(req.params.projectId, getUserId(req))
  );
}

async function listItemsByProject(req, res) {
  return handle(res, () =>
    service.listItemsByProject(req.params.projectId, getUserId(req))
  );
}

async function listAssigneeOptions(req, res) {
  return handle(res, () =>
    service.listAssigneeOptions(req.params.projectId, getUserId(req))
  );
}

async function updateItem(req, res) {
  return handle(res, () =>
    service.updateItem(req.params.itemId, req.body || {}, getUserId(req))
  );
}

async function updateItemAssignees(req, res) {
  return handle(res, () =>
    service.updateItemAssignees(req.params.itemId, req.body || {}, getUserId(req))
  );
}

async function updateItemSupporters(req, res) {
  return handle(res, () =>
    service.updateItemSupporters(req.params.itemId, req.body || {}, getUserId(req))
  );
}

async function createItemComment(req, res) {
  return handle(res, () =>
    service.createItemComment(req.params.itemId, req.body || {}, getUserId(req))
  );
}

async function createChecklistItem(req, res) {
  return handle(res, () =>
    service.createChecklistItem(req.params.itemId, req.body || {}, getUserId(req))
  );
}

async function updateChecklistItem(req, res) {
  return handle(res, () =>
    service.updateChecklistItem(req.params.checklistItemId, req.body || {}, getUserId(req))
  );
}

async function deleteChecklistItem(req, res) {
  return handle(res, () =>
    service.deleteChecklistItem(req.params.checklistItemId, getUserId(req))
  );
}

async function uploadItemAttachment(req, res) {
  return handle(res, () =>
    service.uploadItemAttachment(req.params.itemId, req.file, getUserId(req))
  );
}

async function reorderItem(req, res) {
  return handle(res, () =>
    service.reorderItem(req.params.itemId, req.body || {}, getUserId(req))
  );
}

async function createBoard(req, res) {
  return handle(res, () =>
    service.createBoard(req.params.projectId, req.body || {}, getUserId(req))
  );
}

async function createGroup(req, res) {
  return handle(res, () =>
    service.createGroup(req.params.boardId, req.body || {}, getUserId(req))
  );
}

async function createItem(req, res) {
  return handle(res, () =>
    service.createItem(req.params.groupId, req.body || {}, getUserId(req))
  );
}

module.exports = {
  getHealth,
  listMyWork,
  getPortfolioSummary,
  listCollaborators,
  listWorkspaces,
  createWorkspace,
  listProjectsByWorkspace,
  createProject,
  createProjectFromOpportunity,
  getProject,
  listBoardsByProject,
  listItemsByProject,
  listAssigneeOptions,
  updateItem,
  updateItemAssignees,
  updateItemSupporters,
  createItemComment,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  uploadItemAttachment,
  reorderItem,
  createBoard,
  createGroup,
  createItem,
};
