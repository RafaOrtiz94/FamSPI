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
