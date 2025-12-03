import api from "./index";

/**
 * Lista de documentos o solicitudes técnicas disponibles para los técnicos.
 * Usa el cliente centralizado para adjuntar automáticamente el JWT y manejar refresh.
 */
export const getAvailableTechnicalApplications = async () => {
  const { data } = await api.get("/technical-applications/available");

  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.result?.rows)) return data.result.rows;
  if (Array.isArray(data?.data?.rows)) return data.data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;

  return [];
};

