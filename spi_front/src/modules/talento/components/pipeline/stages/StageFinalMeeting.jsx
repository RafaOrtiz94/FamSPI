import React, { useState } from "react";
import { advanceStage, updateStageData } from "../../../../../core/api/hiringPipelineApi";
import {
  SectionTitle, ActionBar, RejectBtn, AdvanceBtn,
  Textarea, Input, Select, DoneNotice, RejectedNotice,
} from "./_stageShared";
import { FiRefreshCw, FiVideo, FiExternalLink } from "react-icons/fi";

const STAGE_KEY = "entrevista_gerencia";

export default function StageFinalMeeting({ entry, stageResult, isCompleted, isRejected, saving, onUpdate, onReject, onReactivate }) {
  const existing = stageResult?.data || {};
  const [form, setForm] = useState({ ...existing });

  function merge(patch) {
    setForm(prev => ({ ...prev, ...patch }));
  }

  const isScheduled = Boolean(form.meeting_datetime && form.phase === "scheduled");
  const isVirtual = form.modality === "virtual";

  // Para virtual: requiere fecha + enlace; para presencial: solo fecha
  const canSave = Boolean(form.meeting_datetime) && (!isVirtual || Boolean(form.meeting_link));

  async function handleSaveSchedule() {
    const updated = await onUpdate(() =>
      updateStageData(entry.id, STAGE_KEY, { ...form, phase: "scheduled" })
    );
    // Sincronizar meet link auto-generado por el backend
    const savedData = updated?.stage_results?.find(s => s.stage === STAGE_KEY)?.data || {};
    merge({ phase: "scheduled", meeting_link: savedData.meeting_link || form.meeting_link });
  }

  async function handleAdvance() {
    if (!form.meeting_summary?.trim()) return;
    await onUpdate(() =>
      advanceStage(entry.id, STAGE_KEY, {
        data: form,
        observations: form.observations,
        score: null,
      })
    );
  }

  return (
    <div className="flex flex-col">
      {isCompleted && <DoneNotice label="Entrevista con gerencia completada." />}
      {isRejected && <RejectedNotice onReactivate={() => onReactivate("Reactivación desde entrevista con gerencia")} saving={saving} />}

      {!isCompleted && !isRejected && (
        <>
          <div className="space-y-5 p-5">
            <div>
              <SectionTitle>1. Agendar reunión con gerencia</SectionTitle>
              <p className="mb-3 text-xs text-[#6B7280]">
                Se notificará por correo al postulante y a gerencia general.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Fecha y hora *</label>
                  <Input type="datetime-local" value={form.meeting_datetime || ""} onChange={e => merge({ meeting_datetime: e.target.value })} disabled={isScheduled} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Modalidad</label>
                  <Select value={form.modality || "presencial"} onChange={e => merge({ modality: e.target.value })} disabled={isScheduled}>
                    <option value="presencial">Presencial</option>
                    <option value="virtual">Virtual</option>
                  </Select>
                </div>
                {isVirtual && (
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Enlace de reunión *</label>
                    <Input
                      type="url"
                      value={form.meeting_link || ""}
                      onChange={e => merge({ meeting_link: e.target.value })}
                      disabled={isScheduled}
                      placeholder="https://meet.google.com/..."
                    />
                    {!isScheduled && (
                      <p className="mt-1 text-[11px] text-[#9CA3AF]">
                        Pega un enlace de Google Meet, Zoom u otra plataforma.
                      </p>
                    )}
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Notas previas</label>
                  <Textarea value={form.pre_notes || ""} onChange={e => merge({ pre_notes: e.target.value })} rows={2} disabled={isScheduled} placeholder="Temas a tratar con gerencia..." />
                </div>
              </div>

              {!isScheduled && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveSchedule}
                    disabled={saving || !canSave}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer transition hover:bg-[#1D4ED8]"
                  >
                    {saving ? <FiRefreshCw size={13} className="animate-spin" /> : null}
                    Guardar y notificar
                  </button>
                </div>
              )}

              {isScheduled && (
                <div className="mt-2 space-y-2">
                  <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2 text-xs text-[#16A34A] font-medium">
                    Reunión agendada: {new Date(form.meeting_datetime).toLocaleString("es-EC")}
                    {form.modality === "presencial" ? " · Presencial" : ""}
                  </div>
                  {form.meeting_link && (
                    <a
                      href={form.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#2563EB] transition hover:bg-[#DBEAFE]"
                    >
                      <FiVideo size={12} /> Unirse a la reunión <FiExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}
            </div>

            {isScheduled && (
              <div>
                <SectionTitle>2. Resultado de la reunión con gerencia</SectionTitle>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Resumen de la reunión *</label>
                  <Textarea value={form.meeting_summary || ""} onChange={e => merge({ meeting_summary: e.target.value })} rows={4} placeholder="¿Qué feedback dio gerencia? ¿Cuál fue la impresión general?" />
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Observaciones adicionales</label>
                  <Textarea value={form.observations || ""} onChange={e => merge({ observations: e.target.value })} rows={2} placeholder="Puntos a destacar..." />
                </div>
              </div>
            )}
          </div>

          {isScheduled && (
            <ActionBar>
              <RejectBtn onClick={onReject} disabled={saving} />
              <AdvanceBtn onClick={handleAdvance} saving={saving} disabled={!form.meeting_summary?.trim()} label="Aprobado, pasar a oferta" />
            </ActionBar>
          )}
        </>
      )}

      {isCompleted && existing.meeting_summary && (
        <div className="space-y-2 px-5 pb-5">
          <SectionTitle>Resumen registrado</SectionTitle>
          <p className="text-sm text-[#374151] whitespace-pre-line">{existing.meeting_summary}</p>
        </div>
      )}
    </div>
  );
}
