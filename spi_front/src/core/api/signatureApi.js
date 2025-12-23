import axios from 'axios';

/**
 * API Client para el Sistema de Firma Electrónica Avanzada
 * ========================================================
 *
 * Este módulo proporciona acceso a todas las APIs del sistema de firma digital:
 * - Firma avanzada con sello institucional y QR
 * - Verificación pública de documentos
 * - Auditoría y trail de eventos
 * - Dashboard de métricas
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/**
 * Cliente axios configurado para las APIs de firma
 */
const signatureApi = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación
signatureApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * FIRMA AVANZADA
 * ===============
 */

/**
 * Firma un documento con sello institucional y QR
 * @param {number} documentId - ID del documento a firmar
 * @param {Object} signatureData - Datos de la firma
 * @param {string} signatureData.document_base64 - Documento en base64
 * @param {boolean} signatureData.consent - Consentimiento expreso
 * @param {string} signatureData.consent_text - Texto del consentimiento
 * @param {string} signatureData.role_at_sign - Rol del firmante
 * @param {string} signatureData.authorized_role - Rol autorizado para sello
 * @param {string} signatureData.session_id - ID de sesión
 * @returns {Promise<Object>} Resultado de la firma
 */
export const signDocument = async (documentId, signatureData) => {
  try {
    const response = await signatureApi.post(
      `/signature/documents/${documentId}/sign`,
      signatureData
    );
    return response.data;
  } catch (error) {
    console.error('Error firmando documento:', error);
    throw error.response?.data || error;
  }
};

/**
 * VERIFICACIÓN PÚBLICA
 * ====================
 */

/**
 * Verifica un documento usando su token QR
 * @param {string} token - Token de verificación del QR
 * @returns {Promise<Object>} Información de verificación
 */
export const verifyDocument = async (token) => {
  try {
    const response = await signatureApi.get(`/signature/verificar/${token}`);
    return response.data;
  } catch (error) {
    console.error('Error verificando documento:', error);
    throw error.response?.data || error;
  }
};

/**
 * AUDITORÍA Y REPORTES
 * =====================
 */

/**
 * Obtiene el trail de auditoría completo de un documento
 * @param {number} documentId - ID del documento
 * @returns {Promise<Object>} Trail de auditoría
 */
export const getDocumentAuditTrail = async (documentId) => {
  try {
    const response = await signatureApi.get(
      `/signature/documents/${documentId}/audit-trail`
    );
    return response.data;
  } catch (error) {
    console.error('Error obteniendo audit trail:', error);
    throw error.response?.data || error;
  }
};

/**
 * Obtiene el dashboard de métricas de firmas
 * @returns {Promise<Object>} Dashboard de métricas
 */
export const getSignatureDashboard = async () => {
  try {
    const response = await signatureApi.get('/signature/dashboard');
    return response.data;
  } catch (error) {
    console.error('Error obteniendo dashboard:', error);
    throw error.response?.data || error;
  }
};

/**
 * DOCUMENTOS
 * ===========
 */

/**
 * Obtiene lista de documentos disponibles para firma
 * @param {Object} filters - Filtros opcionales
 * @returns {Promise<Array>} Lista de documentos
 */
export const getDocumentsForSigning = async (filters = {}) => {
  try {
    const response = await signatureApi.get('/documents', { params: filters });
    return response.data;
  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    throw error.response?.data || error;
  }
};

/**
 * Obtiene información detallada de un documento
 * @param {number} documentId - ID del documento
 * @returns {Promise<Object>} Información del documento
 */
export const getDocumentDetails = async (documentId) => {
  try {
    const response = await signatureApi.get(`/documents/${documentId}`);
    return response.data;
  } catch (error) {
    console.error('Error obteniendo detalles del documento:', error);
    throw error.response?.data || error;
  }
};

/**
 * UTILIDADES
 * ===========
 */

/**
 * Convierte archivo a base64
 * @param {File} file - Archivo a convertir
 * @returns {Promise<string>} Archivo en base64
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remover el prefijo "data:application/pdf;base64,"
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Descarga un documento firmado
 * @param {number} documentId - ID del documento
 * @param {string} filename - Nombre del archivo
 */
export const downloadSignedDocument = async (documentId, filename = 'documento_firmado.pdf') => {
  try {
    const response = await signatureApi.get(`/documents/${documentId}/download`, {
      responseType: 'blob'
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error descargando documento:', error);
    throw error.response?.data || error;
  }
};

/**
 * CONSTANTES Y UTILIDADES
 * =======================
 */

export const SIGNATURE_STATUS = {
  PENDING: 'PENDING',
  SIGNED: 'SIGNED',
  LOCKED: 'LOCKED',
  VERIFIED: 'VERIFIED',
  CORRUPTED: 'CORRUPTED'
};

export const CHAIN_STATUS = {
  NO_LOGS: 'NO_LOGS',
  VERIFIED: 'VERIFIED',
  CORRUPTED: 'CORRUPTED',
  UNKNOWN: 'UNKNOWN'
};

export const SIGNATURE_TYPES = {
  ADVANCED: 'ADVANCED',
  QUALIFIED: 'QUALIFIED'
};

export const AUTH_METHODS = {
  OAUTH_CORPORATE: 'OAUTH_CORPORATE',
  CERTIFICATE: 'CERTIFICATE',
  BIOMETRIC: 'BIOMETRIC'
};

const signatureApiExports = {
  signDocument,
  verifyDocument,
  getDocumentAuditTrail,
  getSignatureDashboard,
  getDocumentsForSigning,
  getDocumentDetails,
  fileToBase64,
  downloadSignedDocument,
  SIGNATURE_STATUS,
  CHAIN_STATUS,
  SIGNATURE_TYPES,
  AUTH_METHODS
};

export default signatureApiExports;
