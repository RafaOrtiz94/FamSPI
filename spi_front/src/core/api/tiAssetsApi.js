import api from "./index";

export const listTiAssets = async (params = {}) => {
 const { data } = await api.get("/ti-assets", { params });
 return data?.data || [];
};

export const createTiAsset = async (payload = {}) => {
 const { data } = await api.post("/ti-assets", payload);
 return data?.data || null;
};

export const updateTiAsset = async (assetId, payload = {}) => {
 const { data } = await api.patch(`/ti-assets/${assetId}`, payload);
 return data?.data || null;
};

export const assignTiAsset = async (assetId, payload = {}) => {
 const { data } = await api.post(`/ti-assets/${assetId}/assign`, payload);
 return data?.data || null;
};

export const assignMultipleTiAssets = async (payload = {}) => {
 const { data } = await api.post(`/ti-assets/batch/assign`, payload);
 return data?.data || null;
};

export const updateTiAssetStatus = async (assetId, payload = {}) => {
 const { data } = await api.post(`/ti-assets/${assetId}/status`, payload);
 return data?.data || null;
};

export const getTiAssetHistory = async (assetId) => {
 const { data } = await api.get(`/ti-assets/${assetId}/history`);
 return data?.data || [];
};

export const getTiAssetAssignmentsHistory = async (assetId) => {
 const { data } = await api.get(`/ti-assets/${assetId}/assignments-history`);
 return data?.data || [];
};

export const listTiMaintenance = async (params = {}) => {
 const { data } = await api.get("/ti-assets/maintenance/list", { params });
 return data?.data || [];
};

export const clearTiMaintenance = async () => {
 const { data } = await api.delete("/ti-assets/maintenance");
 return data?.data || null;
};

export const createTiMaintenance = async (payload = {}) => {
 const { data } = await api.post("/ti-assets/maintenance", payload);
 return data?.data || null;
};

export const generateTiMaintenanceAnnual = async (payload = {}) => {
 const { data } = await api.post("/ti-assets/maintenance/annual/generate", payload);
 return data?.data || null;
};

export const completeTiMaintenance = async (id, payload = {}) => {
 const { data } = await api.post(`/ti-assets/maintenance/${id}/complete`, payload);
 return data?.data || null;
};

export const requestTiMaintenanceDelivery = async (id) => {
 const { data } = await api.post(`/ti-assets/maintenance/${id}/request-delivery`);
 return data?.data || null;
};

export const setTiMaintenanceCoordinationDate = async (id, payload = {}) => {
 const { data } = await api.patch(`/ti-assets/maintenance/${id}/coordination-date`, payload);
 return data?.data || null;
};

export const generateTiMaintenanceFuture = async () => {
 const { data } = await api.post("/ti-assets/maintenance/generate");
 return data?.data || null;
};

export const refreshTiMaintenanceSchedule = async () => {
 const { data } = await api.post("/ti-assets/maintenance/refresh");
 return data?.data || null;
};

export const generateTiMaintenanceReport = async (payload = {}) => {
 const { data } = await api.post("/ti-assets/reports/generate", payload);
 return data?.data || null;
};

export const listTiMaintenanceReports = async () => {
 const { data } = await api.get("/ti-assets/reports");
 return data?.data || [];
};

// ─── PDF blob downloader (uses axios → includes Authorization header) ─────────

const triggerBlobDownload = async (apiPath, filename) => {
 const response = await api.get(apiPath, { responseType: "arraybuffer" });
 const blob = new Blob([response.data], { type: "application/pdf" });
 const url  = URL.createObjectURL(blob);
 const a    = document.createElement("a");
 a.href     = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
};

export const downloadTiMaintenanceReport = async ({ period_type = "annual", year, month } = {}) => {
 const params = new URLSearchParams();
 if (period_type) params.set("period_type", period_type);
 if (year)        params.set("year", String(year));
 if (month)       params.set("month", String(month));
 const qs = params.toString();
 const periodLabel = period_type === "monthly"
   ? `${year}-${String(month).padStart(2, "0")}`
   : String(year);
 await triggerBlobDownload(
   `/ti-assets/reports/download${qs ? `?${qs}` : ""}`,
   `Cronograma_TI_${period_type}_${periodLabel}.pdf`,
 );
};

// ─── Accessories ──────────────────────────────────────────────────────────────

export const listTiAccessories = async (assetId) => {
 const { data } = await api.get(`/ti-assets/${assetId}/accessories`);
 return data?.data || [];
};

export const createTiAccessory = async (assetId, payload = {}) => {
 const { data } = await api.post(`/ti-assets/${assetId}/accessories`, payload);
 return data?.data || null;
};

export const updateTiAccessory = async (assetId, accId, payload = {}) => {
 const { data } = await api.patch(`/ti-assets/${assetId}/accessories/${accId}`, payload);
 return data?.data || null;
};

export const deleteTiAccessory = async (assetId, accId) => {
 const { data } = await api.delete(`/ti-assets/${assetId}/accessories/${accId}`);
 return data?.data || null;
};

// ─── Actas ────────────────────────────────────────────────────────────────────

export const listTiAllActas = async (params = {}) => {
 const { data } = await api.get("/ti-assets/actas", { params });
 return data?.data || [];
};

export const listTiActas = async (assetId) => {
 const { data } = await api.get(`/ti-assets/${assetId}/actas`);
 return data?.data || [];
};

