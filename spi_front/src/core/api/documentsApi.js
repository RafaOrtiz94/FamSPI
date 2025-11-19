import api from "./index";

export const createFromTemplate = async (payload) => {
  const { data } = await api.post("/documents/from-template", payload);
  return data.result || data;
};

export const signDocument = async (documentId, base64, tag) => {
  const { data } = await api.post(`/documents/${documentId}/sign`, {
    base64,
    tag,
  });
  return data.result || data;
};

export const exportToPDF = async (documentId) => {
  const { data } = await api.post(`/documents/${documentId}/export-pdf`);
  return data.result || data;
};

export const getDocumentsByRequest = async (requestId) => {
  const { data } = await api.get(`/documents/by-request/${requestId}`);
  return data.rows || data.result?.rows || data.documents || [];
};
