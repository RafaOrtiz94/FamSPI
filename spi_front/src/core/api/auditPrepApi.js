import api from "./index";

export const getAuditStatus = async () => {
  const { data } = await api.get("/audit-prep/status");
  return data;
};

export const updateAuditStatus = async (payload) => {
  const { data } = await api.put("/audit-prep/status", payload);
  return data;
};

export const listAuditSections = async () => {
  const { data } = await api.get("/audit-prep/sections");
  return data;
};

export const upsertAuditSection = async (payload) => {
  const { data } = await api.post("/audit-prep/sections", payload);
  return data;
};

export const listAuditDocuments = async () => {
  const { data } = await api.get("/audit-prep/documents");
  return data;
};

export const uploadAuditDocument = async (payload) => {
  const { data } = await api.post("/audit-prep/documents/upload", payload);
  return data;
};

export const updateAuditDocumentStatus = async (id, status) => {
  const { data } = await api.patch(`/audit-prep/documents/${id}/status`, { status });
  return data;
};

export const downloadAuditDocument = async (id) =>
  api.get(`/audit-prep/documents/${id}/download`, { responseType: "blob" });

export const listExternalAccess = async () => {
  const { data } = await api.get("/audit-prep/external-access");
  return data;
};

export const addExternalAccess = async (payload) => {
  const { data } = await api.post("/audit-prep/external-access", payload);
  return data;
};

export const revokeExternalAccess = async (id) => {
  const { data } = await api.delete(`/audit-prep/external-access/${id}`);
  return data;
};

export default {
  getAuditStatus,
  updateAuditStatus,
  listAuditSections,
  upsertAuditSection,
  listAuditDocuments,
  uploadAuditDocument,
  updateAuditDocumentStatus,
  downloadAuditDocument,
  listExternalAccess,
  addExternalAccess,
  revokeExternalAccess,
};
