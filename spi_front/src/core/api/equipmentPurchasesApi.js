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
 INSPECTION_REQUEST_REQUIRED: "No existe solicitud de inspección técnica asociada para continuar.",
 FORBIDDEN_COORDINATION: "Solo el equipo comercial puede coordinar la fecha de inspección.",
 TECHNICAL_SCHEDULE_FULL: "El cronograma técnico está lleno para esa fecha. Selecciona otro día.",
 TECHNICAL_SCHEDULE_CONFLICT: "La fecha seleccionada ya tiene actividades técnicas programadas. Elige otra fecha.",
 DELIVERY_DATES_REQUIRED: "Debes definir fecha de inicio y fin de entrega.",
 DELIVERY_DATES_INVALID_RANGE: "La fecha de fin debe ser igual o posterior a la de inicio.",
 FORBIDDEN_ROLE_ACTION: "Tu rol no tiene permisos para ejecutar esta acción.",
 BUSINESS_CASE_NOT_RESOLVED: "Debes resolver el Business Case antes de registrar el resultado del portal público.",
 INVALID_PORTAL_OUTCOME: "Debes seleccionar un resultado válido del portal público.",
 SITE_INSPECTION_RESULT_REQUIRED: "Debes indicar si el área cumple o no cumple.",
 SITE_INSPECTION_CHECKLIST_INVALID: "Debes completar correctamente el checklist de inspección F.ST-07.",
 SITE_INSPECTION_FOLLOW_UP_REQUIRED: "Si el área no cumple debes registrar una fecha de reinspección.",
 SITE_INSPECTION_NOT_COORDINATED: "Primero se debe coordinar la fecha exacta de inspección (F.ST-20).",
 SITE_INSPECTION_REPORT_FAILED: "No se pudo generar el documento F.ST-07.",
 CLIENT_SIGNATURE_REQUIRED: "Debes registrar el nombre del firmante por parte del cliente.",
 SITE_NOT_READY_FOR_INSTALLATION: "El sitio no está conforme para instalar o entregar el equipo.",
 INSTALLATION_CLOSURE_BLOCKED: "La instalacion no puede cerrarse porque existen prerequisitos pendientes.",
 INSTALLATION_ACTION_REQUIRED: "Debes indicar la accion de workflow de instalacion.",
 INSTALLATION_ACTION_INVALID: "La accion de workflow de instalacion no es valida.",
 DISPATCH_LEAD_TIME_INVALID: "La solicitud de despacho requiere al menos 15 dias de anticipacion.",
 FST14_CHECKLIST_INCOMPLETE: "Completa el checklist de recepcion visual F.ST-14.",
 FST14_RESULT_REQUIRED: "Debes indicar el resultado de la recepcion visual F.ST-14.",
 VERIFICATION_DECISION_REQUIRED: "Debes registrar si aplica o no verificacion tecnica.",
 VERIFICATION_CRITERIA_REQUIRED: "Debes registrar el criterio tecnico usado para F.ST-09.",
 VERIFICATION_NOT_ENABLED: "Primero define en workflow que la verificacion tecnica aplica.",
 CU_PROVIDER_REPAIR_REPORT_REQUIRED: "Debes adjuntar el reporte del proveedor para equipos CU.",
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

export const listEquipmentProviderContacts = async ({ q = "", limit = 50 } = {}) => {
 const { data } = await api.get("/equipment-purchases/provider-contacts", {
 params: { q, limit },
 });
 return data.data || [];
};

export const saveEquipmentProviderContact = async ({ email, display_name } = {}) => {
 const { data } = await api.post("/equipment-purchases/provider-contacts", {
 email,
 display_name,
 });
 return data.data;
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

export const registerPublicPortalOutcome = async (id, payload) => {
 const { data } = await api.patch(`/equipment-purchases/${id}/public-portal-outcome`, payload);
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

export const requestDeliveryDates = async (id, { notes, expected_updated_at } = {}) => {
 const { data } = await api.post(`/equipment-purchases/${id}/request-delivery-dates`, {
 notes,
 expected_updated_at,
 });
 return data.data;
};

export const submitDeliveryDates = async (
 id,
 { delivery_start_at, delivery_end_at, notes, expected_updated_at },
) => {
 const { data } = await api.post(`/equipment-purchases/${id}/submit-delivery-dates`, {
 delivery_start_at,
 delivery_end_at,
 notes,
 expected_updated_at,
 });
 return data.data;
};

export const markEquipmentArrived = async (id, { notes, expected_updated_at } = {}) => {
 const { data } = await api.post(`/equipment-purchases/${id}/mark-equipment-arrived`, {
 notes,
 expected_updated_at,
 });
 return data.data;
};

export const markDispatchReady = async (id, { notes, expected_updated_at } = {}) => {
 const { data } = await api.post(`/equipment-purchases/${id}/mark-dispatch-ready`, {
 notes,
 expected_updated_at,
 });
 return data.data;
};

export const completeDelivery = async (id, { notes, expected_updated_at } = {}) => {
 const { data } = await api.post(`/equipment-purchases/${id}/complete-delivery`, {
 notes,
 expected_updated_at,
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

export const requestPublicPurchaseInspection = async (
 id,
 { inspection_min_date, inspection_max_date, includes_starter_kit, expected_updated_at },
) => {
 const { data } = await api.post(`/equipment-purchases/${id}/request-inspection`, {
 inspection_min_date,
 inspection_max_date,
 includes_starter_kit,
 expected_updated_at,
 });
 return data.data;
};

export const coordinateInspectionDate = async (
 id,
 { inspection_date, notes, assigned_technician_id, expected_updated_at },
) => {
 const { data } = await api.patch(`/equipment-purchases/${id}/coordinate-inspection-date`, {
 inspection_date,
 notes,
 assigned_technician_id,
 expected_updated_at,
 });
 return data.data;
};

export const reviewInspectionDate = async (id, { decision, review_notes, expected_updated_at }) => {
 const { data } = await api.patch(`/equipment-purchases/${id}/review-inspection-date`, {
 decision,
 review_notes,
 expected_updated_at,
 });
 return data.data;
};

export const registerPublicPurchaseSiteInspection = async (
 id,
 {
 result,
 checklist,
 observations,
 recommendations,
 client_signer_name,
 follow_up_date,
 is_reinspection,
 expected_updated_at,
} = {},
) => {
 const { data } = await api.patch(`/equipment-purchases/${id}/site-inspection`, {
 result,
 checklist,
 observations,
 recommendations,
 client_signer_name,
 follow_up_date,
 is_reinspection,
 expected_updated_at,
 });
 return data.data;
};

export const updatePublicPurchaseInstallationWorkflow = async (
 id,
 { action, payload = {}, expected_updated_at } = {},
) => {
 const { data } = await api.patch(`/equipment-purchases/${id}/installation-workflow`, {
 action,
 payload,
 expected_updated_at,
 });
 return data.data;
};
export const getEquipmentPurchaseById = async (id) => {
 const { data } = await api.get(`/equipment-purchases/${id}`);
 return data.data;
};

export const getPublicPurchaseTechnicalSchedule = async ({ from, to }) => {
 const { data } = await api.get("/equipment-purchases/technical-schedule", {
 params: { from, to },
 });
 return data.data || { days: [] };
};
