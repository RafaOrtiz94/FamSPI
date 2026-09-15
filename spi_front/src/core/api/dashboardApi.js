/**
 * Dashboard API
 * Endpoints para métricas y resúmenes de dashboards por rol
 */

import api from './index';

/**
 * Obtener resumen para dashboard comercial
 * @returns {Promise} Wrapper compatible con useApi (ok + data)
 */
export const getCommercialSummary = async () => {
    const response = await api.get('/dashboard/comercial/summary');
    // Retornar wrapper compatible: useApi espera data.ok para determinar success
    return {
        ok: true,
        data: response.data.data,
        message: response.data.message || "Dashboard summary loaded successfully"
    };
};

const dashboardApi = {
    getCommercialSummary,
};

export default dashboardApi;