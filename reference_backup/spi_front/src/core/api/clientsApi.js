import api from "./index";

export const fetchClients = async (params = {}) => {
  const { data } = await api.get("/clients", { params });
  return {
    clients: data.data || [],
    prospects: data.prospects || [],
    summary: data.summary || {},
  };
};

export const assignClient = async (clientId, assigneeEmail) => {
  const { data } = await api.post(`/clients/${clientId}/assign`, { assignee_email: assigneeEmail });
  return data.data || data;
};

export const setVisitStatus = async (clientId, data) => {
  const response = await api.post(`/clients/${clientId}/visit-status`, data);
  return response.data.data;
};

export const registerProspectVisit = async (data) => {
  const response = await api.post(`/clients/prospect-visit`, data);
  return response.data.data;
};

export const startClientVisit = async (clientId, payload = {}) => {
  // Inicio de visita: marcamos como "in_visit" en backend para reflejar visita en curso.
  const body = { ...payload, status: payload.status || "in_visit" };
  const { data } = await api.post(`/clients/${clientId}/visit-status`, body);
  return data.data || data;
};

export const endClientVisit = async (clientId, payload = {}) => {
  // Al finalizar la visita, marcamos como "visited" en backend.
  const body = { ...payload, status: payload.status || "visited" };
  const { data } = await api.post(`/clients/${clientId}/visit-status`, body);
  return data.data || data;
};
