import api from "./index";

const base = "/signature-workflows";

export const listSignatureWorkflows = async (params = {}) => {
  const { data } = await api.get(base, { params });
  return Array.isArray(data) ? data : data?.data ?? [];
};

export const getSignatureWorkflow = async (workflowId) => {
  const { data } = await api.get(`${base}/${workflowId}`);
  return data?.data ?? data;
};

export const createSignatureWorkflow = async (payload) => {
  const { data } = await api.post(base, payload);
  return data?.data ?? data;
};

export const sendSignatureWorkflow = async (workflowId) => {
  const { data } = await api.post(`${base}/${workflowId}/send`);
  return data?.data ?? data;
};

export const listMyPendingSignatureWorkflows = async () => {
  const { data } = await api.get(`${base}/me/pending`);
  return Array.isArray(data) ? data : data?.data ?? [];
};

export const listMyCompletedSignatureWorkflows = async () => {
  const { data } = await api.get(`${base}/me/completed`);
  return Array.isArray(data) ? data : data?.data ?? [];
};

export const openSignatureWorkflowStep = async (workflowId, signerId) => {
  const { data } = await api.post(`${base}/${workflowId}/signers/${signerId}/open`);
  return data?.data ?? data;
};

export const signSignatureWorkflowStep = async (workflowId, signerId, payload) => {
  const { data } = await api.post(`${base}/${workflowId}/signers/${signerId}/sign`, payload);
  return data?.data ?? data;
};

export const rejectSignatureWorkflowStep = async (workflowId, signerId, payload) => {
  const { data } = await api.post(`${base}/${workflowId}/signers/${signerId}/reject`, payload);
  return data?.data ?? data;
};

export const verifySignatureWorkflowToken = async (token) => {
  const { data } = await api.get(`${base}/verify/${token}/json`);
  return data?.data ?? data;
};

export const getSignatureWorkflowSourcePdfBuffer = async (workflowId, documentId) => {
  const response = await api.get(`${base}/${workflowId}/documents/${documentId}/pdf`, {
    responseType: "arraybuffer",
  });
  return response.data; // ArrayBuffer para pdfjs-dist
};

export const downloadSignatureWorkflowSourcePdf = async (workflowId, documentId) => {
  const response = await api.get(`${base}/${workflowId}/documents/${documentId}/pdf`, {
    responseType: "blob",
  });
  return {
    blob: response.data,
    filename:
      (response.headers["content-disposition"] || "").match(/filename="?([^"]+)"?/)?.[1] ||
      `workflow_${workflowId}_document_${documentId}.pdf`,
  };
};

export const downloadSignatureWorkflowFinalPdf = async (workflowId, documentId) => {
  const response = await api.get(`${base}/${workflowId}/documents/${documentId}/final-pdf`, {
    responseType: "blob",
  });
  return {
    blob: response.data,
    filename:
      (response.headers["content-disposition"] || "").match(/filename="?([^"]+)"?/)?.[1] ||
      `workflow_${workflowId}_document_${documentId}_final.pdf`,
  };
};

export const cancelSignatureWorkflow = async (workflowId) => {
  const { data } = await api.post(`${base}/${workflowId}/cancel`);
  return data?.data ?? data;
};

export const reassignSignatureWorkflowSigner = async (workflowId, signerId, payload) => {
  const { data } = await api.post(`${base}/${workflowId}/signers/${signerId}/reassign`, payload);
  return data?.data ?? data;
};

/** Valida que los user_ids tengan la ficha TH completa. Devuelve array de incompletos. */
export const validateSignerProfiles = async (userIds = []) => {
  const { data } = await api.post(`${base}/validate-signer-profiles`, { user_ids: userIds });
  return data?.incomplete ?? [];
};
