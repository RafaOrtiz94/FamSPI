import api from "../../../core/api";

const unwrap = (response) => response?.data?.data ?? response?.data ?? response;
const basePath = "/famsheets";

export const listOpportunities = async (params = {}) => {
  const response = await api.get(basePath, { params });
  return unwrap(response);
};

export const createOpportunity = async (payload) => {
  const response = await api.post(basePath, payload);
  return unwrap(response);
};

export const getOpportunity = async (id) => {
  const response = await api.get(`${basePath}/${id}`);
  return unwrap(response);
};

export const updateOpportunity = async (id, payload) => {
  const response = await api.put(`${basePath}/${id}`, payload);
  return unwrap(response);
};

export const getManagerDashboard = async () => {
  const response = await api.get(`${basePath}/dashboard/manager`);
  return unwrap(response);
};

export const searchAccounts = async (params = {}) => {
  const response = await api.get(`${basePath}/accounts`, { params });
  return unwrap(response);
};

export const createAccount = async (payload) => {
  const response = await api.post(`${basePath}/accounts`, payload);
  return unwrap(response);
};

export const searchContacts = async (params = {}) => {
  const response = await api.get(`${basePath}/contacts`, { params });
  return unwrap(response);
};

export const createContact = async (payload) => {
  const response = await api.post(`${basePath}/contacts`, payload);
  return unwrap(response);
};

export const saveInfluence = async (opportunityId, payload) => {
  const response = await api.post(`${basePath}/${opportunityId}/influences`, payload);
  return unwrap(response);
};

export const deleteInfluence = async (opportunityId, influenceId) => {
  const response = await api.delete(`${basePath}/${opportunityId}/influences/${influenceId}`);
  return unwrap(response);
};

export const saveFlag = async (opportunityId, payload) => {
  const response = await api.post(`${basePath}/${opportunityId}/flags`, payload);
  return unwrap(response);
};

export const deleteFlag = async (opportunityId, flagId) => {
  const response = await api.delete(`${basePath}/${opportunityId}/flags/${flagId}`);
  return unwrap(response);
};

export const saveCompetitor = async (opportunityId, payload) => {
  const response = await api.post(`${basePath}/${opportunityId}/competitors`, payload);
  return unwrap(response);
};

export const deleteCompetitor = async (opportunityId, competitorId) => {
  const response = await api.delete(`${basePath}/${opportunityId}/competitors/${competitorId}`);
  return unwrap(response);
};

export const saveAction = async (opportunityId, payload) => {
  const response = await api.post(`${basePath}/${opportunityId}/actions`, payload);
  return unwrap(response);
};

export const deleteAction = async (opportunityId, actionId) => {
  const response = await api.delete(`${basePath}/${opportunityId}/actions/${actionId}`);
  return unwrap(response);
};

export const createComment = async (opportunityId, payload) => {
  const response = await api.post(`${basePath}/${opportunityId}/comments`, payload);
  return unwrap(response);
};

export const deleteComment = async (opportunityId, commentId) => {
  const response = await api.delete(`${basePath}/${opportunityId}/comments/${commentId}`);
  return unwrap(response);
};

// Actualiza los 5 criterios de valoración (S/N/D) de una oportunidad.
// El backend devuelve la oportunidad completa con rating.puntuacion actualizado.
export const updateRating = async (opportunityId, payload) => {
  const response = await api.put(`${basePath}/${opportunityId}/rating`, payload);
  return unwrap(response);
};

export const lookupProcess = async (type, processId) => {
  const response = await api.get(`${basePath}/process-lookup/${type}/${processId}`);
  return unwrap(response);
};

export const linkProcess = async (opportunityId, payload) => {
  const response = await api.post(`${basePath}/${opportunityId}/links`, payload);
  return unwrap(response);
};

export const unlinkProcess = async (opportunityId, linkId) => {
  const response = await api.delete(`${basePath}/${opportunityId}/links/${linkId}`);
  return unwrap(response);
};
