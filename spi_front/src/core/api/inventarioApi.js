import api from "./index";

/**
 * Obtener lista de equipos con filtros opcionales.
 */
export const getEquipos = async (filters = {}) => {
  const params = new URLSearchParams();

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.length) {
      params.append(key, value);
    }
  });

  const query = params.toString();
  const { data } = await api.get(`/inventario${query ? `?${query}` : ""}`);
  return data.data || data.rows || [];
};

/**
 * Obtener equipos disponibles (o por estado) en formato simplificado.
 */
export const getEquiposDisponibles = async (filters = {}) => {
  const params = {};
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length) {
        params[key] = value;
      }
    });
  }

  const { data } = await api.get("/inventario/equipos-disponibles", {
    params: Object.keys(params).length ? params : undefined,
  });

  return data.data || [];
};

export const captureUnidadSerial = async (id, payload) => {
  const { data } = await api.post(`/inventario/equipos-unidad/${id}/serial`, payload);
  return data.data || data;
};

export const createUnidad = async (payload) => {
  const { data } = await api.post(`/inventario/equipos-unidad`, payload);
  return data.data || data;
};

export const getEquipmentModels = async (filters = {}) => {
  const params = {};
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length) {
        params[key] = value;
      }
    });
  }

  const { data } = await api.get("/equipment-catalog", {
    params: Object.keys(params).length ? params : undefined,
  });
  return data.data || data.rows || [];
};

export const assignUnidad = async (id, payload) => {
  const { data } = await api.post(`/inventario/equipos-unidad/${id}/asignar`, payload);
  return data.data || data;
};

export const cambiarEstadoUnidad = async (id, payload) => {
  const { data } = await api.post(`/inventario/equipos-unidad/${id}/cambiar-estado`, payload);
  return data.data || data;
};
