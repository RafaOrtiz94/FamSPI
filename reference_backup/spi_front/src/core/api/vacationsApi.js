import api from "./index";

export const createVacationRequest = async (payload) => {
  const { data } = await api.post("/vacaciones", payload);
  return data?.data || data;
};

export const listVacationRequests = async (params = {}) => {
  const { data } = await api.get("/vacaciones", { params });
  return data?.data || data;
};

export const updateVacationStatus = async (id, status) => {
  const { data } = await api.patch(`/vacaciones/${id}/status`, { status });
  return data?.data || data;
};

export const getVacationSummary = async (all = false) => {
  const { data } = await api.get("/vacaciones/summary/data", { params: { all } });
  return data?.data || data;
};

export default {
  createVacationRequest,
  listVacationRequests,
  updateVacationStatus,
  getVacationSummary,
};
