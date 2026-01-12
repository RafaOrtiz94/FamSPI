import api from "./index";

/**
 * API calls for Servicio Técnico module
 */

// ======================================================
// 🧴 DESINFECCIÓN DE INSTRUMENTOS
// ======================================================
export const generateDisinfectionPDF = async (disinfectionData) => {
  console.log("🌐 API: Sending disinfection PDF request", {
    endpoint: "/servicio/desinfeccion/pdf",
    hasData: !!disinfectionData,
    dataKeys: Object.keys(disinfectionData || {}),
    signaturePresent: !!disinfectionData?.firma_ing_SC,
    signatureLength: disinfectionData?.firma_ing_SC?.length,
    attachmentsPresent: !!disinfectionData?.adjunto_evidencia,
    attachmentCount: disinfectionData?.adjunto_evidencia?.length || 0
  });

  const response = await api.post("/servicio/desinfeccion/pdf", disinfectionData);

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
export const generateTrainingCoordinationPDF = async (trainingData) => {
  console.log("🎓 API: Sending training coordination PDF request", {
    endpoint: "/servicio/entrenamiento/pdf",
    hasData: !!trainingData,
    dataKeys: Object.keys(trainingData || {}),
    signaturePresent: !!trainingData?.Firma_af_image,
    signatureLength: trainingData?.Firma_af_image?.length,
    ordenNumero: trainingData?.ORDNumero,
    cliente: trainingData?.ORDCliente
  });

  const response = await api.post("/servicio/entrenamiento/pdf", trainingData);

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
export const generateAttendanceListPDF = async (attendanceData) => {
  console.log("📋 API: Sending training attendance list PDF request", {
    endpoint: "/servicio/entrenamiento/asistencia/pdf",
    hasData: !!attendanceData,
    dataKeys: Object.keys(attendanceData || {}),
    signaturePresent: !!attendanceData?.Firma_Especialista,
    signatureLength: attendanceData?.Firma_Especialista?.length,
    ordenNumero: attendanceData?.Num_Orden,
    cliente: attendanceData?.ORDCliente
  });

  const response = await api.post("/servicio/entrenamiento/asistencia/pdf", attendanceData);

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
export const generateEquipmentVerificationPDF = async (verificationData) => {
  console.log("🔧 API: Sending equipment verification PDF request", {
    endpoint: "/servicio/entrenamiento/verificacion/pdf",
    hasData: !!verificationData,
    dataKeys: Object.keys(verificationData || {}),
    signaturePresent: !!verificationData?.firma_af_image,
    signatureLength: verificationData?.firma_af_image?.length,
    fecha: verificationData?.Fecha,
    cliente: verificationData?.Cliente,
    equipo: verificationData?.Equipo,
    serie: verificationData?.Serie
  });

  const response = await api.post("/servicio/entrenamiento/verificacion/pdf", verificationData);

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