export const getTiActa = async (actaId) => {
 const { data } = await api.get(`/ti-assets/actas/${actaId}`);
 return data?.data || null;
};

export const updateTiActa = async (actaId, payload = {}) => {
 const { data } = await api.patch(`/ti-assets/actas/${actaId}`, payload);
 return data?.data || null;
};

export const getTiActaSignatureWorkflow = async (actaId) => {
 const { data } = await api.get(`/ti-assets/actas/${actaId}/signature-workflow`);
 return data?.data || null;
};

export const startTiActaSignatureWorkflow = async (actaId, payload = {}) => {
 const { data } = await api.post(`/ti-assets/actas/${actaId}/start-signature-workflow`, payload);
 return data?.data || null;
};

export const getTiActaPdf = async (actaId, tipo = "") => {
 const tipoLabel = String(tipo || "").toLowerCase() === "retiro" ? "RT" : "ET";
 const response = await api.get(`/ti-assets/actas/${actaId}/pdf`, { responseType: "blob" });
 return {
   blob: response.data,
   filename: (response.headers["content-disposition"] || "").match(/filename="?([^"]+)"?/)?.[1]
     || `ACTA-${tipoLabel}-${String(actaId).padStart(6, "0")}.pdf`,
 };
};

export const downloadTiActa = async (actaId, tipo = "") => {
 const tipoLabel = String(tipo || "").toLowerCase() === "retiro" ? "RT" : "ET";
 await triggerBlobDownload(
   `/ti-assets/actas/${actaId}/pdf`,
   `ACTA-${tipoLabel}-${String(actaId).padStart(6, "0")}.pdf`,
 );
};

export const uploadTiActaSigned = async (actaId, file) => {
 const formData = new FormData();
 formData.append("file", file);
 const { data } = await api.post(`/ti-assets/actas/${actaId}/upload-signed`, formData, {
   headers: { "Content-Type": "multipart/form-data" },
 });
 return data?.data || null;
};

export const downloadTiAssetReport = async (assetId) => {
 await triggerBlobDownload(
   `/ti-assets/reports/asset/${assetId}`,
   `Reporte-Activo-${String(assetId).padStart(6, "0")}.pdf`,
 );
};

export const downloadTiCollaboratorReport = async (userId) => {
 await triggerBlobDownload(
   `/ti-assets/reports/collaborator/${userId}`,
   `Reporte-Colaborador-${String(userId).padStart(6, "0")}.pdf`,
 );
};

// ─── Acta recipient pre-fill ──────────────────────────────────────────────────

export const getTiActaRecipientInfo = async (userId) => {
 const { data } = await api.get(`/ti-assets/recipient-info/${userId}`);
 return data?.data || null;
};

// ─── Financial docs ───────────────────────────────────────────────────────────

export const listTiFinancialDocs = async (assetId) => {
 const { data } = await api.get(`/ti-assets/${assetId}/financial-docs`);
 return data?.data || [];
};

export const listTiLetrasDeChangioHistory = async (assetId) => {
 const { data } = await api.get(`/ti-assets/${assetId}/letras-de-cambio-history`);
 return data?.data || [];
};

export const uploadTiFinancialDoc = async (assetId, docType, file, notes = "") => {
 const formData = new FormData();
 formData.append("file", file);
 formData.append("doc_type", docType);
 if (notes) formData.append("notes", notes);
 const { data } = await api.post(`/ti-assets/${assetId}/financial-docs`, formData, {
   headers: { "Content-Type": "multipart/form-data" },
 });
 return data?.data || null;
};

// ─── FASE 2: Corporate Numbers ────────────────────────────────────────────

export const listTiCorporateNumbers = async (params = {}) => {
 const { data } = await api.get("/ti-assets/corporate-numbers", { params });
 return data?.data || [];
};

export const getTiCorporateNumber = async (id) => {
 const { data } = await api.get(`/ti-assets/corporate-numbers/${id}`);
 return data?.data || null;
};

export const createTiCorporateNumber = async (payload = {}) => {
 const { data } = await api.post("/ti-assets/corporate-numbers", payload);
 return data?.data || null;
};

export const assignTiCorporateNumber = async (id, payload = {}) => {
 const { data } = await api.post(`/ti-assets/corporate-numbers/${id}/assign`, payload);
 return data?.data || null;
};

export const changeTiCorporateNumber = async (currentId, payload = {}) => {
 const { data } = await api.post(`/ti-assets/corporate-numbers/${currentId}/change`, payload);
 return data?.data || null;
};

export const getTiCorporateNumberHistory = async (id) => {
 const { data } = await api.get(`/ti-assets/corporate-numbers/${id}/history`);
 return data?.data || [];
};

// ─── FASE 6: Liberation ───────────────────────────────────────────────────

export const liberateTiAsset = async (assetId, photoFiles, notes = "") => {
  const formData = new FormData();
  const files = Array.isArray(photoFiles) ? photoFiles : [photoFiles];
  files.forEach((f) => formData.append("photos", f));
  if (notes) formData.append("notes", notes);
  const { data } = await api.post(`/ti-assets/${assetId}/liberate`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data || null;
};

export const getTiLiberationPhotos = async (assetId) => {
 const { data } = await api.get(`/ti-assets/${assetId}/liberation-photos`);
 return data?.data || [];
};
