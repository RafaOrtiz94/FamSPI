import api from "./index";

export const createSupportTicket = async (payload) => {
  const { data } = await api.post("/support-tickets", payload);
  return data?.data || data;
};

export const listMySupportTickets = async () => {
  const { data } = await api.get("/support-tickets/my");
  return data?.data || [];
};

export const listSupportTicketsWorkspace = async (params = {}) => {
  const { data } = await api.get("/support-tickets/workspace/list", { params });
  return data?.data || [];
};

export const getSupportTicketsWorkspaceKpi = async (params = {}) => {
  const { data } = await api.get("/support-tickets/workspace/kpi", { params });
  return data?.data || {};
};

export const listSupportTicketEvents = async (ticketId) => {
  const { data } = await api.get(`/support-tickets/${ticketId}/events`);
  return data?.data || [];
};

export const listSupportTicketComments = async (ticketId) => {
  const { data } = await api.get(`/support-tickets/${ticketId}/comments`);
  return data?.data || [];
};

export const addSupportTicketComment = async (ticketId, payload) => {
  const { data } = await api.post(`/support-tickets/${ticketId}/comments`, payload);
  return data?.data || data;
};

export const assignSupportTicketToMe = async (ticketId) => {
  const { data } = await api.patch(`/support-tickets/${ticketId}/assign-self`);
  return data?.data || data;
};

export const updateSupportTicketStatus = async (ticketId, payload) => {
  const { data } = await api.patch(`/support-tickets/${ticketId}/status`, payload);
  return data?.data || data;
};

export const reopenSupportTicket = async (ticketId, payload = {}) => {
  const { data } = await api.post(`/support-tickets/${ticketId}/reopen`, payload);
  return data?.data || data;
};

export const closeSupportTicketByRequester = async (ticketId, payload = {}) => {
  const { data } = await api.post(`/support-tickets/${ticketId}/close`, payload);
  return data?.data || data;
};

export const rateSupportTicket = async (ticketId, payload) => {
  const { data } = await api.post(`/support-tickets/${ticketId}/satisfaction`, payload);
  return data?.data || data;
};
