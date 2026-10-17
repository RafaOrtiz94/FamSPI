// src/api/mantenimientosApi.js
import api from "./index";

/**
 * Obtiene todos los mantenimientos
 */
export const getMantenimientos = async (params = {}) => {
 const { data } = await api.get("/mantenimientos", { params });
 if (Array.isArray(data?.rows)) return { rows: data.rows };
 if (Array.isArray(data?.result?.rows)) return { rows: data.result.rows };
 if (Array.isArray(data?.data?.rows)) return { rows: data.data.rows };
 if (Array.isArray(data?.data)) return { rows: data.data };
 if (Array.isArray(data)) return { rows: data };
 return { rows: [] };
};

/**
 * Crea un nuevo mantenimiento
 * @param {FormData} formData - datos y archivos (firma, evidencias)
 */
export const createMantenimiento = async (formData) => {
 const { data } = await api.post("/mantenimientos", formData, {
 headers: { "Content-Type": "multipart/form-data" },
 });
 return data.result || data;
};

/**
 * Aprueba un mantenimiento (solo Gerencia)
 * @param {number|string} id - ID del mantenimiento
 */
export const approveMantenimiento = async (id) => {
 const { data } = await api.post(`/mantenimientos/${id}/approve`);
 return data.result || data;
};

/**
 * Exporta un mantenimiento a PDF (documento en Drive)
 * @param {number|string} id - ID del mantenimiento
 */
export const exportMantenimientoPDF = async (id) => {
 const { data } = await api.post(`/mantenimientos/${id}/export`);
 return data.result || data;
};

// ======================================================
// ST-01-02 Preventivo
// ======================================================
export const listPreventiveAnnualPlans = async (params = {}) => {
 const { data } = await api.get("/mantenimientos/preventive/annual-plans", { params });
 return data?.rows || [];
};

export const getPreventiveAnnualPlanDetail = async (planId) => {
 if (!planId) return null;
 const { data } = await api.get(`/mantenimientos/preventive/annual-plans/${planId}`);
 return data?.plan || null;
};

export const createPreventiveAnnualPlan = async (payload = {}) => {
 const { data } = await api.post("/mantenimientos/preventive/annual-plans", payload);
 return data?.plan || null;
};

export const publishPreventiveAnnualPlan = async (planId) => {
 const { data } = await api.post(`/mantenimientos/preventive/annual-plans/${planId}/publish`);
 return data?.plan || null;
};

export const rebaselinePreventiveAnnualPlan = async (planId, payload = {}) => {
 const { data } = await api.post(`/mantenimientos/preventive/annual-plans/${planId}/rebaseline`, payload);
 return data?.plan || null;
};

export const issueFst16 = async (planId, payload = {}) => {
 const { data } = await api.post(`/mantenimientos/preventive/annual-plans/${planId}/fst16`, payload);
 return data;
};

export const issueFst17 = async (itemId, payload = {}) => {
 const { data } = await api.post(`/mantenimientos/preventive/plan-items/${itemId}/fst17`, payload);
 return data;
};

export const registerPreventiveOffer = async (itemId, payload = {}) => {
 const { data } = await api.post(`/mantenimientos/preventive/plan-items/${itemId}/offer`, payload);
 return data;
};

export const decidePreventiveOffer = async (itemId, payload = {}) => {
 const { data } = await api.post(`/mantenimientos/preventive/plan-items/${itemId}/offer/decision`, payload);
 return data;
};

export const registerReprogrammingNotice = async (itemId, payload = {}) => {
 const { data } = await api.post(`/mantenimientos/preventive/plan-items/${itemId}/reprogramming`, payload);
 return data;
};

export const registerPreventiveCoordination = async (itemId, payload = {}) => {
 const { data } = await api.post(`/mantenimientos/preventive/plan-items/${itemId}/coordination`, payload);
 return data?.plan_item || null;
};

export const registerPreventiveWorkOrder = async (itemId, payload = {}) => {
 const { data } = await api.post(`/mantenimientos/preventive/plan-items/${itemId}/work-order`, payload);
 return data?.plan_item || null;
};

export const requestPreventiveKit = async (itemId, payload = {}) => {
 const { data } = await api.post(`/mantenimientos/preventive/plan-items/${itemId}/kits`, payload);
 return data;
};

export const registerKitWarehouseExit = async (kitId, payload = {}) => {
 const { data } = await api.post(`/mantenimientos/preventive/kits/${kitId}/warehouse-exit`, payload);
 return data;
};

export const closePreventiveExecution = async (itemId, payload = {}) => {
 const { data } = await api.post(`/mantenimientos/preventive/plan-items/${itemId}/close`, payload);
 return data;
};

export const getPreventiveComplianceDashboard = async (params = {}) => {
 const { data } = await api.get("/mantenimientos/preventive/compliance", { params });
 return data;
};

export const getPreventiveCapacityDashboard = async (params = {}) => {
 const { data } = await api.get("/mantenimientos/preventive/capacity", { params });
 return data;
};

export const sendPreventiveMonthlyReport = async (planId, payload = {}) => {
 const { data } = await api.post(`/mantenimientos/preventive/annual-plans/${planId}/monthly-report`, payload);
 return data;
};

export const getPreventiveTimeline = async (params = {}) => {
 const { data } = await api.get("/mantenimientos/preventive/timeline", { params });
 return data?.rows || [];
};

export const getPreventiveHistory = async (params = {}) => {
 const { data } = await api.get("/mantenimientos/preventive/history", { params });
 return data?.rows || [];
};

export const generateTiAnnualSchedule = async (payload = {}) => {
 const { data } = await api.post("/mantenimientos/ti/annual-schedule/generate", payload);
 return data?.data || null;
};
