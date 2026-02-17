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
