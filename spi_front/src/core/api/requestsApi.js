// src/core/api/requestsApi.js
import api from "./index";
import logger from "../utils/logger";

/** Lista paginada de solicitudes */
export const getRequests = async (params = {}) => {
 const { page = 1, pageSize = 12, mine, status, q, type } = params;
 const requestParams = { page, pageSize, mine, status, q, type };
 const startTime = Date.now();

 logger.apiCall("GET", "/requests", { params: requestParams });
 logger.info("Consultando lista de solicitudes", {
 page,
 pageSize,
 filters: { mine, status, q, type }
 });

 let response;

 try {
 response = await api.get("/requests", { params: requestParams });
 logger.performance("Consulta de solicitudes", startTime);
 logger.success("Lista de solicitudes obtenida exitosamente", {
 count: response.data?.count || response.data?.rows?.length || 0,
 page,
 pageSize
 });
 } catch (err) {
 if (err?.response?.status === 403 && mine !== true) {
 logger.warn("Reintentando consulta con mine=true debido a 403", {
 originalParams: requestParams
 });
 response = await api.get("/requests", { params: { ...requestParams, mine: true } });
 logger.success("Lista de solicitudes obtenida en reintento", {
 count: response.data?.count || response.data?.rows?.length || 0
 });
 } else {
 logger.error("Error consultando lista de solicitudes", err, {
 params: requestParams,
 responseStatus: err?.response?.status
 });
 throw err;
 }
 }

 const data = response.data;

 if (data?.result && Array.isArray(data.result.rows)) {
 return {
 rows: data.result.rows,
 count: data.result.count || data.result.rows.length,
 };
 }

 if (Array.isArray(data?.rows)) {
 return {
 rows: data.rows,
 count: data.count || data.rows.length,
 };
 }

 if (data?.data && Array.isArray(data.data.rows)) {
 return {
 rows: data.data.rows,
 count: data.data.total || data.data.count || data.data.rows.length,
 };
 }

 if (Array.isArray(data?.data)) {
 return {
 rows: data.data,
 count: data.data.length,
 };
 }

 if (Array.isArray(data)) {
 return {
 rows: data,
 count: data.length,
 };
 }

 return { rows: [], count: 0 };
};

/** Detalle de solicitud */
export const getRequestById = async (id) => {
 const response = await api.get(`/requests/${id}`);
 if (response.data?.data) return response.data.data;
 if (response.data?.result) return response.data.result;
 return response.data;
};

/** Crear solicitud (multipart/form-data) */
export const createRequest = async ({ request_type_id, payload, files }) => {
 const startTime = Date.now();

 logger.apiCall("POST", "/requests", {
 request_type_id,
 payload_keys: Object.keys(payload || {}),
 files_count: files?.length || 0
 });

 logger.requestFlow("INICIO", "Preparando creacion de solicitud", {
 request_type_id,
 payload_size: JSON.stringify(payload || {}).length,
 files_count: files?.length || 0
 });

 const formData = new FormData();
 formData.append("request_type_id", request_type_id);
 formData.append("payload", JSON.stringify(payload || {}));
 (files || []).forEach((f) => formData.append("files[]", f));

 logger.requestFlow("ENVIO", "Enviando datos al servidor", {
 request_type_id,
 payload_keys: Object.keys(payload || {})
 });

 const response = await api.post("/requests", formData, {
 headers: { "Content-Type": "multipart/form-data" },
 });

 logger.performance("Creacion de solicitud", startTime);
 const resultPayload = response.data?.data || response.data?.result || response.data;
 logger.success("Solicitud creada exitosamente", {
 request_id: resultPayload?.request?.id || resultPayload?.id,
 request_type_id
 });

 return resultPayload;
};

/** Cancelar solicitud */
export const cancelRequest = async (id) => {
 const response = await api.post(`/requests/${id}/cancel`);
 return response.data?.result || response.data;
};

/** Registrar resultado F.ST-07 de una inspección independiente */
export const processCreditRequestDecision = async (id, action, payload = {}) => {
 const response = await api.post(`/requests/${id}/credit-decision`, {
 action,
 payload,
 });
 return response.data?.data || response.data;
};

export const registerInspectionResult = async (id, payload = {}) => {
 const response = await api.post(`/requests/${id}/inspection-result`, payload);
 return response.data;
};

/** Crear solicitud de nuevo cliente */
export const createClientRequest = async (formData = {}, files = {}) => {
 const data = new FormData();

 Object.entries(formData).forEach(([key, value]) => {
 if (value === undefined || value === null) return;
 const normalized = typeof value === "string" ? value.trim() : value;
 if (normalized === "") return;
 data.append(key, normalized);
 });

 Object.entries(files).forEach(([key, file]) => {
 if (!file) return;
 data.append(key, file);
 });

 const response = await api.post("/requests/new-client", data, {
 headers: { "Content-Type": "multipart/form-data" },
 });

 return response.data?.data || response.data;
};

export const sendConsentEmailToken = async ({ consent_recipient_email, client_email, client_name }) => {
 const response = await api.post("/requests/new-client/consent-token", {
 consent_recipient_email,
 client_email,
 client_name,
 });
 return response.data?.data || response.data;
};

export const verifyConsentEmailToken = async ({ token_id, code }) => {
 const response = await api.post("/requests/new-client/consent-token/verify", {
 token_id,
 code,
 });
 return response.data?.data || response.data;
};

/** Lista paginada de solicitudes de nuevos clientes */
export const getClientRequests = async (params = {}) => {
 const { page = 1, pageSize = 25, status, q } = params;
 const response = await api.get("/requests/new-client", {
 params: { page, pageSize, status, q },
 });
 return response.data?.data || response.data;
};

/** Resumen de solicitudes de nuevos clientes */
export const getClientRequestsSummary = async (params = {}) => {
 const response = await api.get("/requests/new-client/summary", {
 params,
 });
 return response.data?.data || response.data;
};

export const getMyClientRequests = async (params = {}) => {
 const { page = 1, pageSize = 25, status, q } = params;
 const response = await api.get("/requests/new-client/my", {
 params: { page, pageSize, status, q },
 });
 return response.data?.data || response.data;
};

/** Detalle de solicitud de nuevo cliente */
export const getClientRequestById = async (id) => {
 const response = await api.get(`/requests/new-client/${id}`);
 return response.data?.data || response.data;
};

/** Procesar (aprobar/rechazar) solicitud de nuevo cliente */
export const processClientRequest = async (id, action, rejection_reason) => {
 const response = await api.put(`/requests/new-client/${id}/process`, {
 action,
 rejection_reason,
 });
 return response.data?.data || response.data;
};

export const updateClientRequestQualityChecklist = async (id, { item_key, status, notes } = {}) => {
 const response = await api.put(`/requests/new-client/${id}/quality-checklist`, {
 item_key,
 status,
 notes,
 });
 return response.data?.data || response.data;
};

/** Actualizar solicitud de nuevo cliente (correccion) */
export const updateClientRequest = async (id, formData = {}, files = {}) => {
 const data = new FormData();

 Object.entries(formData).forEach(([key, value]) => {
 if (value === undefined || value === null) return;
 const normalized = typeof value === "string" ? value.trim() : value;
 if (normalized === "") return;
 data.append(key, normalized);
 });

 Object.entries(files).forEach(([key, file]) => {
 if (!file) return;
 data.append(key, file);
 });

 const response = await api.put(`/requests/new-client/${id}`, data, {
 headers: { "Content-Type": "multipart/form-data" },
 });

 return response.data?.data || response.data;
};
