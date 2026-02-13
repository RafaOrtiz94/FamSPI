import api from "./index";

export const listViaticosCandidates = async (params = {}) => {
  const { data } = await api.get("/viaticos/candidates", { params });
  return data?.data || [];
};

export const listViaticos = async (params = {}) => {
  const { data } = await api.get("/viaticos", { params });
  return data?.data || [];
};

export const upsertViatico = async (payload) => {
  const { data } = await api.post("/viaticos", payload);
  return data?.data || data;
};

export const updateViaticoStatus = async (viaticoId, payload) => {
  const { data } = await api.patch(`/viaticos/${viaticoId}/status`, payload);
  return data?.data || data;
};

export const listViaticoDocuments = async (viaticoId) => {
  const { data } = await api.get(`/viaticos/${viaticoId}/documents`);
  return data?.data || [];
};

export const addViaticoDocument = async (viaticoId, payload) => {
  const { data } = await api.post(`/viaticos/${viaticoId}/documents`, payload);
  return data?.data || data;
};

export const getViaticoReport = async (viaticoId) => {
  const { data } = await api.get(`/viaticos/${viaticoId}/report`);
  return data?.data || data;
};
