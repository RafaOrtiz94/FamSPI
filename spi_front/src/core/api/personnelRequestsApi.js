/**
 * Personnel Requests API
 * Cliente API para solicitudes de personal
 */

import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const api = axios.create({
    baseURL: `${API_URL}/api/v1/personnel-requests`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para agregar token JWT
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

/**
 * Crear nueva solicitud de personal
 */
export const createPersonnelRequest = async (data) => {
    const response = await api.post('/', data);
    return response.data;
};

/**
 * Obtener lista de solicitudes con filtros
 */
export const getPersonnelRequests = async (filters = {}) => {
    const response = await api.get('/', { params: filters });
    return response.data;
};

/**
 * Obtener solicitud específica por ID
 */
export const getPersonnelRequestById = async (id) => {
    const response = await api.get(`/${id}`);
    return response.data;
};

/**
 * Actualizar estado de solicitud
 */
export const updatePersonnelRequestStatus = async (id, status, notes = null) => {
    const response = await api.patch(`/${id}/status`, { status, notes });
    return response.data;
};

/**
 * Agregar comentario a solicitud
 */
export const addPersonnelRequestComment = async (id, comment, isInternal = false) => {
    const response = await api.post(`/${id}/comments`, {
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
    const response = await api.get('/stats', { params });
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
