import api from "./index";

export const listExternalCasesWorkspace = async (params = {}) => {
  const { data } = await api.get("/servicio/external-cases/workspace/list", { params });
  return data?.data || [];
};

export const getExternalCasesWorkspaceKpi = async (params = {}) => {
  const { data } = await api.get("/servicio/external-cases/workspace/kpi", { params });
  return data?.data || {};
};

export const getExternalProvidersHealth = async () => {
  const { data } = await api.get("/servicio/external-cases/providers/health");
  return data?.data || [];
};

export const listExternalProviderIdentities = async (params = {}) => {
  const { data } = await api.get("/servicio/external-cases/provider-identities", { params });
  return data?.data || [];
};

export const upsertExternalProviderIdentity = async (payload = {}) => {
  const { data } = await api.post("/servicio/external-cases/provider-identities", payload);
  return data?.data || data;
};

export const getExternalCaseDetail = async (caseId) => {
  const { data } = await api.get(`/servicio/external-cases/${caseId}`);
  return data?.data || null;
};

export const listExternalCaseEvents = async (caseId) => {
  const { data } = await api.get(`/servicio/external-cases/${caseId}/events`);
  return data?.data || [];
};

export const createExternalCase = async (payload = {}) => {
  const { data } = await api.post("/servicio/external-cases", payload);
  return data?.data || data;
};

export const createInboundExternalCase = async (provider, payload = {}) => {
  const { data } = await api.post(`/servicio/external-cases/inbound/${provider}`, payload);
  return data?.data || data;
};

export const retryExternalCaseSync = async (caseId, payload = {}) => {
  const { data } = await api.post(`/servicio/external-cases/${caseId}/retry-sync`, payload);
  return data?.data || data;
};

export const reconcileExternalCaseState = async (caseId, payload = {}) => {
  const { data } = await api.post(`/servicio/external-cases/${caseId}/reconcile`, payload);
  return data?.data || data;
};

export const postExternalCaseCeacDecision = async (caseId, payload = {}) => {
  const { data } = await api.post(`/servicio/external-cases/${caseId}/ceac-decision`, payload);
  return data?.data || data;
};

export const postExternalCaseGoAppMilestone = async (caseId, milestone, payload = {}) => {
  const { data } = await api.post(`/servicio/external-cases/${caseId}/goapp/milestones/${milestone}`, payload);
  return data?.data || data;
};

export const processExternalCasesSyncQueue = async (payload = {}) => {
  const { data } = await api.post("/servicio/external-cases/sync/process-queue", payload);
  return data?.data || data;
};
