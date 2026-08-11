import api from "./index";

/**
 * API para gestión de permisos y vacaciones
 */

/**
 * Crear solicitud de permiso o vacación
 */
export const createSolicitud = async (data) => {
 const isMultipart = typeof FormData !== "undefined" && data instanceof FormData;
 const response = await api.post("/permisos", data, isMultipart
  ? {
    headers: { "Content-Type": "multipart/form-data" },
   }
  : undefined);
 return response.data;
};

export const registerStudyEnrollment = async (data) => {
 const formData = new FormData();
 formData.append("institution_name", data.institution_name);
 formData.append("program_name", data.program_name);
 formData.append("valid_from", data.valid_from);
 formData.append("valid_until", data.valid_until);
 if (data.matricula_file) {
 formData.append("matricula", data.matricula_file);
 }
 const response = await api.post("/permisos/estudios/matricula", formData, {
 headers: { "Content-Type": "multipart/form-data" },
 });
 return response.data;
};

export const getActiveStudyEnrollment = async (date = null) => {
 const response = await api.get("/permisos/estudios/matricula/activa", {
 params: date ? { date } : {},
 });
 return response.data;
};

export const getMyStudyEnrollments = async () => {
 const response = await api.get("/permisos/estudios/matriculas");
 return response.data;
};

export const getPendingStudyEnrollments = async () => {
 const response = await api.get("/permisos/estudios/matriculas/pendientes");
 return response.data;
};

export const reviewStudyEnrollment = async (id, decision, reason) => {
 const response = await api.post(`/permisos/estudios/matriculas/${id}/revisar`, { decision, reason });
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
 * Resumen por colaborador (talento humano)
 */
export const getResumenColaboradores = async ({ departmentId = null, year = null } = {}) => {
  const params = {};
  if (departmentId) params.department_id = departmentId;
  if (year) params.year = year;
  const response = await api.get("/permisos/resumen-colaboradores", { params });
  return response.data;
};

export const getReportePeriodo = async ({
  startDate,
  endDate,
  departmentId = null,
  tipoSolicitud = null,
  status = null,
} = {}) => {
  const params = { start_date: startDate, end_date: endDate };
  if (departmentId) params.department_id = departmentId;
  if (tipoSolicitud) params.tipo_solicitud = tipoSolicitud;
  if (status) params.status = status;
  const response = await api.get("/permisos/reporte-periodo", { params });
  return response.data;
};

export const getKpiDashboard = async ({ year = null, departmentId = null } = {}) => {
  const params = {};
  if (year) params.year = year;
  if (departmentId) params.department_id = departmentId;
  const response = await api.get("/permisos/kpis", { params });
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

export const cancelarSolicitud = async (id, reason) => {
 const response = await api.post(`/permisos/${id}/cancelar`, { reason });
 return response.data;
};

export const revisarCancelacionSolicitud = async (id, decision, reason) => {
 const response = await api.post(`/permisos/${id}/cancelar/revisar`, { decision, reason });
 return response.data;
};

export const updateRecoveryPlan = async (id, recovery_plan, action = "propose") => {
 const response = await api.post(`/permisos/${id}/recovery-plan`, { recovery_plan, action });
 return response.data;
};

/**
 * Obtener resumen de vacaciones (días disponibles)
 */
export const getVacationSummary = async () => {
 const response = await api.get("/vacaciones/summary/data?all=false");
 return response.data;
};

/**
 * Resolución de regularización urgente (TH/admin)
 * action: 'rechazar_formalmente' | 'aceptar_excepcion'
 */
export const resolverRegularizacion = async (id, action, reason) => {
  const response = await api.post(`/permisos/${id}/regularizar`, { action, reason });
  return response.data;
};

/**
 * Conversión a vacaciones de ausencia urgente no procedente
 */
export const convertirAVacaciones = async (id) => {
  const response = await api.post(`/permisos/${id}/regularizar/convertir-vacaciones`);
  return response.data;
};

export const revisarJustificante = async (id, decision, observations = null) => {
  const response = await api.post(`/permisos/${id}/justificantes/revisar`, { decision, observations });
  return response.data;
};

// Aliases para compatibilidad con código existente
export const listarMisPermisos = getMisSolicitudes;
export const listarPendientes = getPendientes;
