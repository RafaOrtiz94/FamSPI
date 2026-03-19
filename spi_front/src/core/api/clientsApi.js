import api from "./index";

export const fetchClients = async (params = {}) => {
 const { data } = await api.get("/clients", { params });
 return {
 clients: data.data || [],
 prospects: data.prospects || [],
 summary: data.summary || {},
 };
};

export const assignClient = async (clientId, payload) => {
 const body =
 typeof payload === "string"
 ? { assignee_email: payload }
 : { ...(payload || {}) };
 const { data } = await api.post(`/clients/${clientId}/assign`, body);
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

export const getClientDetail = async (clientId) => {
 const { data } = await api.get(`/clients/${clientId}`);
 return data.data || data;
};

export const updateClient = async (clientId, formData = {}, files = {}) => {
 const data = new FormData();

 Object.entries(formData).forEach(([key, value]) => {
 if (value === undefined || value === null || value === "") return;
 const normalized = typeof value === "string" ? value.trim() : value;
 data.append(key, normalized);
 });

 Object.entries(files).forEach(([key, file]) => {
 if (!file) return;
 data.append(key, file);
 });

 const response = await api.put(`/clients/${clientId}`, data, {
 headers: { "Content-Type": "multipart/form-data" },
 });

 return response.data?.data || response.data;
};
