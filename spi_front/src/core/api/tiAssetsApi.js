import api from "./index";

export const listTiAssets = async (params = {}) => {
 const { data } = await api.get("/ti-assets", { params });
 return data?.data || [];
};

export const listTiCustodySummary = async () => {
 const { data } = await api.get("/ti-assets/custody/summary");
 return data?.data || [];
};

export const listTiAssetClients = async (params = {}) => {
 const { data } = await api.get("/ti-assets/custody/clients", { params });
 return data?.data || [];
};

export const moveTiAssetCustody = async (assetId, payload = {}) => {
 const { data } = await api.post(`/ti-assets/${assetId}/custody`, payload);
 return data?.data || null;
};

export const listTiAssetCustodyHistory = async (assetId) => {
 const { data } = await api.get(`/ti-assets/${assetId}/custody-history`);
 return data?.data || [];
};

export const createTiAsset = async (payload = {}) => {
 const photos = Array.isArray(payload.condition_photos) ? payload.condition_photos : [];
 if (photos.length) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
   if (key === "condition_photos") return;
   if (value === undefined || value === null) return;
   formData.append(key, value);
  });
  photos.forEach((file) => formData.append("condition_photos", file));
  const { data } = await api.post("/ti-assets", formData, {
   headers: { "Content-Type": "multipart/form-data" },
   timeout: 60000,
  });
  return data?.data || null;
 }
 const { data } = await api.post("/ti-assets", payload);
 return data?.data || null;
};

export const updateTiAsset = async (assetId, payload = {}) => {
 const { data } = await api.patch(`/ti-assets/${assetId}`, payload);
 return data?.data || null;
};

export const uploadTiAssetInitialConditionPhotos = async (assetId, photos = []) => {
 const formData = new FormData();
 (Array.isArray(photos) ? photos : []).forEach((file) => formData.append("condition_photos", file));
 const { data } = await api.post(`/ti-assets/${assetId}/condition-photos`, formData, {
  headers: { "Content-Type": "multipart/form-data" },
  timeout: 60000,
 });
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

export const uploadAssignmentEvidence = async (assignmentId, file) => {
  const fd = new FormData();
  fd.append("evidence", file);
  const { data } = await api.post(`/ti-assets/assignments/${assignmentId}/evidence`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.data || null;
};

export const getTiAssignmentEvidenceFile = async (assignmentId) => {
  const response = await api.get(`/ti-assets/assignments/${assignmentId}/evidence/file`, {
    responseType: "blob",
  });
  return {
    blob: response.data,
    contentType: response.headers["content-type"] || "application/octet-stream",
    filename:
      (response.headers["content-disposition"] || "").match(/filename="?([^"]+)"?/)?.[1] ||
      `evidencia-asignacion-${assignmentId}`,
  };
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
 const blob = await getPdfBlob(apiPath);
 const url  = URL.createObjectURL(blob);
 const a    = document.createElement("a");
 a.href     = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
};

const getPdfBlob = async (apiPath) => {
 const response = await api.get(apiPath, { responseType: "arraybuffer" });
 return new Blob([response.data], { type: "application/pdf" });
};

const openPdfPrintDialog = async (apiPath, fallbackFilename) => {
 const printWindow = window.open("", "_blank");
 let blob;
 try {
  blob = await getPdfBlob(apiPath);
 } catch (error) {
  if (printWindow) printWindow.close();
  throw error;
 }
 const url = URL.createObjectURL(blob);
 if (!printWindow) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  return;
 }
 printWindow.opener = null;
 printWindow.addEventListener("load", () => {
  try {
   printWindow.focus();
   printWindow.print();
  } catch (_error) {
   // Browser print policies vary; the opened PDF remains available to print manually.
  }
 }, { once: true });
 printWindow.location.href = url;
 window.setTimeout(() => URL.revokeObjectURL(url), 60000);
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

export const uploadTiLegacyActaSigned = async (assignmentId, file) => {
 const formData = new FormData();
 formData.append("file", file);
 const { data } = await api.post(`/ti-assets/legacy-assignments/${assignmentId}/upload-signed`, formData, {
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

export const downloadTiAssetLabel = async (assetId, assetCode = "") => {
 await triggerBlobDownload(
   `/ti-assets/${assetId}/label`,
   `Etiqueta-${assetCode || String(assetId).padStart(6, "0")}.pdf`,
 );
};

export const printTiAssetLabel = async (assetId, assetCode = "") => {
 await openPdfPrintDialog(
   `/ti-assets/${assetId}/label`,
   `Etiqueta-${assetCode || String(assetId).padStart(6, "0")}.pdf`,
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

export const uploadTiFinancialDoc = async (assetId, docType, file, options = {}) => {
 const normalizedOptions =
   typeof options === "string"
     ? { notes: options }
     : (options || {});
 const notes = normalizedOptions.notes || "";
 const invoiceNumber = normalizedOptions.invoiceNumber || "";
 const formData = new FormData();
 formData.append("file", file);
 formData.append("doc_type", docType);
 if (notes) formData.append("notes", notes);
 if (invoiceNumber) formData.append("invoice_number", invoiceNumber);
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

export const updateTiCorporateNumber = async (id, payload = {}) => {
 const { data } = await api.patch(`/ti-assets/corporate-numbers/${id}`, payload);
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

export const getTiLiberationPhotoFile = async (photoId) => {
 const response = await api.get(`/ti-assets/liberation-photos/${photoId}/file`, {
   responseType: "blob",
 });
 return {
   blob: response.data,
   contentType: response.headers["content-type"] || "image/jpeg",
   filename:
     (response.headers["content-disposition"] || "").match(/filename="?([^"]+)"?/)?.[1] ||
     `liberacion-${photoId}.jpg`,
 };
};
