import api from "./index";

export const getEquipmentStatuses = async () => {
  const response = await api.get("/equipment-management/statuses");
  return response.data?.data || [];
};

export const getEquipmentModels = async (params = {}) => {
  const response = await api.get("/equipment-management/models", { params });
  return response.data?.data || [];
};

export const getEquipmentModelDetail = async (id) => {
  const response = await api.get(`/equipment-management/models/${id}`);
  return response.data?.data;
};

export const getEquipmentAssets = async (params = {}) => {
  const response = await api.get("/equipment-management/assets", { params });
  return response.data?.data || [];
};

export const createEquipmentAsset = async (payload) => {
  const response = await api.post("/equipment-management/assets", payload);
  return response.data;
};

export const changeEquipmentAssetStatus = async (id, payload) => {
  const response = await api.post(`/equipment-management/assets/${id}/status`, payload);
  return response.data;
};

export const reserveEquipmentAsset = async (id, payload) => {
  const response = await api.post(`/equipment-management/assets/${id}/reserve`, payload);
  return response.data;
};

export const installEquipmentAsset = async (id, payload) => {
  const response = await api.post(`/equipment-management/assets/${id}/install`, payload);
  return response.data;
};

export const getEquipmentAssetTimeline = async (id) => {
  const response = await api.get(`/equipment-management/assets/${id}/timeline`);
  return response.data?.data || [];
};

export const getEquipmentMaintenanceSchedule = async (params = {}) => {
  const response = await api.get("/equipment-management/schedule", { params });
  return response.data?.data || [];
};
