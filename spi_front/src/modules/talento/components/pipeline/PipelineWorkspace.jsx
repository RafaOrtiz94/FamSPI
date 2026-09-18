import React, { useState, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { FiUsers, FiRefreshCw, FiAlertCircle, FiX, FiChevronLeft, FiDownloadCloud } from "react-icons/fi";
import {
  getPipelineForRequest,
  startEvaluation,
  getEntry,
} from "../../../../core/api/hiringPipelineApi";
import { syncApplicantsFromSheet } from "../../../../core/api/applicantsApi";
import ApplicantPipelineList from "./ApplicantPipelineList";
import EvaluationWizard from "./EvaluationWizard";

function asArray(v) {
  return Array.isArray(v) ? v : v ? [v] : [];
}

// ── Modal del wizard ──────────────────────────────────────────────────────────

function WizardModal({ entry, requestId, onClose, onEntryUpdate, onFinalizeHiring }) {
  if (!entry) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F172A]/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full flex-col overflow-hidden rounded-t-2xl border border-[#E5E7EB] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)] sm:rounded-2xl sm:max-w-3xl"
        style={{ maxHeight: "calc(92dvh - env(safe-area-inset-bottom, 0px))" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle mobile */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
          <div className="h-1 w-9 rounded-full bg-[#E5E7EB]" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#E5E7EB] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] transition hover:bg-[#F3F4F6] cursor-pointer sm:hidden"
          >
            <FiChevronLeft size={15} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Proceso de evaluación</p>
            <p className="text-sm font-semibold text-[#1F2937] truncate">{entry.applicant_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#6B7280] transition hover:bg-[#F3F4F6] cursor-pointer"
          >
            <FiX size={15} />
          </button>
        </div>

        {/* Wizard sin su propio header de nombre — ya lo tenemos arriba */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EvaluationWizard
            entry={entry}
            requestId={requestId}
            onEntryUpdate={onEntryUpdate}
            onFinalizeHiring={onFinalizeHiring}
            hideNameHeader
          />
        </div>
      </div>
    </div>
  );
}

// ── Workspace principal ───────────────────────────────────────────────────────

export default function PipelineWorkspace({
  requestId,
  applicants,
  onEntriesChange,
  selectedApplicantId = "",
  linkedApplicantId = "",
  onApplicantSelect,
  onApplicantsSynced,
}) {
  const [entries, setEntries] = useState([]);
  const [modalEntry, setModalEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startingId, setStartingId] = useState(null);
  const [error, setError] = useState(null);
  const [syncingApplicants, setSyncingApplicants] = useState(false);

  const handleSyncApplicants = useCallback(async () => {
    setSyncingApplicants(true);
    try {
      const res = await syncApplicantsFromSheet();
      const { imported = 0, errors = [] } = res?.data || {};
      if (errors.length) {
        toast.error(`${imported} postulante(s) nuevo(s) importados, ${errors.length} con error.`);
      } else if (imported > 0) {
        toast.success(`${imported} postulante(s) nuevo(s) importados desde el formulario.`);
      } else {
        toast.success("No hay postulantes nuevos en el formulario.");
      }
      await onApplicantsSynced?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || "No se pudo sincronizar con el formulario.");
    } finally {
      setSyncingApplicants(false);
    }
  }, [onApplicantsSynced]);

  const loadPipeline = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getPipelineForRequest(requestId);
      const data = asArray(res?.data);
      setEntries(data);
      onEntriesChange?.(data);
    } catch (e) {
      setError(e?.message || "No se pudo cargar el pipeline");
    } finally {
      setLoading(false);
    }
  }, [requestId, onEntriesChange]);

  useEffect(() => {
    loadPipeline();
  }, [loadPipeline]);

  async function handleStart(applicant) {
    setStartingId(applicant.id);
    try {
      const res = await startEvaluation(requestId, applicant.id);
      if (res?.data) {
        const fullEntry = await getEntry(res.data.id).then(r => r?.data || res.data);
        setEntries(prev => {
          const next = [...prev.filter(e => String(e.id) !== String(fullEntry.id)), fullEntry];
          onEntriesChange?.(next);
          return next;
        });
        setModalEntry(fullEntry);
      }
    } catch (e) {
      alert(e?.message || "No se pudo iniciar la evaluación");
    } finally {
      setStartingId(null);
    }
  }

  async function handleSelectEntry(entry) {
    try {
      const fullEntry = await getEntry(entry.id).then(r => r?.data || entry);
      setModalEntry(fullEntry);
    } catch {
      setModalEntry(entry);
    }
  }

  const handleEntryUpdate = useCallback((updated) => {
    setModalEntry(updated);
    setEntries(prev => {
      const next = prev.map(e => String(e.id) === String(updated.id) ? updated : e);
      onEntriesChange?.(next);
      return next;
    });
  }, [onEntriesChange]);

  const handleFinalize = useCallback(async () => {
    await loadPipeline();
    setModalEntry(prev => prev ? { ...prev, status: "contratado" } : null);
  }, [loadPipeline]);

  const applicantsList = asArray(applicants);

  return (
    <>
      {/* Lista siempre visible */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-[#E5E7EB] px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EFF6FF]">
            <FiUsers size={13} className="text-[#2563EB]" />
          </div>
          <p className="text-sm font-semibold text-[#1F2937]">Postulantes en proceso de selección</p>
          {loading && <FiRefreshCw size={12} className="ml-2 animate-spin text-[#9CA3AF]" />}
          <span className="ml-auto rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-semibold text-[#6B7280]">
            {applicantsList.length}
          </span>
          <button
            type="button"
            onClick={handleSyncApplicants}
            disabled={syncingApplicants}
            title="Importa postulantes nuevos desde el formulario de Google que no hayan llegado automaticamente"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1F2937] transition hover:border-[#2563EB] hover:text-[#2563EB] active:scale-[0.97] disabled:cursor-wait disabled:opacity-50 cursor-pointer"
          >
            {syncingApplicants ? (
              <FiRefreshCw size={12} className="animate-spin" />
            ) : (
              <FiDownloadCloud size={12} />
            )}
            Sincronizar formulario
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-[#DC2626]">
            <FiAlertCircle size={14} />
            <span>{error}</span>
            <button type="button" onClick={loadPipeline} className="ml-auto text-xs text-[#2563EB] underline cursor-pointer">Reintentar</button>
          </div>
        )}

        {!error && (
          <ApplicantPipelineList
            applicants={applicantsList}
            entries={entries}
            selectedEntryId={modalEntry?.id}
            selectedApplicantId={selectedApplicantId}
            linkedApplicantId={linkedApplicantId}
            onSelect={handleSelectEntry}
            onStart={handleStart}
            onApplicantSelect={onApplicantSelect}
            startingId={startingId}
          />
        )}
      </div>

      {/* Modal del wizard — se monta encima sin afectar el layout */}
      {modalEntry && (
        <WizardModal
          entry={modalEntry}
          requestId={requestId}
          onClose={() => setModalEntry(null)}
          onEntryUpdate={handleEntryUpdate}
          onFinalizeHiring={handleFinalize}
        />
      )}
    </>
  );
}
