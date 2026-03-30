import React from "react";
import { FiAlertTriangle, FiClock, FiFlag, FiUserCheck } from "react-icons/fi";

const formatDuration = (value) => {
  if (!value && value !== 0) return "N/A";
  return value;
};

const formatDateTime = (value) => {
  if (!value) return "Sin fecha";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin fecha";
  return parsed.toLocaleString("es-EC");
};

const getTone = (workflow) => {
  if (!workflow) {
    return {
      wrapper: "border-slate-200 bg-white",
      header: "border-slate-200 bg-slate-50",
      statusChip: "bg-slate-100 text-slate-700",
      message: "text-slate-600",
    };
  }

  if (workflow.stalled) {
    return {
      wrapper: "border-rose-200 bg-white",
      header: "border-rose-200 bg-rose-50",
      statusChip: "bg-rose-100 text-rose-700",
      message: "text-rose-700",
    };
  }

  if (workflow.is_terminal) {
    return {
      wrapper: "border-emerald-200 bg-white",
      header: "border-emerald-200 bg-emerald-50",
      statusChip: "bg-emerald-100 text-emerald-700",
      message: "text-emerald-700",
    };
  }

  return {
    wrapper: "border-slate-200 bg-white",
    header: "border-slate-200 bg-slate-50",
    statusChip: "bg-blue-100 text-blue-700",
    message: "text-slate-600",
  };
};

const PersonnelRequestProgress = ({ workflow, request }) => {
  if (!workflow) return null;

  const tone = getTone(workflow);
  const stageLabel = workflow.current_stage_label || workflow.current_status || "Etapa activa";
  const progressLabel = workflow.progress_label || `${workflow.progress_percent || 0}%`;
  const responsibleName =
    workflow.current_responsible_name || workflow.current_responsible_label || "N/A";
  const linkedResponsible = request?.collaborator_name || null;

  return (
    <div className={`overflow-hidden rounded-2xl border shadow-sm ${tone.wrapper}`}>
      <div className={`border-b px-4 py-3 ${tone.header}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            {stageLabel}
          </span>

          {workflow.stalled ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${tone.statusChip}`}
            >
              <FiAlertTriangle size={12} title="Icono de alerta por estancamiento" />
              Estancada
            </span>
          ) : null}

          {workflow.is_terminal ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              <FiFlag size={12} title="Icono de etapa cerrada" />
              Cerrada
            </span>
          ) : null}
        </div>

        {workflow.stalled ? (
          <p className={`mt-2 text-xs font-medium ${tone.message}`}>
            Estancamiento detectado: {workflow.stalled_for_label || "sin detalle de tiempo"}.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Responsable actual</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-900">{responsibleName}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Siguiente accion</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-900">
              {workflow.next_action || "N/A"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Tiempo en etapa</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatDuration(workflow.elapsed_label)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Limite operativo</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatDateTime(workflow.deadline_at)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-600">
            <span>Progreso general</span>
            <span>{progressLabel}</span>
          </div>

          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-900 transition-all"
              style={{ width: `${workflow.progress_percent || 0}%` }}
            />
          </div>

          <div className="mt-3 flex items-start gap-2 text-xs text-slate-600">
            <FiClock size={12} title="Icono de tiempo en etapa" className="mt-0.5 shrink-0" />
            <span>Desde {formatDateTime(workflow.started_at)}</span>
          </div>
        </div>
      </div>

      {Array.isArray(workflow.timeline) && workflow.timeline.length > 0 ? (
        <div className="border-t border-slate-200 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Historial de etapas
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {workflow.timeline.map((entry) => (
              <div
                key={`${entry.status}-${entry.started_at}`}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                  entry.is_current
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-slate-50 text-slate-700"
                }`}
                title={`${entry.label} - ${entry.duration_label}`}
              >
                <span className="mr-1 font-semibold">{entry.label}</span>
                <span className="opacity-80">{entry.duration_label}</span>
                {entry.changed_by_name ? (
                  <span className="ml-2 opacity-70">- {entry.changed_by_name}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {linkedResponsible ? (
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
            <FiUserCheck size={12} title="Icono de responsable asignado" />
            Responsable vinculado: {linkedResponsible}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PersonnelRequestProgress;
