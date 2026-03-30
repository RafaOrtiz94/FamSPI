import api from './index';

export const listCollaborators = async (params = {}) => {
  const { data } = await api.get('/collaborators', { params });
  return data;
};

export const getCollaboratorProfile = async (id) => {
  const { data } = await api.get(`/collaborators/${id}/profile`);
  return data;
};

export const updateCollaboratorProfile = async (id, payload) => {
  const { data } = await api.put(`/collaborators/${id}/profile`, payload);
  return data;
};

export const uploadCollaboratorDocument = async (id, docType, file, options = {}) => {
  const formData = new FormData();
  formData.append('docType', docType);
  formData.append('file', file);
  const { data } = await api.post(`/collaborators/${id}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...options,
  });
  return data;
};
export const getCollaboratorStats = async () => {
  const { data } = await api.get('/collaborators/stats');
  return data;
};

