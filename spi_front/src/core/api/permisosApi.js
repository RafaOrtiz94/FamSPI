import api from "./index";

/**
 * API para gestión de permisos y vacaciones
 */

/**
 * Crear solicitud de permiso o vacación
 */
export const createSolicitud = async (data) => {
  const response = await api.post("/permisos", data);
  return response.data;
};

/**
 * Listar mis solicitudes
 */
export const getMisSolicitudes = async () => {
  const response = await api.get("/permisos/mis-solicitudes");
  return response.data;
};

/**
 * Listar solicitudes pendientes (para jefes)
 */
export const getPendientes = async (stage = "pending") => {
  const response = await api.get(`/permisos/pendientes?stage=${stage}`);
  return response.data;
};

/**
 * Aprobar parcialmente
 */
export const aprobarParcial = async (id) => {
  const response = await api.post(`/permisos/${id}/aprobar-parcial`);
  return response.data;
};

/**
 * Subir justificantes
 */
export const subirJustificantes = async (id, files) => {
  const formData = new FormData();
  files.forEach((file, index) => {
    formData.append(`justificante_${index}`, file);
  });

  const response = await api.post(`/permisos/${id}/justificantes`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

/**
 * Aprobar finalmente
 */
export const aprobarFinal = async (id) => {
  const response = await api.post(`/permisos/${id}/aprobar-final`);
  return response.data;
};

/**
 * Rechazar solicitud
 */
export const rechazar = async (id, observaciones) => {
  const response = await api.post(`/permisos/${id}/rechazar`, { observaciones });
  return response.data;
};

/**
 * Obtener resumen de vacaciones (días disponibles)
 */
export const getVacationSummary = async () => {
  const response = await api.get("/vacaciones/summary/data?all=false");
  return response.data;
};

// Aliases para compatibilidad con código existente
export const listarMisPermisos = getMisSolicitudes;
export const listarPendientes = getPendientes;
