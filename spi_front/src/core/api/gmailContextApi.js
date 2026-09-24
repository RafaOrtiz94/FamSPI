import api from "./index";

const base = "/gmail-context";

export const listGmailContextCommunications = async (params = {}) => {
  const { data } = await api.get(`${base}/communications`, { params });
  return data?.data || { items: [], total: 0 };
};

export const searchGmailContextClients = async (q) => {
  const { data } = await api.get(`${base}/search/clients`, { params: { q } });
  return data?.data || [];
};

export const getGmailContextClientSuggestions = async (id) => {
  const { data } = await api.get(`${base}/communications/${id}/client-suggestions`);
  return data?.data || [];
};

export const getGmailContextProcessCandidates = async (id, clientRequestId) => {
  const { data } = await api.get(`${base}/communications/${id}/process-candidates`, {
    params: { client_request_id: clientRequestId },
  });
  return data?.data || [];
};

export const searchGmailContextProcesses = async ({ entityType, q }) => {
  const { data } = await api.get(`${base}/search/processes`, {
    params: { entity_type: entityType, q },
  });
  return data?.data || [];
};

export const linkGmailContextCommunication = async (id, payload) => {
  const { data } = await api.post(`${base}/communications/${id}/link`, payload);
  return data?.data;
};
