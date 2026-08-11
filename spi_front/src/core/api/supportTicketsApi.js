import api from "./index";

export const createSupportTicket = async (payload) => {
 const evidencePhotos = Array.isArray(payload?.evidence_photos)
  ? payload.evidence_photos.filter((file) => file instanceof File)
  : (payload?.evidence_photo instanceof File ? [payload.evidence_photo] : []);
 if (evidencePhotos.length) {
  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
   if (key === "evidence_photo" || key === "evidence_photos") return;
   formData.append(key, value);
  });
  evidencePhotos.forEach((file) => formData.append("evidence_photos", file));
  const { data } = await api.post("/support-tickets", formData, {
   headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data || data;
 }
 const { data } = await api.post("/support-tickets", payload);
 return data?.data || data;
};

export const listMySupportTickets = async () => {
 const { data } = await api.get("/support-tickets/my");
 return data?.data || [];
};

export const getSupportTicketEvidenceFile = async (attachmentId) => {
 const response = await api.get(`/support-tickets/attachments/${attachmentId}/file`, {
  responseType: "blob",
 });
 return {
  blob: response.data,
  contentType: response.headers["content-type"] || "image/jpeg",
  filename:
   (response.headers["content-disposition"] || "").match(/filename="?([^"]+)"?/)?.[1] ||
   `evidencia-ticket-${attachmentId}.jpg`,
 };
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
