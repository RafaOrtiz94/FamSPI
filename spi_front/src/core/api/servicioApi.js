import api from "./index";

/**
 * API calls for Servicio Técnico module
 */

const withWorkflowContext = (payload = {}, workflowContext = null) => {
 if (!workflowContext || typeof workflowContext !== "object") return payload;
 const nextPayload = { ...payload };
 const sourceType = workflowContext.source_type || workflowContext.sourceType || null;
 const sourceId = workflowContext.source_id || workflowContext.sourceId || null;
 const requestId = workflowContext.request_id || workflowContext.requestId || null;
 if (sourceType && !nextPayload.source_type) nextPayload.source_type = sourceType;
 if (sourceId && !nextPayload.source_id) nextPayload.source_id = String(sourceId);
 if (requestId && !nextPayload.request_id) nextPayload.request_id = requestId;
 return nextPayload;
};

// ======================================================
// 🧴 DESINFECCIÓN DE INSTRUMENTOS
// ======================================================
export const generateDisinfectionPDF = async (disinfectionData, workflowContext = null) => {
 const payload = withWorkflowContext(disinfectionData, workflowContext);
 console.log("🌐 API: Sending disinfection PDF request", {
 endpoint: "/servicio/desinfeccion/pdf",
 hasData: !!payload,
 dataKeys: Object.keys(payload || {}),
 signaturePresent: !!payload?.firma_ing_SC,
 signatureLength: payload?.firma_ing_SC?.length,
 attachmentsPresent: !!payload?.adjunto_evidencia,
 attachmentCount: payload?.adjunto_evidencia?.length || 0
 });

 const response = await api.post("/servicio/desinfeccion/pdf", payload);

 console.log("🌐 API: Received disinfection PDF response", {
 status: response.status,
 hasData: !!response.data,
 ok: response.data?.ok,
 message: response.data?.message,
 imageCount: response.data?.imageCount,
 hasFolderId: !!response.data?.driveFolderId,
 hasPdfId: !!response.data?.pdfId
 });

 return response.data;
};

/**
 * Obtener lista de equipos de servicio técnico
 */
export const getEquiposServicio = async () => {
 const { data } = await api.get("/servicio/equipos");
 if (Array.isArray(data?.rows)) return data.rows;
 if (Array.isArray(data?.data?.rows)) return data.data.rows;
 if (Array.isArray(data?.data)) return data.data;
 if (Array.isArray(data)) return data;
 return [];
};

// ======================================================
// 🏫 COORDINACIÓN DE ENTRENAMIENTO
// ======================================================
export const generateTrainingCoordinationPDF = async (trainingData, workflowContext = null) => {
 const payload = withWorkflowContext(trainingData, workflowContext);
 console.log("🎓 API: Sending training coordination PDF request", {
 endpoint: "/servicio/entrenamiento/pdf",
 hasData: !!payload,
 dataKeys: Object.keys(payload || {}),
 signaturePresent: !!payload?.Firma_af_image,
 signatureLength: payload?.Firma_af_image?.length,
 ordenNumero: payload?.ORDNumero,
 cliente: payload?.ORDCliente
 });

 const response = await api.post("/servicio/entrenamiento/pdf", payload);

 console.log("🎓 API: Received training coordination PDF response", {
 status: response.status,
 hasData: !!response.data,
 ok: response.data?.ok,
 message: response.data?.message,
 hasFolderId: !!response.data?.driveFolderId,
 hasPdfId: !!response.data?.pdfId,
 ordenNumero: response.data?.ordenNumero,
 cliente: response.data?.cliente
 });

 return response.data;
};

// ======================================================
// 📝 LISTA DE ASISTENCIA DE ENTRENAMIENTO
// ======================================================
export const generateAttendanceListPDF = async (attendanceData, workflowContext = null) => {
 const payload = withWorkflowContext(attendanceData, workflowContext);
 console.log("📋 API: Sending training attendance list PDF request", {
 endpoint: "/servicio/entrenamiento/asistencia/pdf",
 hasData: !!payload,
 dataKeys: Object.keys(payload || {}),
 signaturePresent: !!payload?.Firma_Especialista,
 signatureLength: payload?.Firma_Especialista?.length,
 ordenNumero: payload?.Num_Orden,
 cliente: payload?.ORDCliente
 });

 const response = await api.post("/servicio/entrenamiento/asistencia/pdf", payload);

 console.log("📋 API: Received training attendance list PDF response", {
 status: response.status,
 hasData: !!response.data,
 ok: response.data?.ok,
 message: response.data?.message,
 hasFolderId: !!response.data?.driveFolderId,
 hasPdfId: !!response.data?.pdfId,
 ordenNumero: response.data?.ordenNumero,
 cliente: response.data?.cliente
 });

 return response.data;
};

