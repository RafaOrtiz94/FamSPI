import api from "./index";

export const getIntegrationsHealth = async () => {
  const { data } = await api.get("/integrations/health");
  return data?.data || [];
};

export const processIntegrationsExternalCasesSyncQueue = async (payload = {}) => {
  const { data } = await api.post("/integrations/external-cases/sync/process-queue", payload);
  return data?.data || {};
};
