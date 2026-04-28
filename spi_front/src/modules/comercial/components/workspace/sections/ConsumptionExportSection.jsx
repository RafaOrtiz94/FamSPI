import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FiCheckCircle, FiClock, FiDownload, FiExternalLink, FiRefreshCw, FiAlertTriangle, FiArchive, FiChevronDown, FiChevronUp } from "react-icons/fi";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";

const MAX_POLL_ATTEMPTS = 24;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getPollIntervalMs = (attempt) => {
 if (attempt < 8) return 1000;
 if (attempt < 16) return 2000;
 return 3000;
};
const FINAL_URL_CONFIRM_ATTEMPTS = 8;
const FINAL_URL_CONFIRM_INTERVAL_MS = 2500;

const SHEETS_SYNC_LOG_PREFIX = "[BC Sheets Sync]";

const toObject = (value) => (
 value && typeof value === "object" && !Array.isArray(value) ? value : {}
);

const hasValue = (value) => {
 if (value === null || value === undefined) return false;
 if (typeof value === "string") return value.trim().length > 0;
 return true;
};

const pickFirst = (...values) => {
 for (const value of values) {
 if (hasValue(value)) return value;
 }
 return null;
};

const formatDateTime = (value) => {
 if (!value) return "-";
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) return "-";
 return parsed.toLocaleString("es-EC", {
 year: "numeric",
 month: "2-digit",
 day: "2-digit",
 hour: "2-digit",
 minute: "2-digit",
 second: "2-digit",
 hour12: false,
 timeZone: "America/Guayaquil",
 });
};

const toInversionRows = (inversiones = {}) =>
 Object.entries(inversiones || {}).map(([name, data]) => ({
 name,
 cantidad: data?.cantidad ?? 0,
 precio: data?.precio ?? 0,
 }));

const toNumberOrZero = (value) => {
 const parsed = Number(value);
 return Number.isFinite(parsed) ? parsed : 0;
};

const buildLocalFieldsPreview = (businessCase) => {
 const metadata = toObject(businessCase?.modern_bc_metadata);
 const general = toObject(metadata?.general_data);

 const fields = {};
 const setIfPresent = (key, value) => {
 if (!hasValue(value)) return;
 fields[key] = value;
 };

 setIfPresent("TipoDeCliente", pickFirst(general.clientType, metadata.clientType));
 setIfPresent("EntidadContratante", pickFirst(general.contractingEntity, metadata.contractingEntity));
 setIfPresent("Cliente", businessCase?.client_name);
 setIfPresent("CodigoProceso", pickFirst(businessCase?.process_code, businessCase?.processCode, general.processCode));
 setIfPresent("ObjetoContratacion", pickFirst(businessCase?.contract_object, businessCase?.contractObject, general.contractObject));
 setIfPresent("ProvinciaCiudad", pickFirst(general.provinceCity, metadata.provinceCity, businessCase?.provinceCity));
 setIfPresent("PresupuestoReferencial", pickFirst(general.referential_budget, metadata.referential_budget, businessCase?.bc_equipment_cost));
 setIfPresent("CompromisoDeCompra", pickFirst(general.purchase_commitment, metadata.purchase_commitment));
 setIfPresent("Observaciones", pickFirst(general.notes, metadata.notes, businessCase?.notes));

 return fields;
};

const buildLocalInversionesPreview = (catalogItems = []) => {
 const selected = (Array.isArray(catalogItems) ? catalogItems : [])
 .filter((item) => Boolean(item?.selected));
 const out = {};
 selected.forEach((item) => {
 const name = String(item?.name || "").trim();
 if (!name) return;
 out[name] = {
 cantidad: toNumberOrZero(item?.quantity),
 precio: toNumberOrZero(item?.unit_price),
 };
 });
 return out;
};

