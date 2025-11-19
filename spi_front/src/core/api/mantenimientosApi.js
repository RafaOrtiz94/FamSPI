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
