import api from "./index";

/**
 * API calls for Inventario module
 */

// ======================================================
// 📦 INVENTARIO COMPLETO
// ======================================================
export const getInventario = async (params = {}) => {
 const response = await api.get("/inventario", { params });
 return response.data;
};

// ======================================================
// 🏷️ EQUIPOS DISPONIBLES
// ======================================================
export const getEquiposDisponibles = async (params = {}) => {
 const response = await api.get("/inventario/equipos-disponibles", { params });
 return response.data?.data || [];
};

export const getEquiposPorCliente = async (clienteId, params = {}) => {
 const response = await api.get(`/inventario/equipos-cliente/${clienteId}`, { params });
 return response.data;
};

// ======================================================
// 📋 MODELOS DE EQUIPOS
// ======================================================
export const getModelos = async (params = {}) => {
 const response = await api.get("/inventario/modelos", { params });
 return response.data?.data || [];
};
export const updateModelo = async (modeloId, data) => {
 const response = await api.put(`/inventario/modelos/${modeloId}`, data);
 return response.data;
};

// Alias for legacy imports
export const getEquipmentModels = getModelos;

// ======================================================
// ➕ CREAR UNIDAD DESDE MODELO
// ======================================================
export const createUnidad = async (data) => {
 const response = await api.post("/inventario/equipos-unidad", data);
 return response.data;
};

// ======================================================
// 🏷️ CAPTURAR O CONFIRMAR SERIAL DE UNIDAD
// ======================================================
export const captureSerial = async (unidadId, data) => {
 const response = await api.post(`/inventario/equipos-unidad/${unidadId}/serial`, data);
 return response.data;
};

// ======================================================
// 🎯 ASIGNAR UNIDAD A CLIENTE/SUCURSAL
// ======================================================
export const assignUnidad = async (unidadId, data) => {
 const response = await api.post(`/inventario/equipos-unidad/${unidadId}/asignar`, data);
 return response.data;
};

// ======================================================
// 🔄 CAMBIAR ESTADO DE UNIDAD
// ======================================================
export const cambiarEstadoUnidad = async (unidadId, data) => {
 const response = await api.post(`/inventario/equipos-unidad/${unidadId}/cambiar-estado`, data);
 return response.data;
};
export const getUnidadHistorial = async (unidadId) => {
 const response = await api.get(`/inventario/equipos-unidad/${unidadId}/historial`);
 return response.data?.data || [];
};

// ======================================================
// ➕ REGISTRAR MOVIMIENTO (ENTRADA/SALIDA)
// ======================================================
export const registrarMovimiento = async (data) => {
 const response = await api.post("/inventario/movimiento", data);
 return response.data;
};

// ======================================================
// 📦 DETERMINACIONES
// ======================================================
export const getDeterminaciones = async (params = {}) => {
 const response = await api.get("/business-case/determinaciones", { params });
 return response.data;
};

export const createDeterminacion = async (data) => {
 const response = await api.post("/business-case/determinaciones", data);
 return response.data;
};

export const updateDeterminacion = async (id, data) => {
 const response = await api.put(`/business-case/determinaciones/${id}`, data);
 return response.data;
};

export const deleteDeterminacion = async (id) => {
 const response = await api.delete(`/business-case/determinaciones/${id}`);
 return response.data;
};

// ======================================================
// 🧪 CONSUMIBLES
// ======================================================
export const getConsumibles = async (params = {}) => {
 const response = await api.get("/business-case/consumibles", { params });
 return response.data;
};

export const createConsumible = async (data) => {
 const response = await api.post("/business-case/consumibles", data);
 return response.data;
};

export const updateConsumible = async (id, data) => {
 const response = await api.put(`/business-case/consumibles/${id}`, data);
 return response.data;
};

export const deleteConsumible = async (id) => {
 const response = await api.delete(`/business-case/consumibles/${id}`);
 return response.data;
};

// ======================================================
// 📊 CONTROLES
// ======================================================
export const getControles = async (params = {}) => {
 const response = await api.get("/business-case/controles", { params });
 return response.data;
};

export const createControl = async (data) => {
 const response = await api.post("/business-case/controles", data);
 return response.data;
};

export const updateControl = async (id, data) => {
 const response = await api.put(`/business-case/controles/${id}`, data);
 return response.data;
};

export const deleteControl = async (id) => {
 const response = await api.delete(`/business-case/controles/${id}`);
 return response.data;
};

// ======================================================
// 🧫 REACTIVOS
// ======================================================
export const getReactivos = async (params = {}) => {
 const response = await api.get("/business-case/reactivos", { params });
 return response.data;
};

export const createReactivo = async (data) => {
 const response = await api.post("/business-case/reactivos", data);
 return response.data;
};

export const updateReactivo = async (id, data) => {
 const response = await api.put(`/business-case/reactivos/${id}`, data);
 return response.data;
};

export const deleteReactivo = async (id) => {
 const response = await api.delete(`/business-case/reactivos/${id}`);
 return response.data;
};

// ======================================================
// 🔧 PIEZAS DE MANTENIMIENTO
// ======================================================
export const getPiezasMantenimiento = async (params = {}) => {
 const response = await api.get("/business-case/piezas-mantenimiento", { params });
 return response.data;
};

export const createPiezaMantenimiento = async (data) => {
 const response = await api.post("/business-case/piezas-mantenimiento", data);
 return response.data;
};

export const updatePiezaMantenimiento = async (id, data) => {
 const response = await api.put(`/business-case/piezas-mantenimiento/${id}`, data);
 return response.data;
};

export const deletePiezaMantenimiento = async (id) => {
 const response = await api.delete(`/business-case/piezas-mantenimiento/${id}`);
 return response.data;
};
