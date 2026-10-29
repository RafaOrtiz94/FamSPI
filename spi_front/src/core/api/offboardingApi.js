import api from "./index";

export const getOffboardingWorkspace = async (userId) => {
  const { data } = await api.get(`/offboarding/${userId}/workspace`);
  return data?.data || data;
};

export const updateOffboardingTask = async (userId, taskKey, isCompleted) => {
  const { data } = await api.patch(`/offboarding/${userId}/tasks/${taskKey}`, {
    is_completed: isCompleted,
  });
  return data?.data || data;
};

export const runOffboardingLiquidation = async (userId, payload) => {
  const { data } = await api.post(`/offboarding/${userId}/liquidation`, payload);
  return data?.data || data;
};

export const startOffboardingProcess = async (userId, payload = {}) => {
  const { data } = await api.post(`/offboarding/${userId}/start`, payload);
  return data?.data || data;
};

export const closeOffboardingProcess = async (userId) => {
  const { data } = await api.post(`/offboarding/${userId}/close`);
  return data?.data || data;
};

export const cancelOffboardingProcess = async (userId) => {
  const { data } = await api.post(`/offboarding/${userId}/cancel`);
  return data?.data || data;
};

const offboardingApi = {
  getOffboardingWorkspace,
  updateOffboardingTask,
  runOffboardingLiquidation,
  startOffboardingProcess,
  cancelOffboardingProcess,
  closeOffboardingProcess,
};

export default offboardingApi;
