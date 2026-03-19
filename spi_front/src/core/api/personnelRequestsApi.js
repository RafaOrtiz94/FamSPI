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

/**
 * Obtener perfil del personal seleccionado
 */
export const getPersonnelRequestProfile = async (id) => {
 const response = await api.get(`/personnel-requests/${id}/profile`);
 return response.data;
};

/**
 * Crear/actualizar perfil del personal seleccionado
 */
export const updatePersonnelRequestProfile = async (id, payload) => {
 const response = await api.put(`/personnel-requests/${id}/profile`, payload);
 return response.data;
};

/**
 * Subir documento del personal seleccionado
 */
export const uploadPersonnelRequestDocument = async (id, docType, file) => {
 const formData = new FormData();
 formData.append('doc_type', docType);
 formData.append('file', file);
 const response = await api.post(`/personnel-requests/${id}/documents`, formData, {
 headers: { 'Content-Type': 'multipart/form-data' }
 });
 return response.data;
};

/**
 * Contratar postulante y cerrar solicitud
 */
export const hirePersonnelRequest = async (id) => {
 const response = await api.post(`/personnel-requests/${id}/hire`);
 return response.data;
};

export default {
 createPersonnelRequest,
 getPersonnelRequests,
 getPersonnelRequestById,
 updatePersonnelRequestStatus,
 addPersonnelRequestComment,
 getPersonnelRequestStats,
 getPersonnelRequestProfile,
 updatePersonnelRequestProfile,
 uploadPersonnelRequestDocument,
 hirePersonnelRequest,
};
/**
 * Vincular colaborador a solicitud de personal
 */
export const linkPersonnelRequestCollaborator = async (id, collaborator_user_id) => {
 const response = await api.patch(`/personnel-requests/${id}/collaborator`, { collaborator_user_id });
 return response.data;
};

/**
 * Vincular postulante a solicitud de personal
 */
export const linkPersonnelRequestApplicant = async (id, applicant_id) => {
 const response = await api.patch(`/personnel-requests/${id}/applicant`, { applicant_id });
 return response.data;
};

