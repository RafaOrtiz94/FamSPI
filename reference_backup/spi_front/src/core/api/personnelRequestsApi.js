// API central con manejo de tokens y base /api/v1
import api from './index';

/**
 * Crear nueva solicitud de personal
 */
export const createPersonnelRequest = async (data) => {
    const response = await api.post('/personnel-requests', data);
    return response.data;
};

/**
 * Obtener lista de solicitudes con filtros
 */
export const getPersonnelRequests = async (filters = {}) => {
    const response = await api.get('/personnel-requests', { params: filters });
    return response.data;
};

/**
 * Obtener solicitud específica por ID
 */
export const getPersonnelRequestById = async (id) => {
    const response = await api.get(`/personnel-requests/${id}`);
    return response.data;
};

/**
 * Actualizar estado de solicitud
 */
export const updatePersonnelRequestStatus = async (id, status, notes = null) => {
    const response = await api.patch(`/personnel-requests/${id}/status`, { status, notes });
    return response.data;
};

/**
 * Agregar comentario a solicitud
 */
export const addPersonnelRequestComment = async (id, comment, isInternal = false) => {
    const response = await api.post(`/personnel-requests/${id}/comments`, {
        comment,
        is_internal: isInternal,
    });
    return response.data;
};

/**
 * Obtener estadísticas de solicitudes
 */
export const getPersonnelRequestStats = async (departmentId = null) => {
    const params = departmentId ? { department_id: departmentId } : {};
    const response = await api.get('/personnel-requests/stats', { params });
    return response.data;
};

export default {
    createPersonnelRequest,
    getPersonnelRequests,
    getPersonnelRequestById,
    updatePersonnelRequestStatus,
    addPersonnelRequestComment,
    getPersonnelRequestStats,
};
