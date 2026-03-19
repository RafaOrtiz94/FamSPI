import React, { useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiDownload, FiFileText, FiCheckCircle, FiClock, FiAlertTriangle, FiUnlock } from "react-icons/fi";
import Card from "../../../../core/ui/components/Card";
import { useBusinessCaseWorkspaceOptional } from "./BusinessCaseWorkspaceContext";

const resolvePurchaseOrigin = (bcPurchaseType, metadata = {}) => {
 const normalizedType = String(bcPurchaseType || "").toLowerCase();
 const sourceModule = String(metadata?.source_module || "").toLowerCase();

 if (normalizedType.includes("pub") || normalizedType.includes("publico")) return "publica";
 if (normalizedType.includes("priv")) return "privada";
 if (sourceModule.includes("equipment_purchases")) return "publica";
 if (sourceModule.includes("private_purchases")) return "privada";
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
 if (normalized === "acp_comercial") return "ACP Comercial";
 if (normalized === "backoffice_comercial") return "Backoffice Comercial";
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
 const resolvedGuidance = uiGuidance || workspace?.uiGuidance || null;
 const resolvedRefresh = onRefresh || workspace?.onRefresh;
 const { businessCaseId, clientName, workflowState, sectionOwnership } = resolvedGuidance || {};
 const { currentState, availableTransitions } = workflowState || {};
 const { completionSummary } = sectionOwnership || {};
 const preflow = resolvedGuidance?.preflow || null;
 const feasibility = resolvedGuidance?.workspaceData?.feasibility || null;
 const feasibilityDecision = feasibility?.decision || null;
 const [nowMs, setNowMs] = useState(Date.now());

 // Mock state display mapping
 const stateDisplay = {
 'DRAFT_INICIAL': { label: 'Borrador Inicial', color: 'bg-gray-100 text-gray-700', icon: FiClock },
 'DATOS_BASE_COMPLETOS': { label: 'Datos Completos', color: 'bg-blue-100 text-blue-700', icon: FiCheckCircle },
 'EN_EVALUACION_VIABILIDAD': { label: 'En Evaluación', color: 'bg-yellow-100 text-yellow-700', icon: FiAlertTriangle },
 'VIABLE': { label: 'Viable', color: 'bg-green-100 text-green-700', icon: FiCheckCircle },
 'CERRADO_PARA_APROBACION': { label: 'Para Aprobación', color: 'bg-purple-100 text-purple-700', icon: FiFileText }
 };

 const currentStateDisplay = stateDisplay[currentState] || stateDisplay['DRAFT_INICIAL'];
 const serverNowOffsetMs = useMemo(() => {
 if (!preflow?.serverNow) return 0;
 const serverMs = new Date(preflow.serverNow).getTime();
 if (!Number.isFinite(serverMs)) return 0;
 return serverMs - Date.now();
 }, [preflow?.serverNow]);

 const deadlineMs = useMemo(
 () => (preflow?.deadlineAt ? new Date(preflow.deadlineAt).getTime() : null),
 [preflow?.deadlineAt],
 );

 useEffect(() => {
 if (!deadlineMs || preflow?.isExpired) return undefined;
 const id = setInterval(() => setNowMs(Date.now()), 1000);
 return () => clearInterval(id);
 }, [deadlineMs, preflow?.isExpired]);

 const countdownLabel = useMemo(() => {
 if (!deadlineMs) return null;
 const effectiveNow = nowMs + serverNowOffsetMs;
 const diff = Math.max(0, deadlineMs - effectiveNow);
 const hours = Math.floor(diff / (1000 * 60 * 60));
 const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
 return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
 }, [deadlineMs, nowMs, serverNowOffsetMs]);

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
 const preflowCompletedSet = useMemo(
 () => new Set(preflow?.completedRequiredSections || []),
 [preflow?.completedRequiredSections],
 );
 const preflowSlaStatus = useMemo(() => {
 if (!preflow?.isActive) return null;
 if (preflow?.isExpired) {
 return { label: "SLA 48h vencido", badge: "bg-rose-100 text-rose-800 border-rose-200" };
 }
 if (countdownUrgency === "critical") {
 return { label: "SLA 48h por vencer", badge: "bg-amber-100 text-amber-800 border-amber-200" };
 }
 return { label: "SLA 48h en tiempo", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" };
 }, [preflow?.isActive, preflow?.isExpired, countdownUrgency]);

 const purchaseOrigin = useMemo(
 () => resolvePurchaseOrigin(resolvedGuidance?.bc_purchase_type, resolvedGuidance?.modern_bc_metadata),
 [resolvedGuidance?.bc_purchase_type, resolvedGuidance?.modern_bc_metadata],
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
 () => roleToLabel(preflow?.activeRole),
 [preflow?.activeRole],
 );
 const commercialElapsedLabel = useMemo(
 () => formatDuration(preflow?.commercial?.elapsedSeconds),
 [preflow?.commercial?.elapsedSeconds],
 );
 const stageWindows = Array.isArray(preflow?.stageWindows) ? preflow.stageWindows : [];
 const extensionRequest = preflow?.extensionRequest || null;
 const canRequestPreflowReopen = Boolean(resolvedGuidance?.permissions?.canRequestPreflowReopen);
 const canResolvePreflowReopen = Boolean(resolvedGuidance?.permissions?.canResolvePreflowReopen);
 const activeWindowLabel = preflow?.phaseLabel || "Etapa activa";

 return (
 <Card className="p-4 sm:p-6">
 <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
 {/* Left side: Case info */}
 <div className="flex-1">
 <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-3">
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

 {/* Progress summary */}
 <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm">
 <div className="flex items-center gap-2">
 <FiCheckCircle className="text-green-600" />
 <span>{completionSummary?.completedSections ?? 0}/{completionSummary?.totalSections ?? 0} completadas</span>
 </div>
 <div className="flex items-center gap-2">
 <FiClock className="text-yellow-600" />
 <span>{completionSummary?.inProgressSections ?? 0} en progreso</span>
 </div>
 <div className="flex items-center gap-2">
 <FiAlertTriangle className="text-gray-600" />
 <span>{completionSummary?.pendingSections ?? 0} pendientes</span>
 </div>
 <div className="flex items-center gap-2">
 <FiFileText className="text-slate-600" />
 <span>Iniciado por: {initiatorLabel}</span>
 </div>
 {preflow?.isActive && (
 <div className={`flex items-center gap-2 ${preflow?.isExpired ? "text-rose-700" : "text-indigo-700"}`}>
 <FiClock className={preflow?.isExpired ? "text-rose-600" : "text-indigo-600"} />
 <span>
 Ventana activa {activeWindowLabel} ({preflowActiveRoleLabel}): {preflow?.isExpired ? "vencida" : countdownLabel || "en curso"}
 </span>
 </div>
 )}
 {preflowSlaStatus && (
 <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${preflowSlaStatus.badge}`}>
 <FiAlertTriangle size={12} />
 <span>{preflowSlaStatus.label}</span>
 </div>
 )}
 {preflow?.isActive && (
 <div className="flex items-center gap-2 text-xs text-indigo-800">
 <span>Avance comercial:</span>
 <div className="h-2 w-24 rounded-full bg-indigo-100">
 <div
 className="h-2 rounded-full bg-indigo-600 transition-all"
 style={{ width: `${preflowProgressPercent}%` }}
 />
 </div>
 <span>{preflowProgressPercent}%</span>
 </div>
 )}
 {commercialElapsedLabel && (
 <div className="flex items-center gap-2 text-xs text-slate-700">
 <FiCheckCircle className="text-emerald-600" />
 <span>Tiempo comercial registrado: {commercialElapsedLabel}</span>
 </div>
 )}
 {feasibilityDecision?.decided_at && (
 <div className="flex items-center gap-2 text-xs text-slate-700">
 <FiCheckCircle className={feasibilityDecision?.is_feasible ? "text-emerald-600" : "text-rose-600"} />
 <span>
 BC cerrado como {feasibilityDecision?.is_feasible ? "factible" : "no factible"}
 </span>
 </div>
 )}
 </div>

 {preflow?.isActive && (
 <div
 className={`mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 ${
 preflow?.isExpired
 ? "border-rose-300 bg-rose-50 text-rose-700"
 : countdownUrgency === "critical"
 ? "border-rose-300 bg-rose-50 text-rose-700"
 : countdownUrgency === "warning"
 ? "border-amber-300 bg-amber-50 text-amber-700"
 : "border-indigo-300 bg-indigo-50 text-indigo-700"
 }`}
 >
 <FiClock />
 <span className="text-xs font-semibold uppercase tracking-wide">
 Cuenta regresiva etapa activa 48h
 </span>
 <span className="font-mono text-base font-bold">
 {preflow?.isExpired ? "00:00:00" : countdownLabelDetailed || "00:00:00"}
 </span>
 </div>
 )}

 {stageWindows.length > 0 && (
 <div className="mt-4 grid gap-3 md:grid-cols-2">
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

 {(extensionRequest || canRequestPreflowReopen || canResolvePreflowReopen) && (
 <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
 <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
 <div className="space-y-1">
 <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Control de reapertura</p>
 {extensionRequest?.status === "pending" ? (
 <>
 <p className="text-sm font-semibold text-slate-900">
 Solicitud pendiente para {extensionRequest.phaseLabel} ({extensionRequest.roleLabel})
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
 Si la ventana vigente vence, el responsable de la etapa puede solicitar una reapertura a Jefe Comercial.
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
 Solicitar mas tiempo
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

 {preflow?.isActive && Array.isArray(preflow?.requiredSections) && preflow.requiredSections.length > 0 && (
 <div className="mt-3 flex flex-wrap items-center gap-2">
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

 {/* Right side: Global actions */}
 <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
 <button
 type="button"
 onClick={resolvedRefresh}
 className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto"
 >
 <FiRefreshCw size={16} />
 Actualizar
 </button>
 <button
 type="button"
 className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto"
 disabled
 >
 <FiDownload size={16} />
 Sincronizar
 </button>
 <button
 type="button"
 className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto"
 disabled
 >
 <FiFileText size={16} />
 Audit Trail
 </button>
 </div>
 </div>
 </Card>
 );
};

export default CaseHeader;
