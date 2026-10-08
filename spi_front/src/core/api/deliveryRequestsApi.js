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

/**
 * opsApproveDeliveryRequest
 * @param {number} id - delivery request ID
 * @param {{ lines?: Array<{ lineId: number, approvedQty: number }> }} [payload]
 *   If lines are omitted, ops approves all lines at requested quantities.
 *   Pass lines to set partial approved quantities per line.
 */
export const opsApproveDeliveryRequest = async (id, payload = {}) => {
  const response = await api.post(`/delivery-requests/${id}/ops-approve`, payload);
  return extractApiData(response);
};

export const cancelDeliveryRequest = async (id) => {
  const response = await api.post(`/delivery-requests/${id}/cancel`);
  return extractApiData(response);
};

/**
 * confirmDeliveryRequest
 * Logistics confirms physical shipment.
 * @param {number} id - delivery request ID
 * @param {{ dispatchNotes?: string }} [payload]
 */
export const confirmDeliveryRequest = async (id, payload = {}) => {
  const response = await api.post(`/delivery-requests/${id}/confirm-delivery`, payload);
  return extractApiData(response);
};

/**
 * listDeliveryDispatches
 * Returns shipment history with timestamps and per-item quantities.
 * @param {{ ceiling_id?: number, request_id?: number, limit?: number }} params
 */
export const listDeliveryDispatches = async (params = {}) => {
  const response = await api.get("/delivery-requests/dispatches", { params: sanitizeParams(params) });
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
