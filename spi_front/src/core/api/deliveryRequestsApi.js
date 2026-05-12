import api from "./index";

const sanitizeParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      return true;
    }),
  );

const extractApiData = (response) => response?.data?.data || response?.data || null;

export const listDeliveryCeilings = async (params = {}) => {
  const response = await api.get("/delivery-ceilings", { params: sanitizeParams(params) });
  return extractApiData(response);
};

export const listDeliveryRequests = async (params = {}) => {
  const response = await api.get("/delivery-requests", { params: sanitizeParams(params) });
  return extractApiData(response);
};

export const createDeliveryRequest = async (payload) => {
  const response = await api.post("/delivery-requests", payload);
  return extractApiData(response);
};

export const opsApproveDeliveryRequest = async (id) => {
  const response = await api.post(`/delivery-requests/${id}/ops-approve`);
  return extractApiData(response);
};

export const cancelDeliveryRequest = async (id) => {
  const response = await api.post(`/delivery-requests/${id}/cancel`);
  return extractApiData(response);
};

export const confirmDeliveryRequest = async (id) => {
  const response = await api.post(`/delivery-requests/${id}/confirm-delivery`);
  return extractApiData(response);
};

const deliveryRequestsApi = {
  listDeliveryCeilings,
  listDeliveryRequests,
  createDeliveryRequest,
  opsApproveDeliveryRequest,
  cancelDeliveryRequest,
  confirmDeliveryRequest,
};

export default deliveryRequestsApi;