const buildLocalPreview = ({ businessCase, catalogItems }) => {
 const fields = buildLocalFieldsPreview(businessCase);
 const inversiones = buildLocalInversionesPreview(catalogItems);
 const metadataLast = businessCase?.modern_bc_metadata?.bc_sheet_generation?.last || null;

 return {
 business_case_id: businessCase?.id || null,
 mapping_version: metadataLast?.mapping_version || "FORMATO BC - 15-01-2026",
 fields,
 inversiones,
 summary: {
 fields_count: Object.keys(fields).length,
 inversiones_count: Object.keys(inversiones).length,
 },
 last_generation: metadataLast
 ? {
 job_id: metadataLast.job_id || null,
 request_id: metadataLast.request_id || null,
 mapping_version: metadataLast.mapping_version || null,
 sheet_id: metadataLast.sheet_id || null,
 sheet_url: metadataLast.sheet_url || null,
 generated_at: metadataLast.generated_at || null,
 }
 : null,
 };
};

const resolveLastGeneration = ({ latestJob, previewLast, metadataLast }) => {
 if (latestJob?.status === "completed") {
 return {
 source: "job",
 sheet_url: latestJob.sheet_url || null,
 sheet_id: latestJob.sheet_id || null,
 generated_at: latestJob.updated_at || null,
 status: latestJob.status,
 };
 }

 if (previewLast) {
 return {
 source: "preview",
 sheet_url: previewLast.sheet_url || null,
 sheet_id: previewLast.sheet_id || null,
 generated_at: previewLast.generated_at || null,
 status: "completed",
 };
 }

 if (metadataLast) {
 return {
 source: "metadata",
 sheet_url: metadataLast.sheet_url || null,
 sheet_id: metadataLast.sheet_id || null,
 generated_at: metadataLast.generated_at || null,
 status: "completed",
 };
 }

 return null;
};

const resolveSyncStatus = (latestJob, hasLastSync) => {
 if (latestJob?.status === "processing") return { label: "Sincronizando", tone: "blue" };
 if (latestJob?.status === "pending") return { label: "En cola", tone: "amber" };
 if (latestJob?.status === "failed") return { label: "Error en sincronizacion", tone: "red" };
 if (latestJob?.status === "completed" || hasLastSync) return { label: "Sincronizado", tone: "green" };
 return { label: "Sin sincronizacion", tone: "gray" };
};

const toneClass = {
 gray: "bg-gray-100 text-gray-700",
 blue: "bg-blue-100 text-blue-700",
 amber: "bg-amber-100 text-amber-700",
 red: "bg-rose-100 text-rose-700",
 green: "bg-emerald-100 text-emerald-700",
};

const getSyncStepLabel = (status) => {
 if (status === "pending") return "Sincronizacion en cola...";
 if (status === "processing") return "Procesando datos y generando documento...";
 if (status === "completed") return "Sincronizacion completada";
 if (status === "failed") return "La sincronizacion fallo";
 return "Preparando sincronizacion...";
};