export const getTrainingWorkflow = async ({ source_type, source_id } = {}) => {
 if (!source_type || !source_id) return null;
 const { data } = await api.get("/servicio/entrenamiento/workflow", {
 params: { source_type, source_id },
 });
 return data?.workflow || null;
};

export const updateTrainingWorkflowAction = async (payload = {}, workflowContext = null) => {
 const requestPayload = withWorkflowContext(payload, workflowContext);
 const { data } = await api.post("/servicio/entrenamiento/workflow", requestPayload);
 return data?.workflow || null;
};

export const generateTrainingEvaluationPDF = async (evaluationData, workflowContext = null) => {
 const payload = withWorkflowContext(evaluationData, workflowContext);
 const { data } = await api.post("/servicio/entrenamiento/evaluacion/pdf", payload);
 return data;
};

export const generateTrainingSpecialistEvaluationPDF = async (evaluationData, workflowContext = null) => {
 const payload = withWorkflowContext(evaluationData, workflowContext);
 const { data } = await api.post("/servicio/entrenamiento/evaluacion-especialista/pdf", payload);
 return data;
};

export const generateTrainingConformityPDF = async (conformityData, workflowContext = null) => {
 const payload = withWorkflowContext(conformityData, workflowContext);
 const { data } = await api.post("/servicio/entrenamiento/conformidad/pdf", payload);
 return data;
};

export const issueTrainingCertificate = async (payload = {}, workflowContext = null) => {
 const requestPayload = withWorkflowContext(payload, workflowContext);
 const { data } = await api.post("/servicio/entrenamiento/certificado/emitir", requestPayload);
 return data;
};

export const deliverTrainingCertificate = async (payload = {}, workflowContext = null) => {
 const requestPayload = withWorkflowContext(payload, workflowContext);
 const { data } = await api.post("/servicio/entrenamiento/certificado/entregar", requestPayload);
 return data;
};

// ======================================================
// 🔧 VERIFICACIÓN DE EQUIPOS NUEVOS
// ======================================================
export const generateEquipmentVerificationPDF = async (verificationData, workflowContext = null) => {
 const payload = withWorkflowContext(verificationData, workflowContext);
 console.log("🔧 API: Sending equipment verification PDF request", {
 endpoint: "/servicio/entrenamiento/verificacion/pdf",
 hasData: !!payload,
 dataKeys: Object.keys(payload || {}),
 signaturePresent: !!payload?.firma_af_image,
 signatureLength: payload?.firma_af_image?.length,
 fecha: payload?.Fecha,
 cliente: payload?.Cliente,
 equipo: payload?.Equipo,
 serie: payload?.Serie
 });

 const response = await api.post("/servicio/entrenamiento/verificacion/pdf", payload);

 console.log("🔧 API: Received equipment verification PDF response", {
 status: response.status,
 hasData: !!response.data,
 ok: response.data?.ok,
 message: response.data?.message,
 hasFolderId: !!response.data?.driveFolderId,
 hasPdfId: !!response.data?.pdfId,
 fecha: response.data?.fecha,
 cliente: response.data?.cliente,
 equipo: response.data?.equipo,
 serie: response.data?.serie
 });

 return response.data;
};

export const listWithdrawalWorkflowStatuses = async ({
 source_type,
 status = null,
 q = "",
 limit = 100,
} = {}) => {
 const { data } = await api.get("/servicio/withdrawal/workflow/list", {
 params: {
 source_type,
 status,
 q,
 limit,
 },
 });
 return data?.rows || [];
};

export const getWithdrawalWorkflow = async ({
 source_type,
 source_id,
 request_id,
} = {}) => {
 const params = {
 source_type: source_type || undefined,
 source_id: source_id || undefined,
 request_id: request_id || undefined,
 };
 const { data } = await api.get("/servicio/withdrawal/workflow", { params });
 return data?.workflow || null;
};

export const updateWithdrawalWorkflowAction = async (payload = {}, workflowContext = null) => {
 const requestPayload = withWorkflowContext(payload, workflowContext);
 const { data } = await api.post("/servicio/withdrawal/workflow", requestPayload);
 return data?.workflow || null;
};

export const generateWithdrawalActPDF = async (payload = {}, workflowContext = null) => {
 const requestPayload = withWorkflowContext(payload, workflowContext);
 const { data } = await api.post("/servicio/withdrawal/fst11/pdf", requestPayload);
 return data;
};

