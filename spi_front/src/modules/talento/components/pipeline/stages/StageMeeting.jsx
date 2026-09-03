import React, { useState } from "react";
import { advanceStage, updateStageData } from "../../../../../core/api/hiringPipelineApi";
import {
  SectionTitle, Field, ActionBar, RejectBtn, AdvanceBtn,
  Textarea, Input, Select, DoneNotice, RejectedNotice,
} from "./_stageShared";
import { FiCalendar, FiRefreshCw, FiVideo, FiExternalLink } from "react-icons/fi";

const STAGE_KEY = "primera_entrevista";
const STAGE_LABEL = "Primera entrevista";

function SchedulePhase({ data, onChange, onSave, saving }) {
  const isVirtual = data.modality === "virtual";
  // Para virtual: requiere fecha + enlace (o se genera automático al guardar)
  // Para presencial: solo requiere fecha
  const canSave = Boolean(data.meeting_datetime) && (!isVirtual || Boolean(data.meeting_link));

  return (
    <div className="space-y-4 p-5">
      <SectionTitle>Agendar reunión</SectionTitle>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Fecha y hora *</label>
          <Input type="datetime-local" value={data.meeting_datetime || ""} onChange={e => onChange({ meeting_datetime: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Modalidad</label>
          <Select value={data.modality || "virtual"} onChange={e => onChange({ modality: e.target.value })}>
            <option value="virtual">Virtual (videollamada)</option>
            <option value="presencial">Presencial</option>
          </Select>
        </div>
        {isVirtual && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[#6B7280]">
              Enlace de reunión *
            </label>
            <Input
              type="url"
              value={data.meeting_link || ""}
              onChange={e => onChange({ meeting_link: e.target.value })}
              placeholder="https://meet.google.com/..."
            />
            <p className="mt-1 text-[11px] text-[#9CA3AF]">
              Si no tienes un enlace todavía, puedes pegar uno de Google Meet, Zoom u otra plataforma.
            </p>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Notas previas (opcionales)</label>
          <Textarea value={data.pre_notes || ""} onChange={e => onChange({ pre_notes: e.target.value })} rows={2} placeholder="Temas a tratar, instrucciones..." />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !canSave}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {saving ? <FiRefreshCw size={13} className="animate-spin" /> : <FiCalendar size={13} />}
          Guardar y notificar postulante
        </button>
      </div>
    </div>
  );
}

function ScheduledBadge({ data }) {
  return (
    <div className="mx-5 mt-3 space-y-2">
      <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2.5 text-xs text-[#16A34A] font-medium">
        Reunión agendada para el {new Date(data.meeting_datetime).toLocaleString("es-EC")}
        {data.modality === "presencial" ? " · Presencial" : ""}
      </div>
      {data.meeting_link && (
        <a
          href={data.meeting_link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#2563EB] transition hover:bg-[#DBEAFE]"
        >
          <FiVideo size={12} /> Unirse a la reunión <FiExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

function ResultPhase({ data, onChange }) {
  return (
    <div className="space-y-4 p-5">
      <SectionTitle>Resultado de la reunión</SectionTitle>

      <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Fecha y hora">{data.meeting_datetime ? new Date(data.meeting_datetime).toLocaleString("es-EC") : "—"}</Field>
          <Field label="Modalidad">{data.modality === "virtual" ? "Virtual" : "Presencial"}</Field>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Resumen de la reunión *</label>
        <Textarea value={data.meeting_summary || ""} onChange={e => onChange({ meeting_summary: e.target.value })} rows={4} placeholder="¿Qué temas se cubrieron? ¿Cómo fue el desempeño del postulante?" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Observaciones adicionales</label>
        <Textarea value={data.observations || ""} onChange={e => onChange({ observations: e.target.value })} rows={2} placeholder="Puntos a destacar, preocupaciones..." />
      </div>
    </div>
  );
}

export default function StageMeeting({ entry, stageResult, isCompleted, isRejected, saving, onUpdate, onReject, onReactivate }) {
  const existing = stageResult?.data || {};
  const [form, setForm] = useState({ ...existing });
  const isScheduled = Boolean(form.meeting_datetime && form.phase === "scheduled");

  function merge(patch) {
    setForm(prev => ({ ...prev, ...patch }));
  }

  async function handleSaveSchedule() {
    const updated = await onUpdate(() =>
      updateStageData(entry.id, STAGE_KEY, { ...form, phase: "scheduled" }, { notify_assignment: false })
    );
    // Si el backend generó un meet link automático, sincronizarlo al form local
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
      {isCompleted && <DoneNotice label={`${STAGE_LABEL} completada.`} />}
      {isRejected && <RejectedNotice onReactivate={() => onReactivate(`Reactivación desde ${STAGE_LABEL}`)} saving={saving} />}

      {!isCompleted && !isRejected && !isScheduled && (
        <SchedulePhase data={form} onChange={merge} onSave={handleSaveSchedule} saving={saving} />
      )}

      {!isCompleted && !isRejected && isScheduled && (
        <>
          <ScheduledBadge data={form} />
          <ResultPhase data={form} onChange={merge} />
          <ActionBar>
            <RejectBtn onClick={onReject} disabled={saving} />
            <AdvanceBtn onClick={handleAdvance} saving={saving} disabled={!form.meeting_summary?.trim()} label="Aprobar y continuar" />
          </ActionBar>
        </>
      )}

      {isCompleted && existing.meeting_summary && (
        <div className="space-y-3 px-5 pb-5">
          <SectionTitle>Resumen registrado</SectionTitle>
          <p className="text-sm text-[#374151] whitespace-pre-line">{existing.meeting_summary}</p>
        </div>
      )}
    </div>
  );
}
