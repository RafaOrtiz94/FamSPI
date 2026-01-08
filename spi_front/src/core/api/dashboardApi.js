/**
 * Dashboard API
 * Endpoints para métricas y resúmenes de dashboards por rol
 */

import api from './index';

/**
 * Obtener resumen para dashboard comercial
 * @returns {Promise} Payload interno con métricas y datos (sin wrapper ok/message)
 */
export const getCommercialSummary = async () => {
    const response = await api.get('/dashboard/comercial/summary');
    // Normalizar: retornar solo el payload interno, no el wrapper completo
    return response.data.data;
};

export default {
    getCommercialSummary,
};