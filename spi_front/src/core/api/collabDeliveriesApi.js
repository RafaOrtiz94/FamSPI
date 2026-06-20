import api from "./index";

const base = "/collab-deliveries";

// ── Catálogo ──────────────────────────────────────────────────────────────────

export const listCollabCatalog = async (params = {}) => {
  const { data } = await api.get(`${base}/catalog`, { params });
  return Array.isArray(data) ? data : data?.data ?? [];
};

export const createCollabCatalogItem = async (payload) => {
  const { data } = await api.post(`${base}/catalog`, payload);
  return data?.data ?? data;
};

export const updateCollabCatalogItem = async (id, payload) => {
  const { data } = await api.patch(`${base}/catalog/${id}`, payload);
  return data?.data ?? data;
};

export const deleteCollabCatalogItem = async (id) => {
  const { data } = await api.delete(`${base}/catalog/${id}`);
  return data?.data ?? data;
};

// ── Entregas ──────────────────────────────────────────────────────────────────

export const listCollabDeliveries = async (params = {}) => {
  const { data } = await api.get(base, { params });
  return Array.isArray(data) ? data : data?.data ?? [];
};

export const listCollabDeliveriesByUser = async (userId) => {
  const { data } = await api.get(`${base}/user/${userId}`);
  return Array.isArray(data) ? data : data?.data ?? [];
};

export const getCollabDelivery = async (id) => {
  const { data } = await api.get(`${base}/${id}`);
  return data?.data ?? data;
};

export const createCollabDelivery = async (payload) => {
  const { data } = await api.post(base, payload);
  return data?.data ?? data;
};

export const updateCollabDelivery = async (id, payload) => {
  const { data } = await api.patch(`${base}/${id}`, payload);
  return data?.data ?? data;
};

export const withdrawCollabDelivery = async (id, payload = {}) => {
  const { data } = await api.post(`${base}/${id}/withdraw`, payload);
  return data?.data ?? data;
};

export const listCollabDeliveryEvents = async (id) => {
  const { data } = await api.get(`${base}/${id}/events`);
  return Array.isArray(data) ? data : data?.data ?? [];
};

// ── Actas ─────────────────────────────────────────────────────────────────────

export const listCollabActasByDelivery = async (deliveryId) => {
  const { data } = await api.get(`${base}/${deliveryId}/actas`);
  return Array.isArray(data) ? data : data?.data ?? [];
};

export const getCollabActa = async (actaId) => {
  const { data } = await api.get(`${base}/actas/${actaId}`);
  return data?.data ?? data;
};

export const generateCollabActa = async (deliveryId, payload) => {
  const { data } = await api.post(`${base}/${deliveryId}/actas`, payload);
  return data?.data ?? data;
};

export const getCollabActaPdf = async (actaId) => {
  const response = await api.get(`${base}/actas/${actaId}/pdf`, { responseType: "blob" });
  return {
    blob: response.data,
    filename: (response.headers["content-disposition"] || "").match(/filename="?([^"]+)"?/)?.[1] || `acta_${actaId}.pdf`,
  };
};

export const uploadCollabSignedActa = async (actaId, file) => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(`${base}/actas/${actaId}/upload-signed`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data ?? data;
};

export const getCollabActaSignatureWorkflow = async (actaId) => {
  const { data } = await api.get(`${base}/actas/${actaId}/signature-workflow`);
  return data?.data ?? data;
};

export const startCollabActaSignatureWorkflow = async (actaId, payload = {}) => {
  const { data } = await api.post(`${base}/actas/${actaId}/start-signature-workflow`, payload);
  return data?.data ?? data;
};

// ── Renovaciones ──────────────────────────────────────────────────────────────

export const listCollabRenewals = async (params = {}) => {
  const { data } = await api.get(`${base}/renewals`, { params });
  return Array.isArray(data) ? data : data?.data ?? [];
};

export const completeCollabRenewal = async (id, payload = {}) => {
  const { data } = await api.patch(`${base}/renewals/${id}`, payload);
  return data?.data ?? data;
};

// ── Resumen ejecutivo ─────────────────────────────────────────────────────────

export const getCollabSummary = async () => {
  const { data } = await api.get(`${base}/summary`);
  return data?.data ?? data;
};

// ── Offboarding ───────────────────────────────────────────────────────────────

export const createCollabOffboardingTasks = async (userId) => {
  const { data } = await api.post(`${base}/user/${userId}/offboarding`);
  return data?.data ?? data;
};

// ── Sesiones de entrega ───────────────────────────────────────────────────────

export const listCollabSessions = async (params = {}) => {
  const { data } = await api.get(`${base}/sessions`, { params });
  return Array.isArray(data) ? data : data?.data ?? [];
};

export const listCollabSessionsByUser = async (userId, params = {}) => {
  const { data } = await api.get(`${base}/sessions`, { params: { ...params, userId } });
  return Array.isArray(data) ? data : data?.data ?? [];
};

export const createCollabSession = async (payload) => {
  const { data } = await api.post(`${base}/sessions`, payload);
  return data?.data ?? data;
};

export const updateCollabSession = async (sessionId, payload) => {
  const { data } = await api.patch(`${base}/sessions/${sessionId}`, payload);
  return data?.data ?? data;
};

export const getCollabActaRecipientInfo = async (userId) => {
  const { data } = await api.get(`${base}/recipient-info/${userId}`);
  return data?.data ?? data;
};

export const getCollabSession = async (sessionId) => {
  const { data } = await api.get(`${base}/sessions/${sessionId}`);
  return data?.data ?? data;
};

export const createCollabTiSession = async (payload) => {
  const { data } = await api.post(`${base}/sessions/ti`, payload);
  return data?.data ?? data;
};

// ── Documentos por entrega ────────────────────────────────────────────────────

export const listCollabDeliveryDocsByUser = async (userId) => {
  const { data } = await api.get(`${base}/user/${userId}/docs`);
  return Array.isArray(data) ? data : data?.data ?? [];
};

export const listCollabDeliveryDocs = async (deliveryId) => {
  const { data } = await api.get(`${base}/${deliveryId}/docs`);
  return Array.isArray(data) ? data : data?.data ?? [];
};

export const getCollabFullReport = async () => {
  const { data } = await api.get(`${base}/report/full`);
  return Array.isArray(data) ? data : data?.data ?? [];
};

export const getCollabCollaboratorReport = async (userId) => {
  const { data } = await api.get(`${base}/report/collaborator/${userId}`);
  return Array.isArray(data) ? data : data?.data ?? [];
};

export const downloadCollabFullReportPdf = async () => {
  const response = await api.get(`${base}/report/full/pdf`, { responseType: "blob" });
  return {
    blob: response.data,
    sha256: response.headers["x-sha256"] || null,
    filename: (response.headers["content-disposition"] || "").match(/filename="?([^"]+)"?/)?.[1] || "reporte_general.pdf",
  };
};

export const downloadCollabCollaboratorReportPdf = async (userId) => {
  const response = await api.get(`${base}/report/collaborator/${userId}/pdf`, { responseType: "blob" });
  return {
    blob: response.data,
    sha256: response.headers["x-sha256"] || null,
    filename: (response.headers["content-disposition"] || "").match(/filename="?([^"]+)"?/)?.[1] || `reporte_colaborador_${userId}.pdf`,
  };
};

export const uploadCollabDeliveryDoc = async (deliveryId, file, docType = "factura") => {
  const form = new FormData();
  form.append("file", file);
  form.append("doc_type", docType);
  const { data } = await api.post(`${base}/${deliveryId}/docs`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data ?? data;
};
