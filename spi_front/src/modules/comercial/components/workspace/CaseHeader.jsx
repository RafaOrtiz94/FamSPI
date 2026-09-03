import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiFileText, FiCheckCircle, FiClock, FiAlertTriangle, FiUnlock, FiXCircle, FiSlash, FiExternalLink, FiChevronDown, FiChevronUp } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import api from "../../../../core/api";
import { useUI } from "../../../../core/ui/UIContext";
import { useAuth } from "../../../../core/auth/AuthContext";
import { useBusinessCaseWorkspaceOptional } from "./BusinessCaseWorkspaceContext";

const getNaturalErrorMessage = (err, fallback) => {
 const raw = String(err?.response?.data?.message || "").trim();
 return raw || fallback;
};

const resolvePurchaseOrigin = (guidance = {}) => {
 const businessCase = guidance?.businessCase || {};
 const metadata = guidance?.modern_bc_metadata || businessCase?.modern_bc_metadata || {};
 const candidates = [
  guidance?.bc_purchase_type,
  businessCase?.bc_purchase_type,
  guidance?.purchase_type,
  businessCase?.purchase_type,
  metadata?.purchase_type,
  metadata?.source_module,
  metadata?.sourceModule,
  metadata?.origin,
  metadata?.workflow_origin,
  metadata?.flow_origin,
 ]
  .map((value) => String(value || "").trim().toLowerCase())
  .filter(Boolean);

 const hasPublicSignal = candidates.some(
  (value) =>
   value.includes("public") ||
   value.includes("publico") ||
   value.includes("equipment_purchases") ||
   value.includes("public_purchase"),
 );
 if (hasPublicSignal) return "publica";

 const hasPrivateSignal = candidates.some(
  (value) =>
   value.includes("private") ||
   value.includes("privado") ||
   value.includes("privada") ||
   value.includes("private_purchases") ||
   value.includes("private_purchase"),
 );
 if (hasPrivateSignal) return "privada";

 return "no_definida";
};

const resolveInitiator = (guidance = {}) => {
 const bc = guidance?.businessCase || {};
 const name =
 guidance?.created_by_name ||
 guidance?.createdByName ||
 bc?.created_by_name ||
 bc?.createdByName ||
 guidance?.modern_bc_metadata?.created_by_name ||
 guidance?.modern_bc_metadata?.createdByName ||
 null;
 const email =
 guidance?.created_by_email ||
 guidance?.createdByEmail ||
 bc?.created_by_email ||
 bc?.createdByEmail ||
 guidance?.modern_bc_metadata?.created_by_email ||
 guidance?.modern_bc_metadata?.createdByEmail ||
 null;
 const id = guidance?.created_by || guidance?.createdBy || bc?.created_by || bc?.createdBy || null;
 return name || email || (id ? `Usuario ${id}` : "No disponible");
};

const roleToLabel = (role) => {
 const normalized = String(role || "").toLowerCase();
 if (normalized === "acp_comercial") return "Analista de Compras Publicas";
 if (normalized === "backoffice_comercial") return "Backoffice Comercial";
 if (normalized === "jefe_servicio") return "Jefe de Servicio";
 if (normalized === "jefe_comercial") return "Jefe Comercial";
 if (normalized === "comercial") return "Comercial";
 return normalized || "N/D";
};

const formatDuration = (seconds) => {
 const safe = Number(seconds);
 if (!Number.isFinite(safe) || safe < 0) return null;
 const hours = Math.floor(safe / 3600);
 const minutes = Math.floor((safe % 3600) / 60);
 return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
};

const formatDateTime = (value) => {
 if (!value) return "No disponible";
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) return "No disponible";
 return parsed.toLocaleString("es-EC", {
 year: "numeric",
 month: "2-digit",
 day: "2-digit",
 hour: "2-digit",
 minute: "2-digit",
 hour12: false,
 });
};

