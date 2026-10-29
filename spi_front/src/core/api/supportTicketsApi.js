import api, { isTransientApiError } from "./index";
import { readCachedResource, writeCachedResource } from "../pwa/localCache";

const MY_SUPPORT_TICKETS_CACHE_KEY = "support_tickets_my_snapshot";
const SUPPORT_TICKET_COMMENTS_CACHE_PREFIX = "support_ticket_comments_";
const MY_SUPPORT_TICKETS_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24;
const SUPPORT_TICKET_COMMENTS_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 12;

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
 try {
  const { data } = await api.get("/support-tickets/my");
  const payload = data?.data || [];
  writeCachedResource(MY_SUPPORT_TICKETS_CACHE_KEY, payload);
  return payload;
 } catch (error) {
  const cached = readCachedResource(MY_SUPPORT_TICKETS_CACHE_KEY, {
   maxAgeMs: MY_SUPPORT_TICKETS_CACHE_MAX_AGE_MS,
  });
  if (cached?.data && isTransientApiError(error)) {
   return cached.data;
  }
  throw error;
 }
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
 const cacheKey = `${SUPPORT_TICKET_COMMENTS_CACHE_PREFIX}${ticketId}`;
 try {
  const { data } = await api.get(`/support-tickets/${ticketId}/comments`);
  const payload = data?.data || [];
  writeCachedResource(cacheKey, payload);
  return payload;
 } catch (error) {
  const cached = readCachedResource(cacheKey, {
   maxAgeMs: SUPPORT_TICKET_COMMENTS_CACHE_MAX_AGE_MS,
  });
  if (cached?.data && isTransientApiError(error)) {
   return cached.data;
  }
  throw error;
 }
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

// ── KPIs configurables (jefe_ti) ────────────────────────────────────────

export const listSupportTicketWorkspaceKpiDefinitions = async () => {
 const { data } = await api.get("/support-tickets/workspace/kpi-definitions");
 return data?.data || [];
};

export const listTiKpiDefinitions = async () => {
 const { data } = await api.get("/support-tickets/admin/kpi-definitions");
 return data?.data || [];
};

export const getTiKpiMetricCatalog = async () => {
 const { data } = await api.get("/support-tickets/admin/kpi-definitions/metric-catalog");
 return data?.data || { metrics: [], filterableFields: [] };
};

export const createTiKpiDefinition = async (payload) => {
 const { data } = await api.post("/support-tickets/admin/kpi-definitions", payload);
 return data?.data || data;
};

export const updateTiKpiDefinition = async (id, payload) => {
 const { data } = await api.put(`/support-tickets/admin/kpi-definitions/${id}`, payload);
 return data?.data || data;
};

export const deleteTiKpiDefinition = async (id) => {
 const { data } = await api.delete(`/support-tickets/admin/kpi-definitions/${id}`);
 return data?.data || data;
};

export const reorderTiKpiDefinitions = async (items) => {
 const { data } = await api.patch("/support-tickets/admin/kpi-definitions/reorder", items);
 return data?.data || [];
};

// ── Reportes mensuales (jefe_ti) ────────────────────────────────────────

export const getTiMonthlyReport = async ({ year, month }) => {
 const { data } = await api.get("/support-tickets/admin/reports/monthly", { params: { year, month } });
 return data?.data || null;
};

export const exportTiMonthlyReport = async ({ year, month, format }) => {
 const response = await api.get("/support-tickets/admin/reports/monthly/export", {
  params: { year, month, format },
  responseType: "blob",
 });
 const filename =
  (response.headers["content-disposition"] || "").match(/filename="?([^"]+)"?/)?.[1] ||
  `reporte-ti-${year}-${String(month).padStart(2, "0")}.${format}`;
 return { blob: response.data, filename };
};
