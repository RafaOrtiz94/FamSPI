// ============================================================
// 🧾 Auditoría API — SPI Fam Project
// ------------------------------------------------------------
// Consume los endpoints del módulo Auditoría:
//   GET /api/v1/auditoria
//   GET /api/v1/auditoria/:id
//   GET /api/v1/auditoria/export/csv
// ============================================================

import api from "./index";

/**
 * 🔹 Obtener registros recientes (para dashboards)
 *    → Usado por Gerencia / Comercial para mostrar actividad reciente
 * @param {Object} [params]
 * @param {string} [params.module] - Filtrar por módulo (requests, users, etc.)
 * @param {number} [params.limit=10] - Cantidad máxima de registros
 */
export const getAuditLogs = async ({ module = "", limit = 10 } = {}) => {
  try {
    const { data } = await api.get("/auditoria", {
      params: { module, limit },
    });
    return data?.data || data;
  } catch (err) {
    console.error("❌ Error al obtener logs de auditoría:", err);
    throw new Error("No se pudieron cargar los registros de auditoría");
  }
};

/**
 * 🔹 Obtener lista de registros de auditoría con filtros
 * @param {Object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @param {number} [params.user_id]
 * @param {string} [params.module]
 * @param {string} [params.action]
 * @param {string} [params.date_from]
 * @param {string} [params.date_to]
 */
export const getAuditoria = async (params = {}) => {
  try {
    const { data } = await api.get("/auditoria", { params });
    const normalized = {
      ok: Boolean(data?.ok),
      total: data?.total ?? data?.data?.total ?? 0,
      page: data?.page ?? params.page ?? 1,
      limit: data?.limit ?? params.limit ?? 50,
      results: data?.audits ?? data?.data ?? [],
    };
    return normalized;
  } catch (err) {
    console.error("❌ Error al obtener auditoría:", err);
    throw new Error(err.response?.data?.message || "Error al cargar auditoría");
  }
};

/**
 * 🔹 Obtener detalles de un registro específico
 * @param {number|string} id - ID del registro de auditoría
 */
export const getAuditoriaDetail = async (id) => {
  try {
    const { data } = await api.get(`/auditoria/${id}`);
    return data.audit || data;
  } catch (err) {
    console.error("❌ Error al obtener detalle de auditoría:", err);
    throw new Error(err.response?.data?.message || "Error al cargar detalle");
  }
};

/**
 * 🔹 Exportar registros a CSV (descarga directa)
 * @param {Object} filters - Filtros opcionales (módulo, acción, fechas)
 */
export const exportAuditoriaCSV = async (filters = {}) => {
  try {
    const response = await api.get("/auditoria/export/csv", {
      params: filters,
      responseType: "blob",
    });

    const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit_trail.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    return true;
  } catch (err) {
    console.error("❌ Error exportando CSV de auditoría:", err);
    throw new Error("No se pudo exportar el CSV de auditoría");
  }
};
