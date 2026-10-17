import api from "./index";

const unwrap = (res) => res.data?.data ?? res.data;

// El backend normaliza business_case_id <-> businessCaseId (apiNormalization): usar siempre businessCaseId.
export const listBcAvailability = async (params = {}) => unwrap(await api.get("/bc-availability", { params }));
export const getBcAvailability = async (id) => unwrap(await api.get(`/bc-availability/${id}`));
export const createBcAvailability = async (payload) => unwrap(await api.post("/bc-availability", payload));
export const sendBcAvailabilityToSuppliers = async (id, payload) =>
  unwrap(await api.post(`/bc-availability/${id}/suppliers`, payload));
export const recordBcSupplierResponse = async (id, queryId, payload) =>
  unwrap(await api.post(`/bc-availability/${id}/suppliers/${queryId}/response`, payload));
export const closeBcAvailability = async (id, payload) => unwrap(await api.post(`/bc-availability/${id}/close`, payload));
