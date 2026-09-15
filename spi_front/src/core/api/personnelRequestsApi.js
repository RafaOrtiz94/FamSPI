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
 * Obtener workspace agregado de una solicitud
 */
export const getPersonnelRequestWorkspace = async (id, params = {}) => {
 const response = await api.get(`/personnel-requests/${id}/workspace`, { params });
 return response.data;
};

/**
 * Obtener postulantes sugeridos o vinculados a una solicitud
 */
export const getPersonnelRequestApplicants = async (id, params = {}) => {
 const response = await api.get(`/personnel-requests/${id}/applicants`, { params });
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
 * Vincular un postulante a una solicitud de personal
 */
export const linkApplicantToRequest = async (requestId, applicantId) => {
 const response = await api.patch(`/personnel-requests/${requestId}/applicant`, { applicant_id: applicantId });
 return response.data;
};

/**
 * Subir documento del personal seleccionado
 */
export const uploadPersonnelRequestDocument = async (id, docType, file, options = {}) => {
 const formData = new FormData();
 formData.append('doc_type', docType);
 formData.append('file', file);
 const response = await api.post(`/personnel-requests/${id}/documents`, formData, {
 headers: { 'Content-Type': 'multipart/form-data' },
 ...options,
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

const personnelRequestsApi = {
 createPersonnelRequest,
 getPersonnelRequests,
 getPersonnelRequestById,
 getPersonnelRequestWorkspace,
 getPersonnelRequestApplicants,
 updatePersonnelRequestStatus,
 addPersonnelRequestComment,
 getPersonnelRequestStats,
 getPersonnelRequestProfile,
 updatePersonnelRequestProfile,
 uploadPersonnelRequestDocument,
 hirePersonnelRequest,
};

export default personnelRequestsApi;
/**
 * Vincular colaborador a solicitud de personal
 */
export const linkPersonnelRequestCollaborator = async (id, collaborator_user_id) => {
 const response = await api.patch(`/personnel-requests/${id}/collaborator`, { collaborator_user_id });
 return response.data;
};

/**
 * Reasignar solicitante/jefe de area de una solicitud de personal
 */
export const linkPersonnelRequestRequester = async (id, requester_id) => {
 const response = await api.patch(`/personnel-requests/${id}/requester`, { requester_id });
 return response.data;
};

/**
 * Vincular postulante a solicitud de personal
 */
export const linkPersonnelRequestApplicant = async (id, applicant_id) => {
 const response = await api.patch(`/personnel-requests/${id}/applicant`, { applicant_id });
 return response.data;
};

