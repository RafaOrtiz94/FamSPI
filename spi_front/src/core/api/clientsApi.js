import api from "./index";

export const fetchClients = async (params = {}) => {
  const { data } = await api.get("/clients", { params });
  return data.data || data.clients || [];
};

export const assignClient = async (clientId, assigneeEmail) => {
  const { data } = await api.post(`/clients/${clientId}/assign`, { assignee_email: assigneeEmail });
  return data.data || data;
};

export const updateVisitStatus = async (clientId, payload) => {
  const { data } = await api.post(`/clients/${clientId}/visit-status`, payload);
  return data.data || data;
};
