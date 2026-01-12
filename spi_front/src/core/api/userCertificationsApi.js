/**
 * API: User Certifications
 * ========================
 * Funciones para gestionar certificaciones de usuario
 */

import api from "./index";

/**
 * Obtener mis certificaciones
 * @param {boolean} includeInactive - Incluir certificaciones inactivas
 * @returns {Promise<{ok: boolean, data: Array}>}
 */
export const listMyCertifications = async (includeInactive = false) => {
  const response = await api.get(`/users/me/certifications`, {
    params: { include_inactive: includeInactive }
  });
  return response.data;
};

/**
 * Crear una nueva certificación
 * @param {Object} data - Datos de la certificación
 * @param {File} file - Archivo opcional (PDF, JPG, PNG, WEBP)
 * @returns {Promise<{ok: boolean, data: Object}>}
 */
export const createMyCertification = async (data, file = null) => {
  const formData = new FormData();
  
  // Add text fields (filter out empty strings for optional fields)
  Object.keys(data).forEach(key => {
    const value = data[key];
    // Skip null, undefined, and empty strings for optional fields
    // Only send title (required) and non-empty values
    if (value !== null && value !== undefined && (key === 'title' || value !== '')) {
      formData.append(key, value);
    }
  });
  
  // Add file if provided
  if (file) {
    formData.append('file', file);
  }
  
  const response = await api.post('/users/me/certifications', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

/**
 * Eliminar una certificación (soft delete)
 * @param {number} certId - ID de la certificación
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export const deleteMyCertification = async (certId) => {
  const response = await api.delete(`/users/me/certifications/${certId}`);
  return response.data;
};

/**
 * Obtener certificaciones de otro usuario (solo roles autorizados)
 * @param {number} userId - ID del usuario objetivo
 * @returns {Promise<{ok: boolean, data: Array}>}
 */
export const getUserCertifications = async (userId) => {
  const response = await api.get(`/users/${userId}/certifications`);
  return response.data;
};

/**
 * Crear múltiples certificaciones (bulk upload)
 * @param {Array} metadataArray - Array de objetos con metadata de cada certificación
 * @param {FileList|Array} files - Lista de archivos
 * @returns {Promise<{ok: boolean, message: string, data: Object}>}
 */
export const createBulkCertifications = async (metadataArray, files) => {
  const formData = new FormData();

  // Convertir metadata array a JSON string
  formData.append('metadata', JSON.stringify(metadataArray));

  // Agregar archivos
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  const response = await api.post('/users/me/certifications/bulk', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

/**
 * Descargar PDF unificado de certificaciones de un usuario
 * @param {number} userId - ID del usuario objetivo
 * @returns {Promise<Blob>} - Blob del PDF
 */
export const downloadUserCertificationsPdf = async (userId) => {
  const response = await api.get(`/users/${userId}/certifications/pdf`, {
    responseType: 'blob'
  });
  return response.data;
};

export default {
  listMyCertifications,
  createMyCertification,
  createBulkCertifications,
  deleteMyCertification,
  getUserCertifications,
  downloadUserCertificationsPdf
};
