import React, { useState } from "react";
import { advanceStage, updateStageData } from "../../../../../core/api/hiringPipelineApi";
import {
  SectionTitle, ActionBar, RejectBtn, AdvanceBtn,
  Textarea, Input, Select, DriveLink, DoneNotice, RejectedNotice,
} from "./_stageShared";
import { FiUpload, FiRefreshCw } from "react-icons/fi";

const STAGE_KEY = "evaluacion_psicologica";

export default function StagePsychEval({ entry, stageResult, isCompleted, isRejected, saving, onUpdate, onReject, onReactivate }) {
  const existing = stageResult?.data || {};
  const [form, setForm] = useState({ ...existing });
  const [uploading, setUploading] = useState(false);

  function merge(patch) {
    setForm(prev => ({ ...prev, ...patch }));
  }

  const isScheduled = Boolean(form.meeting_datetime && form.phase === "scheduled");

  async function handleSaveSchedule() {
    await onUpdate(() =>
      updateStageData(entry.id, STAGE_KEY, { ...form, phase: "scheduled" })
    );
    merge({ phase: "scheduled" });
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      const patch = { ...form, phase: "doc_uploaded", doc_name: file.name, doc_base64: base64 };
      await onUpdate(() => updateStageData(entry.id, STAGE_KEY, patch));
      merge({ phase: "doc_uploaded", doc_name: file.name });
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }

  async function handleAdvance() {
    if (!form.observations?.trim()) return;
    await onUpdate(() =>
      advanceStage(entry.id, STAGE_KEY, {
        data: form,
        observations: form.observations,
      })
    );
  }

  return (
    <div className="flex flex-col">
      {isCompleted && <DoneNotice label="Evaluación psicológica completada." />}
      {isRejected && <RejectedNotice onReactivate={() => onReactivate("Reactivación desde evaluación psicológica")} saving={saving} />}

      {!isCompleted && !isRejected && (
        <>
          <div className="space-y-5 p-5">

            {/* Agendar */}
            <div>
              <SectionTitle>1. Agendar la evaluación</SectionTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Fecha y hora</label>
                  <Input type="datetime-local" value={form.meeting_datetime || ""} onChange={e => merge({ meeting_datetime: e.target.value })} disabled={isScheduled} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Modalidad</label>
                  <Select value={form.modality || "presencial"} onChange={e => merge({ modality: e.target.value })} disabled={isScheduled}>
                    <option value="presencial">Presencial</option>
                    <option value="virtual">Virtual</option>
                  </Select>
                </div>
                {form.modality === "virtual" && (
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Enlace</label>
                    <Input type="url" value={form.meeting_link || ""} onChange={e => merge({ meeting_link: e.target.value })} disabled={isScheduled} placeholder="https://..." />
                  </div>
                )}
              </div>
              {!isScheduled && (
                <div className="mt-3 flex justify-end">
                  <button type="button" onClick={handleSaveSchedule} disabled={saving || !form.meeting_datetime}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer transition hover:bg-[#1D4ED8]">
                    {saving ? <FiRefreshCw size={13} className="animate-spin" /> : null}
                    Guardar agendamiento
                  </button>
                </div>
              )}
              {isScheduled && (
                <div className="mt-2 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2 text-xs text-[#16A34A] font-medium">
                  Agendado: {new Date(form.meeting_datetime).toLocaleString("es-EC")}
                </div>
              )}
            </div>

            {/* Subir documento */}
            {isScheduled && (
              <div>
                <SectionTitle>2. Subir informe psicológico</SectionTitle>
                {form.doc_name ? (
                  <div className="flex items-center gap-3">
                    <DriveLink url={form.doc_drive_url} label={form.doc_name} />
                    <label className="cursor-pointer text-xs text-[#2563EB] underline">
                      Cambiar
                      <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                ) : (
                  <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280] transition hover:border-[#2563EB] hover:text-[#2563EB] ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                    {uploading ? <FiRefreshCw size={15} className="animate-spin" /> : <FiUpload size={15} />}
                    {uploading ? "Subiendo..." : "Seleccionar documento (PDF o Word)"}
                    <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                )}
              </div>
            )}

            {/* Observaciones */}
            {form.phase === "doc_uploaded" && (
              <div>
                <SectionTitle>3. Observaciones</SectionTitle>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Observaciones *</label>
                  <Textarea value={form.observations || ""} onChange={e => merge({ observations: e.target.value })} rows={3} placeholder="Resumen de la evaluación psicológica..." />
                </div>
              </div>
            )}
          </div>

          {form.phase === "doc_uploaded" && (
            <ActionBar>
              <RejectBtn onClick={onReject} disabled={saving} />
              <AdvanceBtn onClick={handleAdvance} saving={saving} disabled={!form.observations?.trim()} label="Evaluación aprobada, continuar" />
            </ActionBar>
          )}
        </>
      )}

      {isCompleted && existing.observations && (
        <div className="space-y-2 px-5 pb-5">
          <SectionTitle>Resultado registrado</SectionTitle>
          <p className="text-sm text-[#374151] whitespace-pre-line">{existing.observations}</p>
        </div>
      )}
    </div>
  );
}
