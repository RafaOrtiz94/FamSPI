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

export const approveViaticoSegment = async (viaticoId) => {
 const { data } = await api.patch(`/viaticos/${viaticoId}/approve-segment`);
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

export const uploadViaticoInvoicesXml = async (viaticoId, payload) => {
  const { data } = await api.post(`/viaticos/${viaticoId}/invoices/xml`, payload);
  return data?.data || [];
};

export const uploadViaticoInvoicesZip = async (viaticoId, payload) => {
  const { data } = await api.post(`/viaticos/${viaticoId}/invoices/zip`, payload);
  return data?.data || data;
};

export const patchViaticoInvoice = async (invoiceId, payload) => {
 const { data } = await api.patch(`/viaticos/invoices/${invoiceId}`, payload);
 return data?.data || data;
};

export const upsertViaticoZone = async (payload) => {
 const { data } = await api.post("/viaticos/config/zones", payload);
 return data?.data || data;
};

export const upsertViaticoFixedProfile = async (payload) => {
 const { data } = await api.post("/viaticos/config/fixed-profiles", payload);
 return data?.data || data;
};

export const listViaticoFixedProfiles = async (params = {}) => {
 const { data } = await api.get("/viaticos/config/fixed-profiles", { params });
 return data?.data || [];
};

export const updateViaticoPolicy = async (payload) => {
 const { data } = await api.patch("/viaticos/config/policy", payload);
 return data?.data || data;
};

export const getViaticoSummaryReport = async (params = {}) => {
 const { data } = await api.get("/viaticos/reports/summary", { params });
 return data?.data || { rows: [] };
};

export const getViaticoAtsXml = async (params = {}) => {
 const { data } = await api.get("/viaticos/ats/xml", { params });
 return data?.data || data;
};

export const syncViaticoSri = async (payload) => {
 const { data } = await api.post("/viaticos/sync-sri", payload);
 return data?.data || data;
};

export const uploadViaticoInvoicesTxt = async (viaticoId, txtContent, categories = {}, options = {}) => {
  const { data } = await api.post(
    `/viaticos/${viaticoId}/invoices/txt`,
    { txt_content: txtContent, categories },
    { headers: options.flow ? { "x-viaticos-flow": options.flow } : {} }
  );
  return data?.data || data;
};

export const submitViaticoForReview = async (viaticoId) => {
  const { data } = await api.post(`/viaticos/${viaticoId}/submit-review`);
  return data?.data || data;
};

export const previewViaticoInvoicesTxt = async (viaticoId, txtContent) => {
  const { data } = await api.post(`/viaticos/${viaticoId}/invoices/txt/preview`, { txt_content: txtContent });
  return data?.data || data;
};

export const deleteViaticoInvoice = async (invoiceId) => {
 const { data } = await api.delete(`/viaticos/invoices/${invoiceId}`);
 return data?.data || data;
};

export const listViaticoInvoices = async (viaticoId) => {
 const { data } = await api.get(`/viaticos/${viaticoId}/invoices`);
 return data?.data || [];
};

// Notas de venta manual
export const createManualNote = async (viaticoId, payload, options = {}) => {
 const { data } = await api.post(`/viaticos/${viaticoId}/invoices/manual`, payload, {
  headers: options.flow ? { "x-viaticos-flow": options.flow } : {},
 });
 return data?.data || data;
};

export const listManualNotes = async (viaticoId) => {
 const { data } = await api.get(`/viaticos/${viaticoId}/invoices/manual`);
 return data?.data || [];
};

export const updateManualNote = async (noteId, payload, options = {}) => {
 const { data } = await api.patch(`/viaticos/invoices/manual/${noteId}`, payload, {
  headers: options.flow ? { "x-viaticos-flow": options.flow } : {},
 });
 return data?.data || data;
};

export const deleteManualNote = async (noteId, options = {}) => {
 const { data } = await api.delete(`/viaticos/invoices/manual/${noteId}`, {
  headers: options.flow ? { "x-viaticos-flow": options.flow } : {},
 });
 return data?.data || data;
};

// Compras sin factura
export const createPurchaseNoInvoice = async (viaticoId, payload, options = {}) => {
 const { data } = await api.post(`/viaticos/${viaticoId}/purchases-no-invoice`, payload, {
  headers: options.flow ? { "x-viaticos-flow": options.flow } : {},
 });
 return data?.data || data;
};

export const listPurchasesNoInvoice = async (viaticoId) => {
 const { data } = await api.get(`/viaticos/${viaticoId}/purchases-no-invoice`);
 return data?.data || [];
};

export const approvePurchaseNoInvoice = async (purchaseId, payload) => {
 const { data } = await api.patch(`/viaticos/purchases/${purchaseId}/approve`, payload);
 return data?.data || data;
};
