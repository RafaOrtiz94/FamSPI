/**
 * Página: Pruebas técnicas asignadas al usuario actual.
 * Accesible para cualquier usuario con sesión activa.
 * Flujo: confirmar fecha → calificar → aprobar o rechazar.
 */

import React, { useState, useEffect } from "react";
import {
  FiCalendar, FiCheck, FiClock, FiRefreshCw, FiAlertCircle,
  FiUser, FiX, FiChevronRight, FiCheckCircle, FiXCircle,
} from "react-icons/fi";
import { getMyTestAssignments, confirmTestDate, submitTestResult } from "../../../core/api/hiringPipelineApi";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-EC", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Guayaquil",
  });
}

function RejectDialog({ onConfirm, onCancel, saving }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEE2E2]">
            <FiXCircle size={18} className="text-[#DC2626]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1F2937]">Rechazar al postulante</p>
            <p className="text-xs text-[#6B7280]">Esta acción notificará a Talento Humano.</p>
          </div>
        </div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Motivo del rechazo (opcional)"
          rows={3}
          className="w-full resize-none rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#1F2937] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20"
        />
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-xl border border-[#E5E7EB] bg-white py-2 text-sm font-medium text-[#1F2937] transition hover:bg-[#F9FAFB] cursor-pointer">
            Cancelar
          </button>
          <button type="button" onClick={() => onConfirm(reason)} disabled={saving}
            className="flex-1 rounded-xl bg-[#DC2626] py-2 text-sm font-semibold text-white transition hover:bg-[#B91C1C] disabled:opacity-60 cursor-pointer flex items-center justify-center gap-1">
            {saving && <FiRefreshCw size={12} className="animate-spin" />}
            Confirmar rechazo
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignmentCard({ assignment, onRefresh }) {
  const data = assignment.data || {};
  const stageStatus = assignment.stage_status;
  const stageResult = assignment.stage_result;

  const isCompleted = stageStatus === "completado";
  const isApproved = stageResult === "aprobado";
  const isRejected = stageResult === "rechazado" || assignment.entry_status === "rechazado";
  const isConfirmed = data.phase === "confirmed" || isCompleted;

  const [dateForm, setDateForm] = useState(data.selected_datetime?.slice(0, 16) || "");
  const [resultForm, setResultForm] = useState({
    score: data.score || "",
    observations: data.result_observations || "",
  });
  const [confirmingDate, setConfirmingDate] = useState(false);
  const [submittingResult, setSubmittingResult] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirmDate() {
    if (!dateForm) return;
    setConfirmingDate(true);
    setError(null);
    try {
      await confirmTestDate(assignment.entry_id, dateForm);
      onRefresh();
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudo confirmar la fecha.");
    } finally {
      setConfirmingDate(false);
    }
  }

  async function handleApprove() {
    if (!resultForm.score || !resultForm.observations?.trim()) return;
    setSubmittingResult(true);
    setError(null);
    try {
      await submitTestResult(assignment.entry_id, {
        score: parseFloat(resultForm.score),
        observations: resultForm.observations,
        decision: "aprobado",
      });
      onRefresh();
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudo registrar el resultado.");
    } finally {
      setSubmittingResult(false);
    }
  }

  async function handleReject(reason) {
    setSubmittingResult(true);
    setError(null);
    try {
      await submitTestResult(assignment.entry_id, {
        score: parseFloat(resultForm.score) || null,
        observations: resultForm.observations,
        decision: "rechazado",
        reason,
      });
      setShowRejectDialog(false);
      onRefresh();
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudo registrar el rechazo.");
      setShowRejectDialog(false);
    } finally {
      setSubmittingResult(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
        {/* Cabecera */}
        <div className="flex items-start gap-3 p-5 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF]">
            <FiUser size={18} className="text-[#2563EB]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Postulante</p>
            <p className="text-base font-semibold text-[#1F2937]">{assignment.applicant_name || "—"}</p>
            {assignment.position && (
              <p className="mt-0.5 text-xs text-[#6B7280]">{assignment.position}</p>
            )}
          </div>
          <div className="shrink-0">
            {isApproved ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[11px] font-semibold text-[#16A34A]">
                <FiCheckCircle size={10} /> Aprobado
              </span>
            ) : isRejected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-[11px] font-semibold text-[#DC2626]">
                <FiXCircle size={10} /> Rechazado
              </span>
            ) : isConfirmed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#2563EB]">
                <FiCalendar size={10} /> Fecha confirmada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-[11px] font-semibold text-[#92400E]">
                <FiClock size={10} /> Pendiente
              </span>
            )}
          </div>
        </div>

        {/* Pasos */}
        <div className="border-t border-[#F3F4F6] px-5 py-4 space-y-5">

          {/* Paso 1: Ventana disponible */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB] text-white text-[10px] font-bold">1</span>
              Ventana disponible
            </p>
            <div className="grid grid-cols-1 gap-1 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3 sm:grid-cols-2 text-sm text-[#1F2937]">
              <div><span className="text-xs text-[#9CA3AF]">Desde:</span> {formatDate(data.available_from)}</div>
              <div><span className="text-xs text-[#9CA3AF]">Hasta:</span> {formatDate(data.available_to)}</div>
            </div>
          </div>

          {/* Divider + flecha */}
          <div className="flex items-center gap-2 text-[#D1D5DB]">
            <div className="flex-1 border-t border-[#F3F4F6]" />
            <FiChevronRight size={14} />
            <div className="flex-1 border-t border-[#F3F4F6]" />
          </div>

          {/* Paso 2: Confirmar fecha */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px] font-bold ${isConfirmed ? "bg-[#16A34A]" : "bg-[#2563EB]"}`}>
                {isConfirmed ? <FiCheck size={9} /> : "2"}
              </span>
              Confirmar fecha y hora
            </p>

            {!isConfirmed ? (
              <div className="flex flex-wrap gap-2">
                <input
                  type="datetime-local"
                  value={dateForm}
                  min={data.available_from?.slice(0, 16)}
                  max={data.available_to?.slice(0, 16)}
                  onChange={e => setDateForm(e.target.value)}
                  className="flex-1 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                />
                <button
                  type="button"
                  onClick={handleConfirmDate}
                  disabled={confirmingDate || !dateForm}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer"
                >
                  {confirmingDate ? <FiRefreshCw size={13} className="animate-spin" /> : <FiCalendar size={13} />}
                  Confirmar
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2.5 text-sm font-semibold text-[#16A34A]">
                {formatDate(data.selected_datetime)}
              </div>
            )}
          </div>

          {/* Paso 3: Resultado — solo aparece después de confirmar fecha */}
          {isConfirmed && !isCompleted && (
            <>
              <div className="flex items-center gap-2 text-[#D1D5DB]">
                <div className="flex-1 border-t border-[#F3F4F6]" />
                <FiChevronRight size={14} />
                <div className="flex-1 border-t border-[#F3F4F6]" />
              </div>

              <div>
                <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB] text-white text-[10px] font-bold">3</span>
                  Resultado de la prueba
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#6B7280]">
                      Calificación (0–100) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={resultForm.score}
                      onChange={e => setResultForm(p => ({ ...p, score: e.target.value }))}
                      placeholder="Ej: 85"
                      className="w-full max-w-[200px] rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#6B7280]">
                      Observaciones *
                    </label>
                    <textarea
                      value={resultForm.observations}
                      onChange={e => setResultForm(p => ({ ...p, observations: e.target.value }))}
                      placeholder="Desempeño general, puntos fuertes, áreas de mejora..."
                      rows={3}
                      className="w-full resize-none rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#1F2937] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={submittingResult}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-2 text-sm font-semibold text-[#DC2626] transition hover:bg-[#FEE2E2] disabled:opacity-50 cursor-pointer"
                    >
                      <FiX size={13} /> Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={submittingResult || !resultForm.score || !resultForm.observations?.trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#15803D] disabled:opacity-50 cursor-pointer"
                    >
                      {submittingResult ? <FiRefreshCw size={13} className="animate-spin" /> : <FiCheck size={13} />}
                      Aprobar
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Vista completada */}
          {isCompleted && (
            <>
              <div className="flex items-center gap-2 text-[#D1D5DB]">
                <div className="flex-1 border-t border-[#F3F4F6]" />
                <FiChevronRight size={14} />
                <div className="flex-1 border-t border-[#F3F4F6]" />
              </div>

              <div className={`rounded-xl border px-4 py-3 ${isApproved ? "border-[#BBF7D0] bg-[#F0FDF4]" : "border-[#FCA5A5] bg-[#FEF2F2]"}`}>
                <p className={`text-xs font-semibold ${isApproved ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                  {isApproved ? "Prueba aprobada" : "Prueba rechazada"}
                </p>
                {(data.score || assignment.stage_score) && (
                  <p className={`text-sm font-bold ${isApproved ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                    Calificación: {data.score || assignment.stage_score}/100
                  </p>
                )}
                {(data.result_observations || assignment.stage_observations) && (
                  <p className="mt-1 text-xs text-[#6B7280] whitespace-pre-line">
                    {data.result_observations || assignment.stage_observations}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <p className="flex items-center gap-1 text-xs text-[#DC2626]">
              <FiAlertCircle size={11} /> {error}
            </p>
          )}
        </div>
      </div>

      {showRejectDialog && (
        <RejectDialog
          onConfirm={handleReject}
          onCancel={() => setShowRejectDialog(false)}
          saving={submittingResult}
        />
      )}
    </>
  );
}

export default function TechnicalTestResponsiblePage() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyTestAssignments();
      setAssignments(res?.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudieron cargar las asignaciones.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const pending = assignments.filter(a => a.stage_result !== "aprobado" && a.entry_status === "en_evaluacion");
  const completed = assignments.filter(a => a.stage_result === "aprobado" || a.stage_result === "rechazado" || a.entry_status === "rechazado");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#1F2937]">Pruebas técnicas asignadas</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Aquí aparecen los procesos de selección en los que fuiste designado como evaluador técnico.
          Confirma la fecha, califica al postulante y aprueba o rechaza su candidatura.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-[#6B7280]">
          <FiRefreshCw size={18} className="animate-spin mr-2" />
          <span className="text-sm">Cargando asignaciones...</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <FiAlertCircle size={22} className="text-[#DC2626]" />
          <p className="text-sm text-[#DC2626]">{error}</p>
          <button type="button" onClick={load} className="text-xs text-[#2563EB] underline cursor-pointer">
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && !assignments.length && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <FiCalendar size={32} className="text-[#D1D5DB] mb-1" />
          <p className="text-sm font-medium text-[#6B7280]">Sin asignaciones</p>
          <p className="text-xs text-[#9CA3AF]">
            Cuando Talento Humano te asigne como evaluador de una prueba técnica, aparecerá aquí.
          </p>
        </div>
      )}

      {!loading && !error && assignments.length > 0 && (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Pendientes ({pending.length})
              </h2>
              <div className="space-y-4">
                {pending.map(a => (
                  <AssignmentCard key={`${a.entry_id}_${a.stage}`} assignment={a} onRefresh={load} />
                ))}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Completadas ({completed.length})
              </h2>
              <div className="space-y-4">
                {completed.map(a => (
                  <AssignmentCard key={`${a.entry_id}_${a.stage}`} assignment={a} onRefresh={load} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
