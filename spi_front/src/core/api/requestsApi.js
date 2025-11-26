// src/core/api/requestsApi.js
import api from "./index";

/** 📋 Lista paginada de solicitudes */
export const getRequests = async (params = {}) => {
  const { page = 1, pageSize = 12, mine, status, q } = params;
  const requestParams = { page, pageSize, mine, status, q };

  let response;

  try {
    response = await api.get("/requests", { params: requestParams });
  } catch (err) {
    if (err?.response?.status === 403 && mine !== true) {
      console.warn("⚠️ /requests 403 recibido, reintentando con mine=true");
      response = await api.get("/requests", { params: { ...requestParams, mine: true } });
    } else {
      throw err;
    }
  }

  console.log("📡 API /requests respondió:", response.data);

  const data = response.data;

  // Handle various response shapes, prioritizing ones with 'count'
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

  // Default fallback
  return { rows: [], count: 0 };
};

/** 📄 Detalle de solicitud */
export const getRequestById = async (id) => {
  const response = await api.get(`/requests/${id}`);
  if (response.data?.data) return response.data.data;
  if (response.data?.result) return response.data.result;
  return response.data;
};

/** 🧾 Crear solicitud (multipart/form-data) */
export const createRequest = async ({ request_type_id, payload, files }) => {
  const formData = new FormData();
  formData.append("request_type_id", request_type_id);
  formData.append("payload", JSON.stringify(payload || {}));
  (files || []).forEach((f) => formData.append("files[]", f));

  const response = await api.post("/requests", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data?.result || response.data;
};

/** ❌ Cancelar solicitud */
export const cancelRequest = async (id) => {
  const response = await api.post(`/requests/${id}/cancel`);
  return response.data?.result || response.data;
};

/** 🆕 Crear solicitud de nuevo cliente */
export const createClientRequest = async (formData = {}, files = {}) => {
  const data = new FormData();

  Object.entries(formData).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalized = typeof value === "string" ? value.trim() : value;
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

/** 📋 Lista paginada de solicitudes de nuevos clientes */
export const getClientRequests = async (params = {}) => {
  const { page = 1, pageSize = 25, status, q } = params;
  const response = await api.get("/requests/new-client", {
    params: { page, pageSize, status, q },
  });
  return response.data?.data || response.data;
};

/** � Mis solicitudes de nuevos clientes */
export const getMyClientRequests = async (params = {}) => {
  const { page = 1, pageSize = 25, status, q } = params;
  const response = await api.get("/requests/new-client/my", {
    params: { page, pageSize, status, q },
  });
  return response.data?.data || response.data;
};

/** �📄 Detalle de solicitud de nuevo cliente */
export const getClientRequestById = async (id) => {
  const response = await api.get(`/requests/new-client/${id}`);
  return response.data?.data || response.data;
};

/** 🔄 Procesar (aprobar/rechazar) solicitud de nuevo cliente */
export const processClientRequest = async (id, action, rejection_reason) => {
  const response = await api.put(`/requests/new-client/${id}/process`, {
    action,
    rejection_reason,
  });
  return response.data?.data || response.data;
};

/** ✏️ Actualizar solicitud de nuevo cliente (corrección) */
export const updateClientRequest = async (id, formData = {}, files = {}) => {
  const data = new FormData();

  Object.entries(formData).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalized = typeof value === "string" ? value.trim() : value;
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
