// src/core/api/departmentsApi.js
import api from "./index";

/** Obtener todos los departamentos */
export const getDepartments = async () => {
  const { data } = await api.get("/departments");
  // Garantiza que siempre devuelva un array
  return Array.isArray(data.data) ? data.data : [];
};

/** Crear nuevo departamento */
export const createDepartment = async (payload) => {
  const { data } = await api.post("/departments", payload);
  return data.data;
};

/** Actualizar departamento */
export const updateDepartment = async (id, payload) => {
  const { data } = await api.put(`/departments/${id}`, payload);
  return data.data;
};

/** Eliminar departamento */
export const deleteDepartment = async (id) => {
  const { data } = await api.delete(`/departments/${id}`);
  return data;
};
