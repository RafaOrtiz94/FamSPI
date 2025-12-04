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
export const getEquiposDisponibles = async (estado) => {
  const { data } = await api.get("/inventario/equipos-disponibles", {
    params: estado ? { estado } : undefined,
  });

  return data.data || [];
};