const ConsumptionExportSection = ({ businessCase }) => {
 const { id: bcId } = useParams();
 const { showToast } = useUI();
 const [preview, setPreview] = useState(null);
 const [loadingPreview, setLoadingPreview] = useState(true);
 const [previewError, setPreviewError] = useState(null);
 const [syncing, setSyncing] = useState(false);
 const [syncProgress, setSyncProgress] = useState(0);
 const [syncStepLabel, setSyncStepLabel] = useState("Preparando sincronizacion...");
 const [syncDebugEvents, setSyncDebugEvents] = useState([]);
 const [latestJob, setLatestJob] = useState(null);
 const [showVersionHistory, setShowVersionHistory] = useState(false);
 const [documentVersions, setDocumentVersions] = useState(null);
 const [loadingVersions, setLoadingVersions] = useState(false);

 const loadPreview = useCallback(async () => {
 if (!bcId) {
 setPreview(buildLocalPreview({ businessCase, catalogItems: [] }));
 setLoadingPreview(false);
 return;
 }

 try {
 setLoadingPreview(true);
 setPreviewError(null);
 const previewRes = await api.get(`/business-case/${bcId}/sheets/preview`);
 const serverPreview = previewRes?.data?.data || null;
 if (!serverPreview) {
 throw new Error("La previsualizacion de Sheets no devolvio datos");
 }
 setPreview(serverPreview);
 } catch (error) {
 setPreview(buildLocalPreview({ businessCase, catalogItems: [] }));
 setPreviewError(
 error?.response?.data?.message ||
 error?.message ||
 "No se pudo actualizar la vista previa real de Sheets",
 );
 } finally {
 setLoadingPreview(false);
 }
 }, [bcId, businessCase]);

 useEffect(() => {
 loadPreview();
 }, [loadPreview]);

 const handleToggleVersionHistory = useCallback(async () => {
 const next = !showVersionHistory;
 setShowVersionHistory(next);
 if (next && !documentVersions && bcId) {
 try {
 setLoadingVersions(true);
 const res = await api.get(`/business-cases/${bcId}/sheets/document-versions`, { params: { limit: 20 } });
 setDocumentVersions(res?.data?.data?.versions || []);
 } catch {
 setDocumentVersions([]);
 } finally {
 setLoadingVersions(false);
 }
 }
 }, [showVersionHistory, documentVersions, bcId]);

 const appendSyncDebug = useCallback((level, message, data = null) => {
 const event = {
 id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
 at: new Date().toISOString(),
 level,
 message,
 data,
 };
 setSyncDebugEvents((prev) => [...prev.slice(-24), event]);
 if (!window.__BC_SHEETS_SYNC_LOGS__) window.__BC_SHEETS_SYNC_LOGS__ = [];
 window.__BC_SHEETS_SYNC_LOGS__.push(event);
 if (window.__BC_SHEETS_SYNC_LOGS__.length > 200) {
 window.__BC_SHEETS_SYNC_LOGS__ = window.__BC_SHEETS_SYNC_LOGS__.slice(-200);
 }
 }, []);

  const handleSyncNow = async () => {
 if (!bcId) return;

 try {
 setSyncDebugEvents([]);
 console.info(`${SHEETS_SYNC_LOG_PREFIX} Inicio de sincronizacion`, {
 businessCaseId: bcId,
 timestamp: new Date().toISOString(),
 });
 appendSyncDebug("info", "Inicio de sincronizacion", { businessCaseId: bcId });
 setSyncing(true);
 setSyncProgress(5);
 setSyncStepLabel("Preparando sincronizacion...");

 const enqueueRes = await api.post(`/business-case/${bcId}/sheets/generate`, {});
 const jobId = enqueueRes?.data?.data?.job_id;
 if (!jobId) throw new Error("No se pudo encolar la sincronizacion a Sheets");
 console.info(`${SHEETS_SYNC_LOG_PREFIX} Job encolado`, {
 businessCaseId: bcId,
 jobId,
 enqueueResponse: enqueueRes?.data || null,
 });
 appendSyncDebug("info", "Job encolado", { businessCaseId: bcId, jobId });
 setSyncProgress(12);
 setSyncStepLabel("Trabajo encolado. Esperando procesamiento...");

 let completedJob = null;
 let lastObservedJob = null;
 let lastJobId = jobId;
 for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
 // eslint-disable-next-line no-await-in-loop
 const statusRes = await api.get(`/business-case/${bcId}/sheets/jobs/${jobId}`);
 const job = statusRes?.data?.data || {};
 lastObservedJob = job;
 lastJobId = job?.job_id || jobId;
 setLatestJob(job);
 console.info(`${SHEETS_SYNC_LOG_PREFIX} Poll status`, {
 businessCaseId: bcId,
 jobId,
 attempt: attempt + 1,
 maxAttempts: MAX_POLL_ATTEMPTS,
 status: job?.status || "unknown",
 sheetUrlPresent: Boolean(job?.sheet_url),
 updatedAt: job?.updated_at || null,
 errorMessage: job?.error_message || null,
 });
 appendSyncDebug("info", "Poll status", {
 attempt: attempt + 1,
 status: job?.status || "unknown",
 sheetUrlPresent: Boolean(job?.sheet_url),
 });
 setSyncStepLabel(getSyncStepLabel(job.status));
 setSyncProgress((current) => {
 const basedOnAttempts = Math.min(94, Math.round(((attempt + 1) / MAX_POLL_ATTEMPTS) * 94));
 return Math.max(current, basedOnAttempts);
 });

 if (job.status === "completed") {
 completedJob = job;
 setSyncProgress(96);
 setSyncStepLabel("Finalizando sincronizacion...");
 break;
 }

 if (job.status === "failed") {
 setSyncStepLabel(getSyncStepLabel("failed"));
 throw new Error(job.error_message || "Fallo la sincronizacion a Google Sheets");
 }

 // eslint-disable-next-line no-await-in-loop
 await wait(getPollIntervalMs(attempt));
 }

 let finalSheetUrl = completedJob?.sheet_url || null;
 if (!finalSheetUrl) {
 setSyncStepLabel("Confirmando URL final del documento...");
 for (let confirmAttempt = 0; confirmAttempt < FINAL_URL_CONFIRM_ATTEMPTS; confirmAttempt += 1) {
 // eslint-disable-next-line no-await-in-loop
 const previewRes = await api.get(`/business-case/${bcId}/sheets/preview`);
 const previewData = previewRes?.data?.data || {};
 const previewLast = previewData?.last_generation || null;
 finalSheetUrl = previewLast?.sheet_url || null;

 console.info(`${SHEETS_SYNC_LOG_PREFIX} Fallback preview para URL`, {
 businessCaseId: bcId,
 jobId: completedJob?.job_id || lastJobId || null,
 confirmAttempt: confirmAttempt + 1,
 confirmMaxAttempts: FINAL_URL_CONFIRM_ATTEMPTS,
 finalSheetUrlFromPreview: finalSheetUrl,
 previewLastGeneration: previewLast,
 });
 appendSyncDebug("info", "Fallback preview para URL", {
 attempt: confirmAttempt + 1,
 maxAttempts: FINAL_URL_CONFIRM_ATTEMPTS,
 hasUrl: Boolean(finalSheetUrl),
 previewJobId: previewLast?.job_id || null,
 });

 if (finalSheetUrl) break;
 // eslint-disable-next-line no-await-in-loop
 await wait(FINAL_URL_CONFIRM_INTERVAL_MS);
 }
 }

 if (!finalSheetUrl) {
 if (lastObservedJob) setLatestJob(lastObservedJob);
 setSyncProgress(94);
 console.warn(`${SHEETS_SYNC_LOG_PREFIX} Sin URL final luego del polling`, {
 businessCaseId: bcId,
 lastObservedStatus: lastObservedJob?.status || null,
 lastObservedJob,
 });
 appendSyncDebug("warn", "Sin URL final luego del polling", {
 lastObservedStatus: lastObservedJob?.status || null,
 lastObservedJobId: lastObservedJob?.job_id || lastJobId || null,
 });
 showToast("La sincronizacion aun no devolvio URL de Sheets. Reintenta en unos segundos.", "warning");
 return;
 }

 setSyncProgress(100);
 setSyncStepLabel(getSyncStepLabel("completed"));
 setLatestJob(completedJob);
 window.open(finalSheetUrl, "_blank", "noopener,noreferrer");
 console.info(`${SHEETS_SYNC_LOG_PREFIX} Sincronizacion completada`, {
 businessCaseId: bcId,
 jobId: completedJob?.job_id || null,
 finalSheetUrl,
 completedAt: completedJob?.updated_at || new Date().toISOString(),
 });
 appendSyncDebug("info", "Sincronizacion completada", { finalSheetUrl });

 showToast("Sincronizacion completada en Google Sheets", "success");
 await loadPreview();
 } catch (error) {
 console.error(`${SHEETS_SYNC_LOG_PREFIX} Error en sincronizacion`, {
 businessCaseId: bcId,
 message: error?.response?.data?.message || error?.message || "Error desconocido",
 status: error?.response?.status || null,
 response: error?.response?.data || null,
 stack: error?.stack || null,
 });
 appendSyncDebug("error", "Error en sincronizacion", {
 message: error?.response?.data?.message || error?.message || "Error desconocido",
 status: error?.response?.status || null,
 });
 showToast(
 error?.response?.data?.message || error?.message || "No se pudo sincronizar con Google Sheets",
 "error",
 );
 } finally {
 setSyncing(false);
 setSyncProgress(0);
 setSyncStepLabel("Preparando sincronizacion...");
 }
 };

 const fieldRows = useMemo(() => Object.entries(preview?.fields || {}), [preview?.fields]);
 const inversionRows = useMemo(() => toInversionRows(preview?.inversiones || {}), [preview?.inversiones]);
 const equipmentTabRows = useMemo(() => Array.isArray(preview?.equipment_tabs) ? preview.equipment_tabs : [], [preview?.equipment_tabs]);
 const maxQuantityRows = useMemo(() => Array.isArray(preview?.max_quantities) ? preview.max_quantities : [], [preview?.max_quantities]);
 const metadataLast = businessCase?.modern_bc_metadata?.bc_sheet_generation?.last || null;
 const lastSync = useMemo(
 () =>
 resolveLastGeneration({
 latestJob,
 previewLast: preview?.last_generation,
 metadataLast,
 }),
 [latestJob, preview?.last_generation, metadataLast],
 );
 const syncStatus = useMemo(
 () => resolveSyncStatus(latestJob, Boolean(lastSync)),
 [latestJob, lastSync],
 );

 return (
 <div className="space-y-6">
 <div aria-live="polite" className={`${syncing ? "block" : "hidden"} rounded-xl border border-blue-200 bg-blue-50 px-4 py-3`}>
 <div className="flex flex-col gap-2">
 <div className="flex items-center justify-between gap-3 text-sm font-medium text-blue-800">
 <span className="inline-flex items-center gap-2 min-w-0">
 <FiRefreshCw className="animate-spin flex-shrink-0" size={14} />
 <span className="truncate">{syncStepLabel}</span>
 </span>
 <span className="text-xs font-semibold text-blue-700">{syncProgress}%</span>
 </div>
 <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
 <div
 className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out"
 style={{ width: `${syncProgress}%` }}
 />
 </div>
 </div>
 </div>
 {syncDebugEvents.length > 0 && (
 <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
 <div className="flex items-center justify-between gap-2">
 <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Diagnostico sincronizacion</p>
 <button
 type="button"
 onClick={() => setSyncDebugEvents([])}
 className="text-xs text-slate-600 hover:text-slate-900"
 >
 Limpiar
 </button>
 </div>
 <div className="mt-2 max-h-40 overflow-auto space-y-1">
 {syncDebugEvents.map((event) => (
 <div key={event.id} className="text-xs text-slate-700">
 <span className="font-mono text-slate-500">{formatDateTime(event.at)}</span>{" "}
 <span className="font-semibold uppercase">[{event.level}]</span>{" "}
 <span>{event.message}</span>
 {event.data && (
 <span className="text-slate-500"> {JSON.stringify(event.data)}</span>
 )}
 </div>
 ))}
 </div>
 </div>
 )}
 <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
 <div>
 <h2 className="text-xl font-bold text-gray-900 tracking-tight">Sincronizacion con Google Sheets</h2>
 <p className="text-sm text-gray-500 mt-1">
 Genera el documento oficial en Sheets con la informacion consolidada del Business Case.
 </p>
 <div className="mt-2 inline-flex items-center gap-2">
 <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${toneClass[syncStatus.tone]}`}>
 {syncStatus.label}
 </span>
 {lastSync?.generated_at && (
 <span className="text-xs text-gray-500">Ultima sincronizacion: {formatDateTime(lastSync.generated_at)}</span>
 )}
 </div>
 </div>

 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={loadPreview}
 disabled={loadingPreview || syncing}
 className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
 >
 <FiRefreshCw size={14} />
 Actualizar vista previa
 </button>
 <button
 type="button"
 onClick={handleSyncNow}
 disabled={syncing}
 className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
 >
 <FiDownload size={14} />
 {syncing ? "Sincronizando..." : "Sincronizar ahora"}
 </button>
 </div>
 </div>

 {latestJob?.status === "failed" && (
 <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
 <FiAlertTriangle className="flex-shrink-0 text-amber-600 mt-0.5" size={16} />
 <div className="flex-1">
 <p className="text-sm font-semibold text-amber-800">Google Sheets no disponible</p>
 <p className="text-xs text-amber-700 mt-0.5">
 La sincronizacion falló. Descarga el Excel local como alternativa.
 </p>
 </div>
 <a
 href={`/api/v1/business-case/${businessCase?.id}/sheets/fallback-excel`}
 download
 className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700"
 >
 <FiDownload size={12} />
 Excel local
 </a>
 </div>
 )}

 {lastSync?.sheet_url && (
 <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <div className="flex items-center gap-2 text-emerald-800 text-sm font-medium">
 <FiCheckCircle size={16} />
 Documento en Sheets disponible
 </div>
 <a
 href={lastSync.sheet_url}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
 >
 Abrir documento
 <FiExternalLink size={14} />
 </a>
 </div>
 )}

 {bcId && (
 <div className="border border-gray-100 rounded-xl overflow-hidden">
 <button
 type="button"
 onClick={handleToggleVersionHistory}
 className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm text-gray-600 font-medium transition-colors"
 >
 <span className="flex items-center gap-2">
 <FiArchive size={14} />
 Historial de versiones
 </span>
 {showVersionHistory ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
 </button>
 {showVersionHistory && (
 <div className="px-4 py-3 bg-white">
 {loadingVersions ? (
 <p className="text-xs text-gray-400 py-2">Cargando historial...</p>
 ) : !documentVersions?.length ? (
 <p className="text-xs text-gray-400 py-2">No hay versiones generadas aún.</p>
 ) : (
 <div className="divide-y divide-gray-50">
 {documentVersions.map((v) => (
 <div key={v.id} className="flex items-center justify-between py-2 gap-3">
 <div className="flex items-center gap-2 min-w-0">
 <span className="text-xs font-mono text-gray-400">v{v.version_number}</span>
 <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${v.document_type === 'sheets' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
 {v.document_type === 'sheets' ? 'Sheets' : 'Excel'}
 </span>
 {v.is_current && (
 <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">actual</span>
 )}
 <span className="text-xs text-gray-500 truncate">{formatDateTime(v.generated_at)}</span>
 {v.canonical_state && (
 <span className="text-xs text-gray-400 truncate hidden sm:block">{v.canonical_state}</span>
 )}
 </div>
 {v.document_url ? (
 <a
 href={v.document_url}
 target="_blank"
 rel="noopener noreferrer"
 className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
 >
 <FiExternalLink size={11} />
 Abrir
 </a>
 ) : v.file_name ? (
 <span className="flex-shrink-0 text-xs text-gray-400 truncate max-w-[120px]">{v.file_name}</span>
 ) : null}
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 </div>
 )}

 {previewError && (
 <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-rose-700 text-sm">{previewError}</div>
 )}

 {loadingPreview ? (
 <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
 <div className="flex items-center justify-center gap-2 text-gray-500">
 <FiClock className="animate-pulse" />
 Cargando vista previa...
 </div>
 </div>
 ) : (
 <>
 <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
 <div className="bg-white border border-gray-100 rounded-xl p-4">
 <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Version mapping</p>
 <p className="text-sm font-semibold text-gray-900 mt-1">{preview?.mapping_version || "-"}</p>
 </div>
 <div className="bg-white border border-gray-100 rounded-xl p-4">
 <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Campos</p>
 <p className="text-sm font-semibold text-gray-900 mt-1">{preview?.summary?.fields_count ?? fieldRows.length}</p>
 </div>
 <div className="bg-white border border-gray-100 rounded-xl p-4">
 <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Inversiones</p>
 <p className="text-sm font-semibold text-gray-900 mt-1">{preview?.summary?.inversiones_count ?? inversionRows.length}</p>
 </div>
 <div className="bg-white border border-gray-100 rounded-xl p-4">
 <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Pestanas equipo</p>
 <p className="text-sm font-semibold text-gray-900 mt-1">{preview?.summary?.equipment_tabs_count ?? equipmentTabRows.length}</p>
 </div>
 <div className="bg-white border border-gray-100 rounded-xl p-4">
 <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Cantidades maximas</p>
 <p className="text-sm font-semibold text-gray-900 mt-1">{preview?.summary?.max_quantities_count ?? maxQuantityRows.length}</p>
 </div>
 </div>

 <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
 <h3 className="text-base font-semibold text-gray-900">Vista previa de datos a sincronizar</h3>
 <p className="text-xs text-gray-500">
 Esta vista muestra el payload consolidado que se sincronizara en el Google Sheet oficial del Business Case.
 </p>

 <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
 <div className="border border-gray-100 rounded-xl">
 <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
 <p className="text-sm font-semibold text-gray-800">Campos del formato</p>
 <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">{fieldRows.length}</span>
 </div>
 {fieldRows.length === 0 ? (
 <div className="p-4 text-sm text-gray-500">No hay campos disponibles para previsualizar.</div>
 ) : (
 <div className="max-h-[420px] overflow-auto">
 <table className="w-full text-sm">
 <thead className="bg-gray-50 sticky top-0">
 <tr>
 <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Campo</th>
 <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Valor</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-50">
 {fieldRows.map(([key, value]) => (
 <tr key={key}>
 <td className="px-4 py-2 text-gray-700 font-medium">{key}</td>
 <td className="px-4 py-2 text-gray-600 break-words">{String(value ?? "")}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 <div className="border border-gray-100 rounded-xl">
 <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
 <p className="text-sm font-semibold text-gray-800">Inversiones adicionales</p>
 <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">{inversionRows.length}</span>
 </div>
 {inversionRows.length === 0 ? (
 <div className="p-4 text-sm text-gray-500">No hay inversiones seleccionadas.</div>
 ) : (
 <div className="max-h-[420px] overflow-auto">
 <table className="w-full text-sm">
 <thead className="bg-gray-50 sticky top-0">
 <tr>
 <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Nombre</th>
 <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Cantidad</th>
 <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Precio</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-50">
 {inversionRows.map((item) => (
 <tr key={item.name}>
 <td className="px-4 py-2 text-gray-700">{item.name}</td>
 <td className="px-4 py-2 text-gray-600">{item.cantidad}</td>
 <td className="px-4 py-2 text-gray-600">{item.precio}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </div>

 <div className="border border-gray-100 rounded-xl">
 <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
 <p className="text-sm font-semibold text-gray-800">Pestanas de equipos propuestas</p>
 <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">{equipmentTabRows.length}</span>
 </div>
 {equipmentTabRows.length === 0 ? (
 <div className="p-4 text-sm text-gray-500">No hay equipos propuestos listos para sincronizar.</div>
 ) : (
 <div className="max-h-[260px] overflow-auto">
 <table className="w-full text-sm">
 <thead className="bg-gray-50 sticky top-0">
 <tr>
 <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Pestana</th>
 <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Equipos vinculados</th>
 <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Items</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-50">
 {equipmentTabRows.map((tab) => (
 <tr key={tab.sheet_name}>
 <td className="px-4 py-2 text-gray-700 font-medium">{tab.sheet_name}</td>
 <td className="px-4 py-2 text-gray-600">{Array.isArray(tab.equipment_names) ? tab.equipment_names.join(", ") || "-" : "-"}</td>
 <td className="px-4 py-2 text-gray-600">{Array.isArray(tab.items) ? tab.items.length : 0}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 <div className="border border-gray-100 rounded-xl">
 <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
 <p className="text-sm font-semibold text-gray-800">Cantidades maximas por elemento</p>
 <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">{maxQuantityRows.length}</span>
 </div>
 {maxQuantityRows.length === 0 ? (
 <div className="p-4 text-sm text-gray-500">No hay cantidades maximas consolidadas para sincronizar.</div>
 ) : (
 <div className="max-h-[320px] overflow-auto">
 <table className="w-full text-sm">
 <thead className="bg-gray-50 sticky top-0">
 <tr>
 <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Equipo</th>
 <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Elemento</th>
 <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Cant. anual</th>
 <th className="text-left px-4 py-2 text-xs text-gray-500 font-semibold">Cant. maxima</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-50">
 {maxQuantityRows.map((item) => (
 <tr key={item.item_key}>
 <td className="px-4 py-2 text-gray-700">{item.equipment_name || "-"}</td>
 <td className="px-4 py-2 text-gray-600">{item.item_name || "-"}</td>
 <td className="px-4 py-2 text-gray-600">{item.annual_qty ?? "-"}</td>
 <td className="px-4 py-2 text-gray-600">{item.planned_qty ?? "-"}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </div>
 </>
 )}
 </div>
 );
};

export default ConsumptionExportSection;
