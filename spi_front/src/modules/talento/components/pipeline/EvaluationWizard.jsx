import React, { useState, useCallback } from "react";
import { FiCheck, FiLock, FiChevronRight, FiAlertTriangle, FiRefreshCw, FiX } from "react-icons/fi";
import StageProfileReview from "./stages/StageProfileReview";
import StageReferenceChecks from "./stages/StageReferenceChecks";
import StageMeeting from "./stages/StageMeeting";
import StageTechnicalTest from "./stages/StageTechnicalTest";
import StagePsychEval from "./stages/StagePsychEval";
import StageFinalMeeting from "./stages/StageFinalMeeting";
import StageContracting from "./stages/StageContracting";

const STAGES = [
  { key: "revision_perfil",        label: "Revisión del perfil",     short: "Perfil" },
  { key: "verificacion_referencias", label: "Verificación de referencias", short: "Referencias" },
  { key: "primera_entrevista",     label: "Primera entrevista",      short: "Entrevista" },
  { key: "prueba_habilidades",     label: "Prueba de habilidades",   short: "Prueba" },
  { key: "evaluacion_psicologica", label: "Evaluación psicológica",  short: "Psicológica" },
  { key: "entrevista_gerencia",    label: "Entrevista con gerencia", short: "Gerencia" },
  { key: "oferta_contratacion",    label: "Oferta y contratación",   short: "Contratación" },
];

function hasApprovedStage(entry, stageKey) {
  return Boolean((entry?.stage_results || []).find((stage) => stage.stage === stageKey && stage.result === "aprobado"));
}

function resolveRequiredStage(entry) {
  if (!entry || entry.status !== "en_evaluacion") return entry?.current_stage;
  const currentIdx = STAGES.findIndex((stage) => stage.key === entry.current_stage);
  const referenceIdx = STAGES.findIndex((stage) => stage.key === "verificacion_referencias");

  if (currentIdx > referenceIdx && !hasApprovedStage(entry, "verificacion_referencias")) {
    return "verificacion_referencias";
  }

  return entry.current_stage;
}

function stageStatus(entry, stageKey) {
  if (!entry) return "locked";
  const requiredStage = resolveRequiredStage(entry);
  const result = (entry.stage_results || []).find(s => s.stage === stageKey);
  if (result?.result === "rechazado") return "rejected";
  if (result?.result === "aprobado") return "done";
  if (requiredStage === stageKey) return "active";
  const stageIdx = STAGES.findIndex(s => s.key === stageKey);
  const currentIdx = STAGES.findIndex(s => s.key === requiredStage);
  if (stageIdx < currentIdx) return "done";
  return "locked";
}

function StepNode({ stage, status, index, isLast, onClick, isMobile }) {
  const colors = {
    done:     { bg: "#DCFCE7", border: "#16A34A", text: "#16A34A", line: "#16A34A" },
    active:   { bg: "#EFF6FF", border: "#2563EB", text: "#2563EB", line: "#E5E7EB" },
    rejected: { bg: "#FEE2E2", border: "#DC2626", text: "#DC2626", line: "#E5E7EB" },
    locked:   { bg: "#F3F4F6", border: "#E5E7EB", text: "#9CA3AF", line: "#E5E7EB" },
  };
  const c = colors[status];

  if (isMobile) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold"
          style={{ background: c.bg, borderColor: c.border, color: c.text }}>
          {status === "done" ? <FiCheck size={10} /> : status === "rejected" ? <FiX size={10} /> : status === "locked" ? <FiLock size={9} /> : index + 1}
        </div>
        <span className="text-xs font-medium" style={{ color: c.text }}>{stage.short}</span>
        {!isLast && <FiChevronRight size={12} className="text-[#D1D5DB]" />}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center" style={{ minWidth: 72 }}>
      <button
        type="button"
        onClick={() => status === "done" && onClick(stage.key)}
        disabled={status === "locked" || status === "active"}
        title={stage.label}
        className="flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition"
        style={{ background: c.bg, borderColor: c.border, color: c.text, cursor: status === "done" ? "pointer" : "default" }}
      >
        {status === "done"     ? <FiCheck size={14} /> :
         status === "rejected" ? <FiX size={14} /> :
         status === "locked"   ? <FiLock size={12} /> :
         index + 1}
      </button>
      <span className="mt-1.5 text-center text-[10px] font-medium leading-tight" style={{ color: c.text, maxWidth: 64 }}>
        {stage.short}
      </span>
    </div>
  );
}

