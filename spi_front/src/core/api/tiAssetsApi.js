import api from "./index";

export const listTiAssets = async (params = {}) => {
 const { data } = await api.get("/ti-assets", { params });
 return data?.data || [];
};

export const createTiAsset = async (payload = {}) => {
 const { data } = await api.post("/ti-assets", payload);
 return data?.data || null;
};

export const updateTiAsset = async (assetId, payload = {}) => {
 const { data } = await api.patch(`/ti-assets/${assetId}`, payload);
 return data?.data || null;
};

export const assignTiAsset = async (assetId, payload = {}) => {
 const { data } = await api.post(`/ti-assets/${assetId}/assign`, payload);
 return data?.data || null;
};

export const updateTiAssetStatus = async (assetId, payload = {}) => {
 const { data } = await api.post(`/ti-assets/${assetId}/status`, payload);
 return data?.data || null;
};

export const getTiAssetHistory = async (assetId) => {
 const { data } = await api.get(`/ti-assets/${assetId}/history`);
 return data?.data || [];
};

export const getTiAssetAssignmentsHistory = async (assetId) => {
 const { data } = await api.get(`/ti-assets/${assetId}/assignments-history`);
 return data?.data || [];
};

export const listTiMaintenance = async (params = {}) => {
 const { data } = await api.get("/ti-assets/maintenance/list", { params });
 return data?.data || [];
};

export const clearTiMaintenance = async () => {
 const { data } = await api.delete("/ti-assets/maintenance");
 return data?.data || null;
};

export const createTiMaintenance = async (payload = {}) => {
 const { data } = await api.post("/ti-assets/maintenance", payload);
 return data?.data || null;
};

export const generateTiMaintenanceAnnual = async (payload = {}) => {
 const { data } = await api.post("/ti-assets/maintenance/annual/generate", payload);
 return data?.data || null;
};

export const completeTiMaintenance = async (id, payload = {}) => {
 const { data } = await api.post(`/ti-assets/maintenance/${id}/complete`, payload);
 return data?.data || null;
};

export const requestTiMaintenanceDelivery = async (id) => {
 const { data } = await api.post(`/ti-assets/maintenance/${id}/request-delivery`);
 return data?.data || null;
};

export const setTiMaintenanceCoordinationDate = async (id, payload = {}) => {
 const { data } = await api.patch(`/ti-assets/maintenance/${id}/coordination-date`, payload);
 return data?.data || null;
};

export const generateTiMaintenanceFuture = async () => {
 const { data } = await api.post("/ti-assets/maintenance/generate");
 return data?.data || null;
};

export const refreshTiMaintenanceSchedule = async () => {
 const { data } = await api.post("/ti-assets/maintenance/refresh");
 return data?.data || null;
};

export const generateTiMaintenanceReport = async (payload = {}) => {
 const { data } = await api.post("/ti-assets/reports/generate", payload);
 return data?.data || null;
};

export const listTiMaintenanceReports = async () => {
 const { data } = await api.get("/ti-assets/reports");
 return data?.data || [];
};

export const downloadTiMaintenanceReport = ({ period_type = "annual", year, month } = {}) => {
 const params = new URLSearchParams();
 if (period_type) params.set("period_type", period_type);
 if (year) params.set("year", String(year));
 if (month) params.set("month", String(month));
 const qs = params.toString();
 return `/api/ti-assets/reports/download${qs ? `?${qs}` : ""}`;
};