export const listWorkflowDocuments = async ({ source_type, source_id } = {}) => {
 const { data } = await api.get("/servicio/workflow-documents", {
 params: { source_type, source_id },
 });
 return data?.rows || [];
};

export const listWorkflowDocumentsSummary = async ({ source_type, source_ids = [] } = {}) => {
 const normalizedIds = Array.from(
 new Set((Array.isArray(source_ids) ? source_ids : []).map((value) => String(value || "").trim()).filter(Boolean)),
 );
 if (!source_type || normalizedIds.length === 0) return [];
 const { data } = await api.get("/servicio/workflow-documents/summary", {
 params: {
 source_type,
 source_ids: normalizedIds.join(","),
 },
 });
 return data?.rows || [];
};

export const getWorkflowReportingSummary = async () => {
 const { data } = await api.get("/servicio/workflow/reporting-summary");
 return data?.data || { metrics: {}, warnings: [] };
};

export const getWorkflowCatalog = async ({ with_compatibility = true, include_inactive = false } = {}) => {
 const { data } = await api.get("/servicio/workflow/catalog", {
 params: { with_compatibility, include_inactive },
 });
 return data?.rows || [];
};

export const getWorkflowStateMachines = async () => {
 const { data } = await api.get("/servicio/workflow/state-machines");
 return data?.rows || [];
};

export const getWorkflowRegistry = async ({ source_type, source_id, procedure_code = "ST-01-01" } = {}) => {
 if (!source_type || !source_id) return null;
 const { data } = await api.get("/servicio/workflow/registry", {
 params: { source_type, source_id, procedure_code },
 });
 return data?.workflow || null;
};

export const upsertWorkflowRegistry = async (payload = {}) => {
 const { data } = await api.post("/servicio/workflow/registry", payload);
 return data?.row || null;
};

export const getWorkflowTimeline = async ({
 source_type,
 source_id,
 procedure_code = "ST-01-01",
 limit = 100,
} = {}) => {
 if (!source_type || !source_id) return [];
 const { data } = await api.get("/servicio/workflow/timeline", {
 params: { source_type, source_id, procedure_code, limit },
 });
 return data?.rows || [];
};

// ======================================================
// ST-01-03 Correctivos CEAC / Dispatcher
// ======================================================
export const createCorrectiveCase = async (payload = {}) => {
 const { data } = await api.post("/servicio/corrective-cases", payload);
 return data?.case || null;
};

export const listCorrectiveCasesWorkspace = async (params = {}) => {
 const { data } = await api.get("/servicio/corrective-cases/workspace/list", { params });
 return data?.rows || [];
};

export const getCorrectiveCasesWorkspaceKpi = async (params = {}) => {
 const { data } = await api.get("/servicio/corrective-cases/workspace/kpi", { params });
 return data?.data || {};
};

export const getCorrectiveCaseDetail = async (caseId) => {
 if (!caseId) return null;
 const { data } = await api.get(`/servicio/corrective-cases/${caseId}`);
 return data?.case || null;
};

export const getCorrectiveCaseTimeline = async (caseId) => {
 if (!caseId) return [];
 const { data } = await api.get(`/servicio/corrective-cases/${caseId}/timeline`);
 return data?.rows || [];
};

export const listCorrectiveCaseEvents = async (caseId) => {
 if (!caseId) return [];
 const { data } = await api.get(`/servicio/corrective-cases/${caseId}/events`);
 return data?.rows || [];
};

export const listCorrectiveCaseComments = async (caseId) => {
 if (!caseId) return [];
 const { data } = await api.get(`/servicio/corrective-cases/${caseId}/comments`);
 return data?.rows || [];
};

export const addCorrectiveCaseComment = async (caseId, payload = {}) => {
 if (!caseId) return null;
 const { data } = await api.post(`/servicio/corrective-cases/${caseId}/comments`, payload);
 return data?.comment || null;
};

export const listCorrectiveCaseEvidences = async (caseId) => {
 if (!caseId) return [];
 const { data } = await api.get(`/servicio/corrective-cases/${caseId}/evidences`);
 return data?.rows || [];
};

export const runCorrectiveCaseAction = async (caseId, payload = {}) => {
 if (!caseId) return null;
 const { data } = await api.post(`/servicio/corrective-cases/${caseId}/actions`, payload);
 return data?.case || null;
};

export const getServicioCronogramaFeed = async ({ from, to, scope = "team" } = {}) => {
 const { data } = await api.get("/servicio/cronograma/feed", { params: { from, to, scope } });
 return data;
};

export const getServicioActionQueue = async ({ scope = "team" } = {}) => {
 const { data } = await api.get("/servicio/action-queue", { params: { scope } });
 return data;
};
