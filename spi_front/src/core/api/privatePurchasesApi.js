// src/core/api/privatePurchasesApi.js
import api from ".";

const getPrivatePurchases = (params = {}) => {
  return api.get("/private-purchases", { params });
};

const getPrivatePurchaseById = (id) => {
  return api.get(`/private-purchases/${id}`);
};

const sendOffer = (id, payload) => {
  return api.post(`/private-purchases/${id}/offer`, payload);
};

const uploadSignedOffer = (id, payload) => {
  return api.post(`/private-purchases/${id}/offer/signed`, payload);
};

const registerClient = (id) => {
  return api.post(`/private-purchases/${id}/register-client`);
};

const forwardToACP = (id) => {
  return api.post(`/private-purchases/${id}/send-to-acp`);
};

const createPrivatePurchase = (payload) => {
  return api.post("/private-purchases", payload);
};

export { getPrivatePurchases, getPrivatePurchaseById, sendOffer, uploadSignedOffer, registerClient, forwardToACP, createPrivatePurchase };
