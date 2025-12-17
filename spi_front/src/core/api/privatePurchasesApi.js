// src/core/api/privatePurchasesApi.js
import api from "./index";

export const listPrivatePurchases = async (params = {}) => {
  const response = await api.get("/private-purchases", { params });
  return response.data?.data || response.data;
};

export const getPrivatePurchase = async (id) => {
  const response = await api.get(`/private-purchases/${id}`);
  return response.data?.data || response.data;
};

export const createPrivatePurchase = async (payload = {}) => {
  const response = await api.post("/private-purchases", payload);
  return response.data?.data || response.data;
};

export const sendPrivatePurchaseOffer = async (id, payload = {}) => {
  const response = await api.post(`/private-purchases/${id}/offer`, payload);
  return response.data?.data || response.data;
};

export const uploadPrivateSignedOffer = async (id, payload = {}) => {
  const response = await api.post(`/private-purchases/${id}/offer/signed`, payload);
  return response.data?.data || response.data;
};

export const registerPrivateClient = async (id) => {
  const response = await api.post(`/private-purchases/${id}/register-client`);
  return response.data?.data || response.data;
};

export const forwardPrivatePurchaseToAcp = async (id) => {
  const response = await api.post(`/private-purchases/${id}/send-to-acp`);
  return response.data?.data || response.data;
};
