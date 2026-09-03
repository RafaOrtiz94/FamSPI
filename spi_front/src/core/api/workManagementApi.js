import api from "./index";

export const fetchWorkManagementHealth = () =>
  api.get("/work-management/health").then((response) => response.data?.data);

export const fetchMyWork = () =>
  api.get("/work-management/my-work").then((response) => response.data?.data);

export const fetchPortfolioSummary = () =>
  api.get("/work-management/portfolio-summary").then((response) => response.data?.data);

export const fetchWorkManagementCollaborators = (params = {}) =>
  api
    .get("/work-management/collaborators", { params })
    .then((response) => response.data?.data || []);

export const fetchWorkspaces = () =>
  api.get("/work-management/workspaces").then((response) => response.data?.data || []);

export const createWorkspace = (payload) =>
  api.post("/work-management/workspaces", payload).then((response) => response.data?.data);

export const fetchWorkspaceProjects = (workspaceId) =>
  api
    .get(`/work-management/workspaces/${workspaceId}/projects`)
    .then((response) => response.data?.data || []);

export const createProject = (workspaceId, payload) =>
  api
    .post(`/work-management/workspaces/${workspaceId}/projects`, payload)
    .then((response) => response.data?.data);

export const createProjectFromOpportunity = (opportunityId, payload) =>
  api
    .post(`/work-management/projects/from-opportunity/${opportunityId}`, payload)
    .then((response) => response.data?.data);

export const fetchProject = (projectId) =>
  api.get(`/work-management/projects/${projectId}`).then((response) => response.data?.data);

export const fetchProjectBoards = (projectId) =>
  api
    .get(`/work-management/projects/${projectId}/boards`)
    .then((response) => response.data?.data || []);

export const fetchProjectItems = (projectId) =>
  api
    .get(`/work-management/projects/${projectId}/items`)
    .then((response) => response.data?.data || []);

export const fetchAssigneeOptions = (projectId) =>
  api
    .get(`/work-management/projects/${projectId}/assignee-options`)
    .then((response) => response.data?.data || []);

export const createBoard = (projectId, payload) =>
  api
    .post(`/work-management/projects/${projectId}/boards`, payload)
    .then((response) => response.data?.data);

export const createBoardGroup = (boardId, payload) =>
  api
    .post(`/work-management/boards/${boardId}/groups`, payload)
    .then((response) => response.data?.data);

export const createItem = (groupId, payload) =>
  api
    .post(`/work-management/groups/${groupId}/items`, payload)
    .then((response) => response.data?.data);

export const updateItem = (itemId, payload) =>
  api
    .patch(`/work-management/items/${itemId}`, payload)
    .then((response) => response.data?.data);

export const updateItemAssignees = (itemId, payload) =>
  api
    .put(`/work-management/items/${itemId}/assignees`, payload)
    .then((response) => response.data?.data);

export const updateItemSupporters = (itemId, payload) =>
  api
    .put(`/work-management/items/${itemId}/supporters`, payload)
    .then((response) => response.data?.data);

export const createItemComment = (itemId, payload) =>
  api
    .post(`/work-management/items/${itemId}/comments`, payload)
    .then((response) => response.data?.data);

export const createChecklistItem = (itemId, payload) =>
  api
    .post(`/work-management/items/${itemId}/checklist-items`, payload)
    .then((response) => response.data?.data);

export const updateChecklistItem = (checklistItemId, payload) =>
  api
    .patch(`/work-management/checklist-items/${checklistItemId}`, payload)
    .then((response) => response.data?.data);

export const deleteChecklistItem = (checklistItemId) =>
  api
    .delete(`/work-management/checklist-items/${checklistItemId}`)
    .then((response) => response.data?.data);

export const uploadItemAttachment = (itemId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api
    .post(`/work-management/items/${itemId}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((response) => response.data?.data);
};

export const reorderItem = (itemId, payload) =>
  api
    .post(`/work-management/items/${itemId}/reorder`, payload)
    .then((response) => response.data?.data);

const workManagementApi = {
  fetchWorkManagementHealth,
  fetchMyWork,
  fetchPortfolioSummary,
  fetchWorkManagementCollaborators,
  fetchWorkspaces,
  createWorkspace,
  fetchWorkspaceProjects,
  createProject,
  createProjectFromOpportunity,
  fetchProject,
  fetchProjectBoards,
  fetchProjectItems,
  fetchAssigneeOptions,
  createBoard,
  createBoardGroup,
  createItem,
  updateItem,
  updateItemAssignees,
  updateItemSupporters,
  createItemComment,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  uploadItemAttachment,
  reorderItem,
};

export default workManagementApi;