const CaseHeader = ({ uiGuidance, onRefresh, onOpenReopenRequest, onOpenReopenDecision }) => {
 const workspace = useBusinessCaseWorkspaceOptional();
 const { showToast } = useUI();
 const { user } = useAuth();
 const resolvedGuidance = uiGuidance || workspace?.uiGuidance || null;
 const resolvedRefresh = onRefresh || workspace?.onRefresh;
 const { businessCaseId, clientName, workflowState, sectionOwnership } = resolvedGuidance || {};
 const { currentState } = workflowState || {};
 const { completionSummary } = sectionOwnership || {};
 const preflow = resolvedGuidance?.preflow || null;
 const postStatisticsSla = preflow?.postStatisticsSla || null;
 const hasActivePostStatisticsSla = Boolean(
  postStatisticsSla?.startedAt && !postStatisticsSla?.completedAt,
 );
 const slaStatus = resolvedGuidance?.slaStatus || null;
 const feasibility = resolvedGuidance?.workspaceData?.feasibility || null;
 const feasibilityDecision = feasibility?.decision || null;
 const [nowMs, setNowMs] = useState(Date.now());
 const [showStageDetail, setShowStageDetail] = useState(false);

 // Hoja de Sheets: elemento universal del BC (no solo de Determinaciones) --
 // se muestra en el header para que cualquier seccion pueda abrir/actualizar/
 // sincronizar la hoja oficial sin depender de estar parado en Determinaciones.
 const [sheetUrl, setSheetUrl] = useState(null);
 const [sheetSyncing, setSheetSyncing] = useState(false);
 const [pullingFromSheet, setPullingFromSheet] = useState(false);

 const loadExistingSheetUrl = useCallback(async () => {
  if (!businessCaseId) return;
  try {
   const res = await api.get(`/business-case/${businessCaseId}/sheets/preview`);
   const url = res?.data?.data?.last_generation?.sheet_url;
   if (url) setSheetUrl(url);
  } catch (_err) {
   // sin Sheet generada todavia -- no es un error para el header
  }
 }, [businessCaseId]);

 useEffect(() => {
  loadExistingSheetUrl();
 }, [loadExistingSheetUrl]);

 const triggerAutoSheetSync = useCallback(async (caseId, options = {}) => {
  if (!caseId) return;
  setSheetSyncing(true);
  try {
   const res = await api.post(`/business-case/${caseId}/sheets/generate`, {
    force_recreate: Boolean(options.forceRecreate),
   });
   const jobId = res?.data?.data?.job_id;
   if (!jobId) return;
   let attempts = 0;
   const poll = async () => {
    if (attempts >= 24) return;
    attempts += 1;
    await new Promise((r) => setTimeout(r, attempts < 8 ? 1000 : attempts < 16 ? 2000 : 3000));
    const statusRes = await api.get(`/business-case/${caseId}/sheets/jobs/${jobId}`);
    const job = statusRes?.data?.data || statusRes?.data;
    if (job?.status === "completed" && job?.sheet_url) {
     setSheetUrl(job.sheet_url);
     return;
    }
    if (job?.status === "failed") return;
    await poll();
   };
   await poll();
  } catch (err) {
   console.warn("[CaseHeader] auto-sheet-sync error", err?.message);
  } finally {
   setSheetSyncing(false);
  }
 }, []);

 const handleSyncFromSheet = useCallback(async () => {
  if (!businessCaseId) return;
  setPullingFromSheet(true);
  try {
   const res = await api.post(`/business-case/${businessCaseId}/consumption-items/sync-from-sheet`);
   const updated = res?.data?.data?.updated ?? 0;
   const created = res?.data?.data?.created ?? 0;
   if (updated > 0 || created > 0) {
    showToast(`Se sincronizaron ${created} nuevo(s) y ${updated} cantidad(es) desde el Sheet.`, "success");
    resolvedRefresh?.();
   } else {
    showToast("No hay cambios en el Sheet para sincronizar.", "info");
   }
  } catch (err) {
   showToast(getNaturalErrorMessage(err, "No se pudo sincronizar desde el Sheet"), "error");
  } finally {
   setPullingFromSheet(false);
  }
 }, [businessCaseId, resolvedRefresh, showToast]);

 const stateDisplay = {
 'DRAFT_INICIAL':               { label: 'Borrador Inicial',      color: 'bg-gray-100 text-gray-700',      icon: FiClock },
 'DATOS_BASE_COMPLETOS':        { label: 'Datos Completos',        color: 'bg-blue-100 text-blue-700',      icon: FiCheckCircle },
 'EN_EVALUACION_VIABILIDAD':    { label: 'En Evaluación',          color: 'bg-yellow-100 text-yellow-700',  icon: FiAlertTriangle },
 'OBSERVADO_POR_VIABILIDAD':    { label: 'Observado',              color: 'bg-orange-100 text-orange-700',  icon: FiAlertTriangle },
 'VIABLE':                      { label: 'Viable',                 color: 'bg-green-100 text-green-700',    icon: FiCheckCircle },
 'AJUSTES_OPERATIVOS':          { label: 'Ajustes Operativos',     color: 'bg-indigo-100 text-indigo-700',  icon: FiClock },
 'CERRADO_PARA_APROBACION':     { label: 'Para Aprobación',        color: 'bg-purple-100 text-purple-700',  icon: FiFileText },
 'RECHAZADO_POR_GERENCIA':      { label: 'Rechazado',              color: 'bg-red-100 text-red-700',        icon: FiXCircle },
 'CANCELADO':                   { label: 'Cancelado',              color: 'bg-slate-100 text-slate-500',    icon: FiSlash },
 };

 const currentStateDisplay = stateDisplay[currentState] || stateDisplay['DRAFT_INICIAL'];
 const serverNowOffsetMs = useMemo(() => {
 if (!preflow?.serverNow) return 0;
 const serverMs = new Date(preflow.serverNow).getTime();
 if (!Number.isFinite(serverMs)) return 0;
 return serverMs - Date.now();
 }, [preflow?.serverNow]);

 const deadlineMs = useMemo(() => {
  const deadline = hasActivePostStatisticsSla
   ? postStatisticsSla?.deadlineAt
   : preflow?.deadlineAt;
  return deadline ? new Date(deadline).getTime() : null;
 }, [hasActivePostStatisticsSla, postStatisticsSla?.deadlineAt, preflow?.deadlineAt]);

 useEffect(() => {
 if (!deadlineMs || preflow?.isExpired) return undefined;
 const id = setInterval(() => setNowMs(Date.now()), 1000);
 return () => clearInterval(id);
 }, [deadlineMs, preflow?.isExpired]);

 const countdownLabelDetailed = useMemo(() => {
 if (!deadlineMs) return null;
 const effectiveNow = nowMs + serverNowOffsetMs;
 const diff = Math.max(0, deadlineMs - effectiveNow);
 const totalSeconds = Math.floor(diff / 1000);
 const hours = Math.floor(totalSeconds / 3600);
 const minutes = Math.floor((totalSeconds % 3600) / 60);
 const seconds = totalSeconds % 60;
 return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
 }, [deadlineMs, nowMs, serverNowOffsetMs]);

 const countdownUrgency = useMemo(() => {
 if (!deadlineMs) return "normal";
 const effectiveNow = nowMs + serverNowOffsetMs;
 const diffMs = Math.max(0, deadlineMs - effectiveNow);
 const diffHours = diffMs / (1000 * 60 * 60);
 if (diffHours <= 6) return "critical";
 if (diffHours <= 24) return "warning";
 return "normal";
 }, [deadlineMs, nowMs, serverNowOffsetMs]);

 const preflowProgressPercent = useMemo(() => {
 const required = preflow?.requiredSections?.length || 0;
 const completed = preflow?.completedRequiredSections?.length || 0;
 if (!required) return 0;
 return Math.min(100, Math.round((completed / required) * 100));
 }, [preflow?.completedRequiredSections?.length, preflow?.requiredSections?.length]);
 const postStatisticsProgressPercent = useMemo(() => {
  const total = Number(completionSummary?.totalSections || 0);
  const completed = Number(completionSummary?.completedSections || 0);
  if (total <= 0) return preflowProgressPercent;
  return Math.min(100, Math.round((completed / total) * 100));
 }, [completionSummary?.completedSections, completionSummary?.totalSections, preflowProgressPercent]);
 const preflowCompletedSet = useMemo(
 () => new Set(preflow?.completedRequiredSections || []),
 [preflow?.completedRequiredSections],
 );
 const preflowSlaStatus = useMemo(() => {
 if (!preflow?.isActive || postStatisticsSla?.completedAt) return null;
 const effectiveNow = nowMs + serverNowOffsetMs;
 const windowExpired = Boolean(deadlineMs && effectiveNow >= deadlineMs);
 if (windowExpired || preflow?.isExpired || postStatisticsSla?.status === "overdue") {
 return {
  label: hasActivePostStatisticsSla ? "SLA general 48h vencido" : "SLA 48h vencido",
  badge: "bg-rose-100 text-rose-800 border-rose-200",
 };
 }
 if (countdownUrgency === "critical") {
 return {
  label: hasActivePostStatisticsSla ? "SLA general 48h por vencer" : "SLA 48h por vencer",
  badge: "bg-amber-100 text-amber-800 border-amber-200",
 };
 }
 return {
  label: hasActivePostStatisticsSla ? "SLA general 48h en tiempo" : "SLA 48h en tiempo",
  badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
 };
 }, [
  countdownUrgency,
  deadlineMs,
  hasActivePostStatisticsSla,
  nowMs,
  postStatisticsSla?.completedAt,
  postStatisticsSla?.status,
  preflow?.isActive,
  preflow?.isExpired,
  serverNowOffsetMs,
 ]);

 const purchaseOrigin = useMemo(
 () => resolvePurchaseOrigin(resolvedGuidance || {}),
 [resolvedGuidance],
 );
 const purchaseOriginBadge = purchaseOrigin === "publica"
 ? "bg-emerald-100 text-emerald-800"
 : purchaseOrigin === "privada"
 ? "bg-indigo-100 text-indigo-800"
 : "bg-slate-100 text-slate-700";
 const purchaseOriginLabel = purchaseOrigin === "publica"
 ? "Compra publica"
 : purchaseOrigin === "privada"
 ? "Compra privada"
 : "Origen no definido";
 const initiatorLabel = useMemo(() => resolveInitiator(resolvedGuidance), [resolvedGuidance]);
 const preflowActiveRoleLabel = useMemo(
 () => (hasActivePostStatisticsSla ? "Todos los participantes" : roleToLabel(preflow?.activeRole)),
 [hasActivePostStatisticsSla, preflow?.activeRole],
 );
 const commercialElapsedLabel = useMemo(
 () => formatDuration(preflow?.commercial?.elapsedSeconds),
 [preflow?.commercial?.elapsedSeconds],
 );
 const stageWindows = Array.isArray(preflow?.stageWindows) ? preflow.stageWindows : [];
 const extensionRequest = preflow?.extensionRequest || null;
 const canRequestPreflowReopen = Boolean(resolvedGuidance?.permissions?.canRequestPreflowReopen);
 const canResolvePreflowReopen = Boolean(
  resolvedGuidance?.permissions?.canResolvePreflowReopen &&
  extensionRequest?.status === "pending",
 );
 const activeWindowLabel = hasActivePostStatisticsSla
  ? "SLA general post-validacion"
  : preflow?.phaseLabel || "Etapa activa";
 const technicalSlaExpired = Boolean(
  preflow?.isActive &&
  String(preflow?.activePhase || "").toLowerCase() === "review" &&
  String(preflow?.activeRole || "").toLowerCase() === "jefe_servicio" &&
  preflow?.isExpired,
 );
 const canUpdateSheet = String(user?.role || user?.scope || user?.role_name || "").trim().toLowerCase() === "jefe_ti";

 return (
 <Card className="p-4 sm:p-6 space-y-4">
 {/* Identidad del caso + accion global */}
 <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
 <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-3">
 <div className="min-w-0">
 <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{clientName}</h2>
 <p className="text-xs sm:text-sm text-gray-600 break-all">ID: {businessCaseId}</p>
 </div>
 <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${currentStateDisplay.color}`}>
 <currentStateDisplay.icon size={14} />
 {currentStateDisplay.label}
 </div>
 <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${purchaseOriginBadge}`}>
 {purchaseOriginLabel}
 </div>
 </div>
 <button
 type="button"
 onClick={resolvedRefresh}
 className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto flex-shrink-0"
 >
 <FiRefreshCw size={16} />
 Actualizar
 </button>
 </div>

 {/* Sheet oficial del BC — elemento universal */}
 {(sheetUrl || sheetSyncing) && (
 <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
 {sheetSyncing ? (
 <>
 <FiRefreshCw size={14} className="text-emerald-600 animate-spin flex-shrink-0" />
 <span className="text-xs text-emerald-800 font-medium">Generando hoja de cálculo en Google Sheets...</span>
 </>
 ) : (
 <>
 <FiExternalLink size={14} className="text-emerald-600 flex-shrink-0" />
 <span className="text-xs text-emerald-800 font-medium">Hoja de Sheets disponible</span>
 <div className="ml-auto flex flex-wrap items-center gap-2">
 {technicalSlaExpired && (
 <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700">
 Aviso: SLA vencido
 </span>
 )}
 {canUpdateSheet && (
 <>
 <button
 type="button"
 onClick={() => triggerAutoSheetSync(businessCaseId, { forceRecreate: true })}
 disabled={sheetSyncing}
 className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 cursor-pointer transition-transform duration-150 hover:bg-emerald-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
 >
 <FiRefreshCw size={12} />
 Actualizar hoja
 </button>
 <button
 type="button"
 onClick={handleSyncFromSheet}
 disabled={pullingFromSheet || sheetSyncing}
 title="Trae las cantidades que el usuario haya llenado directamente en la columna Cantidad Anual del Sheet"
 className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 cursor-pointer transition-transform duration-150 hover:bg-emerald-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
 >
 <FiRefreshCw size={12} className={pullingFromSheet ? "animate-spin" : ""} />
 Sincronizar cantidades desde Sheet
 </button>
 </>
 )}
 <a
 href={sheetUrl}
 target="_blank"
 rel="noreferrer"
 className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
 >
 <FiExternalLink size={12} />
 Abrir en Sheets
 </a>
 </div>
 </>
 )}
 </div>
 )}

 {/* Progreso general del Business Case — izquierda: metricas de avance,
     derecha: contexto (quien/cuando/SLA), separadas por un divisor vertical
     para que no se lean como una sola lista continua. */}
 <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
 <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 text-xs sm:text-sm text-gray-700">
 <div className="flex flex-wrap items-center gap-x-5 gap-y-2 flex-1 min-w-0">
 <span className="inline-flex items-center gap-1.5">
 <FiCheckCircle className="text-green-600" size={14} />
 {completionSummary?.completedSections ?? 0}/{completionSummary?.totalSections ?? 0} completadas
 </span>
 <span className="inline-flex items-center gap-1.5">
 <FiClock className="text-yellow-600" size={14} />
 {completionSummary?.inProgressSections ?? 0} en progreso
 </span>
 <span className="inline-flex items-center gap-1.5">
 <FiAlertTriangle className="text-gray-500" size={14} />
 {completionSummary?.pendingSections ?? 0} pendientes
 </span>
 </div>

 <div className="hidden sm:block w-px self-stretch bg-gray-200 mx-5" aria-hidden="true" />

 <div className="flex flex-wrap items-center gap-x-5 gap-y-2 flex-1 min-w-0 sm:justify-end">
 <span className="inline-flex items-center gap-1.5 text-gray-500">
 <FiFileText size={14} />
 Iniciado por: {initiatorLabel}
 </span>
 {feasibilityDecision?.decided_at && (
 <span className="inline-flex items-center gap-1.5">
 <FiCheckCircle className={feasibilityDecision?.is_feasible ? "text-emerald-600" : "text-rose-600"} size={14} />
 BC cerrado como {feasibilityDecision?.is_feasible ? "factible" : "no factible"}
 </span>
 )}
 {slaStatus?.hasSla && (
 <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-semibold ${
   slaStatus.status === 'overdue'
     ? 'border-red-200 bg-red-50 text-red-700'
     : slaStatus.status === 'at_risk'
     ? 'border-amber-200 bg-amber-50 text-amber-700'
     : 'border-emerald-200 bg-emerald-50 text-emerald-700'
 }`}>
 <FiClock size={12} />
 SLA{slaStatus.status === 'overdue'
   ? ` vencido (${slaStatus.elapsedDays}d/${slaStatus.slaDays}d)`
   : slaStatus.status === 'at_risk'
   ? ` en riesgo — ${slaStatus.remainingDays}d restantes`
   : ` en tiempo — ${slaStatus.remainingDays}d restantes`}
 </span>
 )}
 </div>
 </div>
 </div>

 {/* Ventana de revision activa (preflow 48h) — todo lo relacionado a esta
     ventana agrupado en un solo bloque, en vez de disperso por el header */}
 {preflow?.isActive && (!postStatisticsSla?.completedAt || !postStatisticsSla?.startedAt) && (
 <div
 className={`rounded-2xl border p-4 space-y-3 ${
 preflow?.isExpired || countdownUrgency === "critical"
 ? "border-rose-300 bg-rose-50"
 : countdownUrgency === "warning"
 ? "border-amber-300 bg-amber-50"
 : "border-indigo-300 bg-indigo-50"
 }`}
 >
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div>
 <p className={`text-xs font-semibold uppercase tracking-wide ${preflow?.isExpired ? "text-rose-700" : "text-indigo-700"}`}>
 {activeWindowLabel} · {preflowActiveRoleLabel}
 </p>
 <p className="mt-1 font-mono text-lg font-bold text-slate-900">
 {(preflow?.isExpired || (hasActivePostStatisticsSla && deadlineMs && nowMs + serverNowOffsetMs >= deadlineMs))
  ? "00:00:00"
  : countdownLabelDetailed || "00:00:00"}
 </p>
 </div>
 {preflowSlaStatus && (
 <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${preflowSlaStatus.badge}`}>
 <FiAlertTriangle size={12} />
 {preflowSlaStatus.label}
 </span>
 )}
 </div>

 <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 text-xs text-indigo-900">
 <div className="flex items-center gap-2 flex-1 min-w-0">
 <span className="flex-shrink-0">{hasActivePostStatisticsSla ? "Avance del proceso:" : "Avance comercial:"}</span>
 <div className="h-2 w-24 rounded-full bg-indigo-100">
 <div
 className="h-2 rounded-full bg-indigo-600 transition-all"
 style={{ width: `${hasActivePostStatisticsSla ? postStatisticsProgressPercent : preflowProgressPercent}%` }}
 />
 </div>
 <span className="flex-shrink-0">{hasActivePostStatisticsSla ? postStatisticsProgressPercent : preflowProgressPercent}%</span>
 </div>
 {commercialElapsedLabel && (
 <>
 <div className="hidden sm:block w-px self-stretch bg-black/10 mx-3" aria-hidden="true" />
 <span className="text-slate-600 flex-shrink-0">
  {hasActivePostStatisticsSla ? "Tiempo hasta validacion registrado" : "Tiempo comercial registrado"}: {commercialElapsedLabel}
 </span>
 </>
 )}
 </div>

 {Array.isArray(preflow?.requiredSections) && preflow.requiredSections.length > 0 && (
 <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-black/5">
 <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">SLA por seccion:</span>
 {preflow.requiredSections.map((sectionKey) => {
 const completed = preflowCompletedSet.has(sectionKey);
 return (
 <span
 key={sectionKey}
 className={`rounded-full border px-2 py-1 text-xs font-medium ${
 completed
 ? "border-emerald-200 bg-emerald-50 text-emerald-700"
 : "border-slate-200 bg-slate-50 text-slate-700"
 }`}
 >
 {sectionKey} · {completed ? "ok" : "pendiente"}
 </span>
 );
 })}
 </div>
 )}
 </div>
 )}

 {/* Control de reapertura — solo aparece cuando aplica */}
 {technicalSlaExpired && (
 <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
 <FiAlertTriangle className="mt-0.5 flex-shrink-0 text-amber-600" size={18} />
 <div className="min-w-0">
 <p className="text-sm font-bold">Aviso: SLA vencido</p>
 <p className="mt-1 text-xs leading-5">
 La ventana de 48 horas de Jefe de Servicio termino. Esto ya no bloquea la edicion ni la sincronizacion, pero se recomienda regularizar con una prorroga.
 </p>
 <p className="mt-2 text-xs font-semibold text-amber-800">
 {extensionRequest?.status === "pending"
  ? "La solicitud de prorroga de 24 horas esta pendiente de decision de Jefe Comercial."
  : "Jefe de Servicio puede solicitar una prorroga de 24 horas a Jefe Comercial con su justificativo."}
 </p>
 </div>
 </div>
 )}

 {(extensionRequest || canRequestPreflowReopen || canResolvePreflowReopen) && (
 <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
 <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
 <div className="space-y-1">
 <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Control de reapertura</p>
 {extensionRequest?.status === "pending" ? (
 <>
 <p className="text-sm font-semibold text-slate-900">
 {technicalSlaExpired ? "Solicitud de prorroga de 24h pendiente" : `Solicitud pendiente para ${extensionRequest.phaseLabel} (${extensionRequest.roleLabel})`}
 </p>
 <p className="text-xs text-slate-600">
 Solicitada por {extensionRequest.requestedByEmail || "N/D"} el {formatDateTime(extensionRequest.requestedAt)}
 </p>
 </>
 ) : extensionRequest?.status === "approved" ? (
 <p className="text-sm font-semibold text-emerald-700">
 Reapertura aprobada. Nuevo limite: {formatDateTime(extensionRequest.newDeadlineAt)}
 </p>
 ) : extensionRequest?.status === "rejected" ? (
 <p className="text-sm font-semibold text-rose-700">
 La ultima solicitud de reapertura fue rechazada.
 </p>
 ) : (
 <p className="text-sm text-slate-700">
 {technicalSlaExpired
  ? "La solicitud de prorroga se gestionara desde este bloque y quedara registrada en el historial del Business Case."
  : "Si la ventana vigente vence, el responsable de la etapa puede solicitar una reapertura a Jefe Comercial."}
 </p>
 )}
 {extensionRequest?.reason && (
 <p className="text-xs text-slate-600">Motivo: {extensionRequest.reason}</p>
 )}
 </div>

 <div className="flex flex-wrap items-center gap-2">
 {canRequestPreflowReopen && extensionRequest?.status !== "pending" && (
 <button
 type="button"
 onClick={onOpenReopenRequest}
 className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
 >
 <FiUnlock size={14} />
 {technicalSlaExpired ? "Solicitar prorroga de 24h" : "Solicitar mas tiempo"}
 </button>
 )}
 {canResolvePreflowReopen && extensionRequest?.status === "pending" && (
 <button
 type="button"
 onClick={onOpenReopenDecision}
 className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
 >
 <FiUnlock size={14} />
 Gestionar solicitud
 </button>
 )}
 {!canResolvePreflowReopen && extensionRequest?.status === "pending" && (
 <span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">
 En revision de Jefe Comercial
 </span>
 )}
 </div>
 </div>
 </div>
 )}

 {/* Detalle de etapas — colapsado por defecto, es historico/secundario */}
 {stageWindows.length > 0 && (
 <div>
 <button
 type="button"
 onClick={() => setShowStageDetail((prev) => !prev)}
 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-900"
 >
 {showStageDetail ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
 Detalle de etapas ({stageWindows.length})
 </button>
 {showStageDetail && (
 <div className="mt-3 grid gap-3 md:grid-cols-2">
 {stageWindows.map((stage) => (
 <div
 key={stage.key}
 className={`rounded-2xl border px-4 py-3 ${
 stage.isActive
 ? stage.isExpired
 ? "border-rose-200 bg-rose-50"
 : "border-indigo-200 bg-indigo-50"
 : stage.completedAt
 ? "border-emerald-200 bg-emerald-50"
 : "border-slate-200 bg-slate-50"
 }`}
 >
 <div className="flex items-center justify-between gap-3">
 <div>
 <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{stage.label}</p>
 <p className="text-sm font-semibold text-slate-900">{stage.roleLabel || "Sin responsable"}</p>
 </div>
 <span
 className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
 stage.completedAt
 ? "bg-emerald-100 text-emerald-700"
 : stage.isActive
 ? stage.isExpired
 ? "bg-rose-100 text-rose-700"
 : "bg-indigo-100 text-indigo-700"
 : "bg-slate-100 text-slate-700"
 }`}
 >
 {stage.completedAt ? "Completada" : stage.isActive ? (stage.isExpired ? "Vencida" : "Activa") : "Pendiente"}
 </span>
 </div>
 <div className="mt-3 space-y-1 text-xs text-slate-600">
 <p>Inicio: {formatDateTime(stage.startedAt)}</p>
 <p>Limite: {formatDateTime(stage.deadlineAt)}</p>
 {stage.completedAt && <p>Cierre: {formatDateTime(stage.completedAt)}</p>}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 </Card>
 );
};

export default CaseHeader;
