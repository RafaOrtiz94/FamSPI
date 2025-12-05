import api from "./index";

/**
 * Obtener lista de equipos de servicio
 */
export const getEquiposServicio = async () => {
    const { data } = await api.get("/servicio/equipos");
    return data || [];
};

/**
 * Obtener disponibilidad de técnicos
 */
export const getDisponibilidadTecnicos = async () => {
    const { data } = await api.get("/servicio/disponibilidad");
    return data.rows || [];
};

/**
 * Actualizar disponibilidad de técnico
 */
export const updateDisponibilidadTecnico = async (payload) => {
    const { data } = await api.post("/servicio/disponibilidad", payload);
    return data.result;
};