function RejectDialog({ onConfirm, onCancel, saving }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0F172A]/60">
      <div className="w-full max-w-sm rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEE2E2]">
            <FiAlertTriangle size={18} className="text-[#DC2626]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1F2937]">Rechazar postulante</p>
            <p className="text-xs text-[#6B7280]">Esta acción se puede revertir desde la lista</p>
          </div>
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Motivo del rechazo (opcional)"
          rows={3}
          className="w-full resize-none rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
        />
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-[#E5E7EB] bg-white py-2 text-sm font-medium text-[#1F2937] transition hover:bg-[#F9FAFB] cursor-pointer">
            Cancelar
          </button>
          <button type="button" onClick={() => onConfirm(reason)} disabled={saving}
            className="flex-1 rounded-xl bg-[#DC2626] py-2 text-sm font-semibold text-white transition hover:bg-[#B91C1C] active:scale-95 disabled:opacity-60 cursor-pointer flex items-center justify-center gap-1">
            {saving && <FiRefreshCw size={12} className="animate-spin" />}
            Confirmar rechazo
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EvaluationWizard({ entry, requestId, onEntryUpdate, onFinalizeHiring, hideNameHeader = false }) {
  const [viewStage, setViewStage] = useState(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const requiredStage = resolveRequiredStage(entry);
  const activeStage = viewStage || requiredStage;
  const isRejected = entry?.status === "rechazado";
  const isHired = entry?.status === "contratado";

  const handleStageUpdate = useCallback(async (updater) => {
    setSaving(true);
    try {
      const updated = await updater();
      if (updated?.data) onEntryUpdate(updated.data);
    } finally {
      setSaving(false);
    }
  }, [onEntryUpdate]);

  const handleReject = useCallback(async (reason) => {
    setSaving(true);
    try {
      const updated = await import("../../../../core/api/hiringPipelineApi")
        .then(m => m.rejectApplicant(entry.id, activeStage, reason));
      if (updated?.data) onEntryUpdate(updated.data);
      setShowRejectDialog(false);
    } finally {
      setSaving(false);
    }
  }, [entry?.id, activeStage, onEntryUpdate]);

  const handleReactivate = useCallback(async (reason) => {
    setSaving(true);
    try {
      const updated = await import("../../../../core/api/hiringPipelineApi")
        .then(m => m.reactivateApplicant(entry.id, reason));
      if (updated?.data) onEntryUpdate(updated.data);
    } finally {
      setSaving(false);
    }
  }, [entry?.id, onEntryUpdate]);

  const stageResult = entry?.stage_results?.find(s => s.stage === activeStage);
  const isCompleted = stageResult?.result === "aprobado";

  const stageProps = {
    entry,
    activeStage,
    stageResult,
    isCompleted,
    isRejected,
    isHired,
    saving,
    onUpdate: handleStageUpdate,
    onReject: () => setShowRejectDialog(true),
    onReactivate: handleReactivate,
    onFinalizeHiring,
    onEntryUpdate,
  };

  function renderStageContent() {
    switch (activeStage) {
      case "revision_perfil":       return <StageProfileReview {...stageProps} />;
      case "verificacion_referencias": return <StageReferenceChecks {...stageProps} />;
      case "primera_entrevista":    return <StageMeeting {...stageProps} />;
      case "prueba_habilidades":    return <StageTechnicalTest {...stageProps} />;
      case "evaluacion_psicologica":return <StagePsychEval {...stageProps} />;
      case "entrevista_gerencia":   return <StageFinalMeeting {...stageProps} />;
      case "oferta_contratacion":   return <StageContracting {...stageProps} requestId={requestId} />;
      default:                      return <div className="p-6 text-sm text-[#6B7280]">Selecciona una etapa</div>;
    }
  }

  if (!entry) return null;

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">

      {/* Stepper desktop */}
      <div className="hidden sm:flex items-start justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-4 overflow-x-auto gap-2">
        {STAGES.map((stage, idx) => {
          const status = stageStatus(entry, stage.key);
          return (
            <React.Fragment key={stage.key}>
              <StepNode
                stage={stage}
                status={status}
                index={idx}
                isLast={idx === STAGES.length - 1}
                onClick={setViewStage}
              />
              {idx < STAGES.length - 1 && (
                <div className="mt-4 flex-1 border-t border-[#E5E7EB]" style={{ minWidth: 8 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Stepper mobile — solo etapa actual */}
      <div className="flex sm:hidden items-center gap-1.5 border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 overflow-x-auto">
        {STAGES.map((stage, idx) => (
          <StepNode
            key={stage.key}
            stage={stage}
            status={stageStatus(entry, stage.key)}
            index={idx}
            isLast={idx === STAGES.length - 1}
            isMobile
          />
        ))}
      </div>

      {/* Header de nombre — se oculta cuando lo muestra el modal padre */}
      {!hideNameHeader && (
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
              {STAGES.find(s => s.key === activeStage)?.label || "Evaluación"}
            </p>
            <p className="text-sm font-semibold text-[#1F2937] truncate">{entry.applicant_name}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isRejected && (
              <span className="rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-[11px] font-semibold text-[#DC2626]">Rechazado</span>
            )}
            {isHired && (
              <span className="rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[11px] font-semibold text-[#16A34A]">Contratado</span>
            )}
          </div>
        </div>
      )}

      {/* Contenido de la etapa */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {renderStageContent()}
      </div>

      {showRejectDialog && (
        <RejectDialog
          onConfirm={handleReject}
          onCancel={() => setShowRejectDialog(false)}
          saving={saving}
        />
      )}
    </div>
  );
}
