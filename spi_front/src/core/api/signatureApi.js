import axios from 'axios';

/**
 * API Client para el sistema FamSign
 * ========================================================
 *
 * Este mÃ³dulo proporciona acceso a todas las APIs del sistema de firma digital:
 * - FamSign con sello institucional y QR
 * - VerificaciÃ³n pÃºblica de documentos
 * - AuditorÃ­a y trail de eventos
 * - Dashboard de mÃ©tricas
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

// Interceptor para agregar token de autenticaciÃ³n
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
 * FamSign
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
 * @param {string} signatureData.session_id - ID de sesiÃ³n
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
 * VERIFICACIÃ“N PÃšBLICA
 * ====================
 */

/**
 * Verifica un documento usando su token QR
 * @param {string} token - Token de verificaciÃ³n del QR
 * @returns {Promise<Object>} InformaciÃ³n de verificaciÃ³n
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
 * AUDITORÃA Y REPORTES
 * =====================
 */

/**
 * Obtiene el trail de auditorÃ­a completo de un documento
 * @param {number} documentId - ID del documento
 * @returns {Promise<Object>} Trail de auditorÃ­a
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
 * Obtiene el dashboard de mÃ©tricas de firmas
 * @returns {Promise<Object>} Dashboard de mÃ©tricas
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
 * Obtiene informaciÃ³n detallada de un documento
 * @param {number} documentId - ID del documento
 * @returns {Promise<Object>} InformaciÃ³n del documento
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

