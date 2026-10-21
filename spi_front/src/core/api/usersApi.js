// src/core/api/usersApi.js
import api from "./index";

/**
 * Obtener todos los usuarios (con nombre de departamento)
 */
export const getUsers = async (params = {}) => {
  const { data } = await api.get("/users", { params });
  return data.data;
};

/** Usuarios elegibles como firmantes (excluye pasivos y en desvinculación) */
export const getSignerCandidates = async (params = {}) => {
  const { data } = await api.get("/users", { params: { ...params, for_signers: true } });
  return data.data;
};

/**
 * Crear usuario manualmente
 */
export const createUser = async (payload) => {
  const { data } = await api.post("/users", payload);
  return data.data;
};

/**
 * Actualizar usuario (rol, departamento, nombre, etc.)
 */
export const updateUser = async (id, payload) => {
  const { data } = await api.put(`/users/${id}`, payload);
  return data.data;
};

/**
 * Desactivar usuario
 */
export const deleteUser = async (id) => {
  const { data } = await api.delete(`/users/${id}`);
  return data;
};

/**
 * Obtener catálogo de roles
 */
export const getUserRoles = async () => {
  const { data } = await api.get("/users/roles");
  return data.data;
};
