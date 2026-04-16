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
  const response = await api.get("/delivery-ceilings", {
    params: sanitizeParams(params),
  });
  return extractApiData(response);
};

export const createDeliveryRequest = async (payload) => {
  const response = await api.post("/delivery-requests", payload);
  return extractApiData(response);
};

const deliveryRequestsApi = {
  listDeliveryCeilings,
  createDeliveryRequest,
};

export default deliveryRequestsApi;
