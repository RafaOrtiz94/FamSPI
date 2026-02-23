import React, { useEffect, useMemo, useState } from "react";
import { FiRefreshCw, FiDownload, FiFileText, FiCheckCircle, FiClock, FiAlertTriangle } from "react-icons/fi";
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

const CaseHeader = ({ uiGuidance, onRefresh }) => {
  const workspace = useBusinessCaseWorkspaceOptional();
  const resolvedGuidance = uiGuidance || workspace?.uiGuidance || null;
  const resolvedRefresh = onRefresh || workspace?.onRefresh;
  const { businessCaseId, clientName, workflowState, sectionOwnership } = resolvedGuidance || {};
  const { currentState, availableTransitions } = workflowState || {};
  const { completionSummary } = sectionOwnership || {};
  const preflow = resolvedGuidance?.preflow || null;
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
                  Ventana 48h: {preflow?.isExpired ? "vencida" : countdownLabel || "en curso"}
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
              <span className="text-xs font-semibold uppercase tracking-wide">Cuenta regresiva 48h</span>
              <span className="font-mono text-base font-bold">
                {preflow?.isExpired ? "00:00:00" : countdownLabelDetailed || "00:00:00"}
              </span>
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
            Exportar
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
