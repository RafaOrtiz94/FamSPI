import api from "./index";

const EQUIPMENT_PURCHASE_ERROR_MESSAGES = {
  REQUEST_NOT_FOUND: "La solicitud ya no está disponible o no tienes acceso.",
  INVALID_TRANSITION: "La solicitud cambió de estado y esta acción ya no aplica.",
  STALE_REQUEST_STATE: "La solicitud cambió en otra sesión. Actualiza e inténtalo nuevamente.",
  CHECKLIST_INCOMPLETE: "Faltan requisitos del checklist para continuar.",
  PROFORMA_REQUEST_LOCKED: "La proforma ya fue solicitada recientemente. Espera el tiempo de bloqueo.",
  AVAILABILITY_EMAIL_NOT_SENT: "Primero debes enviar el correo de disponibilidad al proveedor.",
  PROVIDER_EMAIL_REQUIRED: "Debes ingresar el correo del proveedor.",
  FILE_REQUIRED: "Debes seleccionar un archivo para continuar.",
  INSPECTION_WINDOW_REQUIRED: "Debes definir la ventana de inspección antes de continuar.",
  INSPECTION_DATE_REQUIRED: "Debes seleccionar una fecha de inspección.",
  INSPECTION_DATE_OUT_OF_WINDOW: "La fecha de inspección debe estar dentro de la ventana permitida.",
  FORBIDDEN_ROLE_ACTION: "Tu rol no tiene permisos para ejecutar esta acción.",
};

export const getEquipmentPurchaseApiError = (error, fallback = "No se pudo completar la operación") => {
  const code = error?.response?.data?.code || null;
  const details = error?.response?.data?.details || error?.response?.data?.meta || null;
  const backendMessage = error?.response?.data?.message || null;
  return {
    code,
    details,
    message: EQUIPMENT_PURCHASE_ERROR_MESSAGES[code] || backendMessage || error?.message || fallback,
  };
};


export const getEquipmentPurchaseMeta = async () => {
  const { data } = await api.get("/equipment-purchases/meta");
  return data.data || {};
};

export const listEquipmentPurchases = async () => {
  const { data } = await api.get("/equipment-purchases");
  return data.data || [];
};


export const getEquipmentPurchaseStats = async () => {
  const { data } = await api.get("/equipment-purchases/stats");
  return data.data || {};
};

export const createEquipmentPurchase = async (payload) => {
  const { data } = await api.post("/equipment-purchases", payload);
  return data.data;
};

export const startAvailability = async (id, payload) => {
  const { data } = await api.post(`/equipment-purchases/${id}/start-availability`, payload);
  return data.data;
};

export const saveProviderResponse = async (id, payload) => {
  const { data } = await api.post(`/equipment-purchases/${id}/provider-response`, payload);
  return data.data;
};

export const updatePurchaseChecklist = async (id, payload) => {
  const { data } = await api.patch(`/equipment-purchases/${id}/checklist`, payload);
  return data.data;
};

export const requestProforma = async (id, expected_updated_at) => {
  const { data } = await api.post(`/equipment-purchases/${id}/request-proforma`, {
    expected_updated_at,
  });
  return data.data;
};

export const uploadProforma = async (id, file, { expected_updated_at } = {}) => {
  const formData = new FormData();
  formData.append("file", file);
  if (expected_updated_at) formData.append("expected_updated_at", expected_updated_at);
  const { data } = await api.post(`/equipment-purchases/${id}/upload-proforma`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
};

export const reserveEquipment = async (id, expected_updated_at) => {
  const { data } = await api.post(`/equipment-purchases/${id}/reserve`, {
    expected_updated_at,
  });
  return data.data;
};

export const uploadSignedProforma = async (
  id,
  { file, inspection_min_date, inspection_max_date, includes_starter_kit, expected_updated_at },
) => {
  const formData = new FormData();
  if (file) formData.append("file", file);
  if (inspection_min_date) formData.append("inspection_min_date", inspection_min_date);
  if (inspection_max_date) formData.append("inspection_max_date", inspection_max_date);
  if (includes_starter_kit !== undefined) formData.append("includes_starter_kit", includes_starter_kit);
  if (expected_updated_at) formData.append("expected_updated_at", expected_updated_at);

  const { data } = await api.post(`/equipment-purchases/${id}/upload-signed-proforma`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
};

export const uploadContract = async (id, file, { expected_updated_at } = {}) => {
  const formData = new FormData();
  formData.append("file", file);
  if (expected_updated_at) formData.append("expected_updated_at", expected_updated_at);
  const { data } = await api.post(`/equipment-purchases/${id}/upload-contract`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
};

export const renewReservation = async (id, expected_updated_at) => {
  const { data } = await api.post(`/equipment-purchases/${id}/renew-reservation`, {
    expected_updated_at,
  });
  return data.data;
};

export const cancelOrder = async (id, reason, expected_updated_at) => {
  const { data } = await api.post(`/equipment-purchases/${id}/cancel-order`, {
    reason,
    expected_updated_at,
  });
  return data.data;
};


export const submitSignedProformaWithInspection = async (
  id,
  { file, inspection_min_date, inspection_max_date, includes_starter_kit, expected_updated_at },
) => {
  const formData = new FormData();
  if (file) formData.append("file", file);
  if (inspection_min_date) formData.append("inspection_min_date", inspection_min_date);
  if (inspection_max_date) formData.append("inspection_max_date", inspection_max_date);
  if (includes_starter_kit !== undefined) formData.append("includes_starter_kit", includes_starter_kit);
  if (expected_updated_at) formData.append("expected_updated_at", expected_updated_at);

  const { data } = await api.post(`/equipment-purchases/${id}/submit-signed-proforma-with-inspection`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
};

export const coordinateInspectionDate = async (id, { inspection_date, notes, expected_updated_at }) => {
  const { data } = await api.patch(`/equipment-purchases/${id}/coordinate-inspection-date`, {
    inspection_date,
    notes,
    expected_updated_at,
  });
  return data.data;
};
export const getEquipmentPurchaseById = async (id) => {
  const { data } = await api.get(`/equipment-purchases/${id}`);
  return data.data;
};
