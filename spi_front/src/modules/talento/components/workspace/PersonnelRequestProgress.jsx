import React from "react";
import { FiAlertTriangle, FiClock, FiFlag, FiUserCheck } from "react-icons/fi";

const formatDuration = (value) => {
 if (!value && value !== 0) return "N/A";
 return value;
};

const stageTone = (workflow) => {
 if (!workflow) return "bg-slate-50 border-slate-200 text-slate-800";
 if (workflow.stalled) return "bg-rose-50 border-rose-200 text-rose-800";
 if (workflow.is_terminal) return "bg-emerald-50 border-emerald-200 text-emerald-800";
 return "bg-blue-50 border-blue-200 text-blue-800";
};

const PersonnelRequestProgress = ({ workflow, request }) => {
 if (!workflow) return null;

 return (
 <div className={`rounded-2xl border p-4 shadow-sm ${stageTone(workflow)}`}>
 <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
 <div className="space-y-2">
 <div className="flex flex-wrap items-center gap-2">
 <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
 {workflow.current_stage_label || workflow.current_status}
 </span>
 {workflow.stalled && (
 <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
 <FiAlertTriangle size={12} />
 Estancada
 </span>
 )}
 {workflow.is_terminal && (
 <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
 <FiFlag size={12} />
 Cerrada
 </span>
 )}
 </div>
 <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
 <div>
 <p className="text-[10px] uppercase tracking-wide text-slate-500">Responsable actual</p>
 <p className="font-semibold text-slate-900">{workflow.current_responsible_name || workflow.current_responsible_label || "N/A"}</p>
 </div>
 <div>
 <p className="text-[10px] uppercase tracking-wide text-slate-500">Accion siguiente</p>
 <p className="font-semibold text-slate-900">{workflow.next_action || "N/A"}</p>
 </div>
 <div>
 <p className="text-[10px] uppercase tracking-wide text-slate-500">Tiempo en etapa</p>
 <p className="font-semibold text-slate-900">{formatDuration(workflow.elapsed_label)}</p>
 </div>
 <div>
 <p className="text-[10px] uppercase tracking-wide text-slate-500">Limite operativo</p>
 <p className="font-semibold text-slate-900">
 {workflow.deadline_at ? new Date(workflow.deadline_at).toLocaleString() : "Sin limite"}
 </p>
 </div>
 </div>
 </div>

 <div className="min-w-[220px] space-y-2">
 <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-600">
 <span>Progreso general</span>
 <span>{workflow.progress_label}</span>
 </div>
 <div className="h-2 w-full overflow-hidden rounded-full bg-white/60">
 <div
 className="h-full rounded-full bg-slate-900/80 transition-all"
 style={{ width: `${workflow.progress_percent || 0}%` }}
 />
 </div>
 <div className="flex items-center gap-2 text-xs text-slate-600">
 <FiClock size={12} />
 <span>{workflow.started_at ? `Desde ${new Date(workflow.started_at).toLocaleString()}` : "Sin fecha de inicio"}</span>
 </div>
 </div>
 </div>

 {Array.isArray(workflow.timeline) && workflow.timeline.length > 0 && (
 <div className="mt-4 flex flex-wrap gap-2">
 {workflow.timeline.map((entry) => (
 <div
 key={`${entry.status}-${entry.started_at}`}
 className={`rounded-full border px-3 py-1 text-xs font-medium ${
 entry.is_current
 ? "border-slate-900 bg-slate-900 text-white"
 : "border-white/60 bg-white/70 text-slate-700"
 }`}
 title={`${entry.label} - ${entry.duration_label}`}
 >
 <span className="mr-1 font-semibold">{entry.label}</span>
 <span className="opacity-80">{entry.duration_label}</span>
 {entry.changed_by_name && (
 <span className="ml-2 opacity-70">· {entry.changed_by_name}</span>
 )}
 </div>
 ))}
 </div>
 )}

 {request?.collaborator_name && (
 <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-medium text-slate-700">
 <FiUserCheck size={12} />
 Responsable vinculado: {request.collaborator_name}
 </div>
 )}
 </div>
 );
};

export default PersonnelRequestProgress;
